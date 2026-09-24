# NM-29 — Dynamic free-tier LLM model catalog, health checks & Slack alerts

> Jira: [NM-29](https://nowmagnate.atlassian.net/browse/NM-29) · Written 2026-09-24 · Status: implemented, deploying

## Findings from the first real run (dev DB, production keys) — fixed before deploy
- **False billing alert:** Ollama answers 402 for its premium models while the
  free ones pass. 402/401 now count as account-level only when *no* model on
  the provider works; otherwise that one model is marked UNAVAILABLE.
- **Speed-only ranking picked weak models:** Groq's fastest passing model was
  `allam-2-7b` (177 ms) — it would have taken traffic from `gpt-oss-120b`.
  Ranking is now: registry-curated models first, other passing models by
  speed, small (<20B) models last.
- **Our probes rate-limited Gemini:** probing 3 at once got 12/20 models a 429.
  Gemini is now probed one at a time, 4.5 s apart (~6 min refresh).

## Why

On 2026-09-23 every free LLM provider failed at once on production (Cerebras
402, Gemini 404/402, OpenRouter's `:free` slug removed, Ollama empty
answers). Model ids were hardcoded, a 404 disabled a provider until restart,
and nobody found out until a user hit the raw error. The hotfix (bounded
cooldowns, per-provider model lists, Groq, friendly errors) is live; this is
the durable fix.

## Decisions (owner, 2026-09-23)

| Question | Decision |
|---|---|
| Alert channel | Slack incoming webhook — secret `jobmagnate-production-slack-alerts-webhook` (owner-created, imported into Terraform) |
| Cadence | Weekly catalog refresh (Mon 07:30 IST) + daily light health check (08:00 IST) |
| Alert triggers | Billing/key (402/401/403) · provider fully down · too few working free models · daily quota ≥ 80% where exposed |
| Environments | Production only. Staging keeps the hardcoded model lists as fallback |
| Defaults (accepted) | 45s per model attempt, 90s per whole call; "too few" = OpenRouter < 3, others < 1; JSON-extraction quality bar; alerts de-duped to once/day per issue + a "resolved" message; no status page |

## Design

### Data (`src/migrations/1790400000000-AddLlmModelCatalog.ts`)
- **`llm_model_catalog`** — one row per `(providerId, modelId)`: status
  (`ACTIVE`, `RATE_LIMITED`, `UNAVAILABLE`, `FAILED_QUALITY`, `RETIRED`), rank,
  context window / max output (when the provider says), reasoning flag,
  last seen / probed, last probe result + latency, consecutive failures.
- **`llm_provider_alerts`** — de-dup state per alert key
  (`billing:gemini`, `down:openrouter`, …): first seen, last sent, resolved.
- **`model_usage_records.userId` → nullable**, so every call is recorded
  (background jobs have no user), not only user-initiated ones.

### Provider adapters (`src/services/ai/catalog/`)
Per provider: list models over its API, drop non-chat models (TTS, image,
embedding, video, audio/live, guard/safety classifiers), and read quota where
the provider exposes it — Groq's `x-ratelimit-*` response headers
(requests/day), OpenRouter's `GET /api/v1/key`. Gemini and Ollama expose no
quota API; they're covered by probe outcomes (429 / 402).

### Probe
A tiny JSON-extraction prompt (same shape as real features), 45s timeout,
`reasoning_effort: low` for gpt-oss. Outcome → status: valid, correct JSON →
`ACTIVE` (latency recorded); wrong/non-JSON → `FAILED_QUALITY`; 429 →
`RATE_LIMITED`; 404/400/403-model/timeout → `UNAVAILABLE`; 402/401/403-key →
account-level problem for the whole provider. Ranking: `ACTIVE` first by
latency, then `RATE_LIMITED` (worth retrying live), others excluded.

### Jobs (Cloud Run Jobs + Cloud Scheduler, production)
- **Weekly refresh** (`scripts/runModelCatalogRefresh.ts`): list → filter →
  probe (capped per provider) → upsert → mark vanished models `RETIRED` →
  evaluate alerts.
- **Daily health** (`scripts/runLlmHealthCheck.ts`): probe the top-ranked
  models per provider until one passes (max 3), read quota, update those rows,
  evaluate alerts.

### Alerts (`catalog/alerts.ts`)
Conditions produce alert keys; a key alerts on Slack when first seen, then at
most once per 24h while it persists, plus one "resolved" message when it
clears. No webhook configured → log only (staging, local dev).

### Runtime use (web service)
`providerChain.usableModels()` takes models from, in order:
1. a `*_MODEL` env override (operator pin — always wins);
2. the catalog's `ACTIVE`/`RATE_LIMITED` rows by rank (cached in memory,
   refreshed every 10 min in the background, never blocking a request);
3. the hardcoded registry defaults (empty catalog, DB unreachable, staging).

### Per-call time limits
Each model attempt: `min(45s, time left)` with the SDK's own retries
disabled (`maxRetries: 0` — the chain *is* the retry policy; the SDK's
default 2 retries with backoff silently stretched slow failures). Whole call:
90s deadline across all fallbacks. A timed-out model is benched for the
normal cooldown so the next call skips it.

## Phases
1. Migration + entities; usage recorded for every call.
2. Adapters, probe, ranking, alerts + Slack sender (unit-tested, no network).
3. Catalog-driven model selection + per-call time limits in the chain.
4. Job scripts; Terraform (secret import, 2 jobs, 2 schedules, invoker SA).
5. Deploy: staging (code only — no jobs), production; run both jobs once
   manually; verify catalog rows, a Slack test alert (owner-approved), and
   that live calls use catalog models.

## Out of scope
Status page (Slack only, per decision) · paid-provider catalog · staging jobs.
