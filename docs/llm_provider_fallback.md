# LLM provider fallback chain

**Status:** implemented · **Code:** `backend/src/services/ai/{providerRegistry,providerChain,anthropicClient}.ts` · **Tests:** `backend/tests/unit/{providerRegistry,providerChain,anthropicClient}.test.ts`

## Goal

Run the app's AI features on **free-tier cloud LLMs**, and when one provider's key
hits its rate limit / quota, automatically move to the next free provider. Only
once every free provider is exhausted (and only if explicitly allowed) fall
through to a paid, pay-as-you-go provider.

## How it works

`generate()` / `generateJson()` in `anthropicClient.ts` resolve a connection in
this order:

1. **Per-call override** (`options.userApiKey`) — used as-is, no chain.
2. **The calling user's saved connection** (Settings → Model connection,
   encrypted at rest) — used as-is, no chain.
3. **The platform provider chain** — everything below.

### The chain

`config.llm.providers` is an ordered list of *active* providers, built at boot by
`resolveChain(process.env)`:

- A provider from `PROVIDER_REGISTRY` is **active** iff its `apiKeyEnv` (or a
  known alias, e.g. `GROK_API_KEY` → Groq) is set and non-empty.
- **Order** comes from `LLM_PROVIDER_ORDER` (csv of provider ids). Anything not
  listed falls to the end in registry order.
- A stable **free-before-paid** partition is then applied — always, regardless of
  what `LLM_PROVIDER_ORDER` says.
- **Paid** providers (`deepseek`, `anthropic`, `openai`) are dropped entirely
  unless `LLM_ALLOW_PAID` is truthy.

`runPlatformChain()` then iterates the active chain, skipping any provider
currently *benched*, and returns the first success.

### Benching (per-process, in-memory)

`providerChain.ts` classifies each failure and reacts:

| Failure | Detection | Action |
|---|---|---|
| `quota` | HTTP 429, or `/rate limit\|quota\|exceeded\|insufficient\|credits?\|billing/` | bench for `Retry-After`, else `LLM_COOLDOWN_MS` (default 15 min) |
| `auth` | HTTP 401/403, or `/unauthorized\|invalid api key\|forbidden/` | bench for the whole process |
| `fatal` | HTTP 400/404, "model not found", "unavailable for free", … | bench for the whole process (config bug — retrying won't help) |
| `transient` | HTTP ≥ 500, `ECONNRESET`/`ETIMEDOUT`/timeout, `APIConnectionError` | skip for this one call, no bench |

A process restart clears all bench state and re-reads the env, so every provider
gets a fresh chance.

### Wire protocol

Every provider except Anthropic speaks the **OpenAI Chat Completions** protocol
and goes through the `openai` SDK with a per-provider `baseURL`. Anthropic uses
`@anthropic-ai/sdk`. Clients are cached per credential.

## Configuration

All of these live in `backend/.env` (and are also read from the repo-root
`.env`; `backend/.env` wins on conflicts).

| Var | Default | Meaning |
|---|---|---|
| `LLM_PROVIDER_ORDER` | `groq,gemini,openrouter,ollama,deepseek,anthropic,openai` | priority order |
| `LLM_COOLDOWN_MS` | `900000` | bench time for a rate-limited provider with no `Retry-After` |
| `LLM_ALLOW_PAID` | `false` | must be `true` for any paid provider to be used |
| `<PROVIDER>_API_KEY` | — | presence activates the provider |
| `<PROVIDER>_MODEL` | see registry | overrides the model id for that provider |

### Provider registry (`providerRegistry.ts`)

| id | tier | key env | base URL | default model |
|---|---|---|---|---|
| `groq` | free | `GROQ_API_KEY` (alias `GROK_API_KEY`) | `api.groq.com/openai/v1` | `openai/gpt-oss-20b` |
| `gemini` | free | `GEMINI_API_KEY` | `generativelanguage.googleapis.com/v1beta/openai/` | `gemini-3.5-flash-lite` (2.5 retired for new users, 2026-09-23) |
| `ollama` | free | `OLLAMA_API_KEY` | `ollama.com/v1` | `gpt-oss:20b` |
| `openrouter` | free | `OPENROUTER_API_KEY` | `openrouter.ai/api/v1` | `nvidia/nemotron-3-super-120b-a12b:free` (llama-3.3 `:free` removed 2026-09-23; or `OPENROUTER_PRESET`) |
| `deepseek` | paid | `DEEPSEEK_API_KEY` | `api.deepseek.com` | `deepseek-chat` |
| `anthropic` | paid | `ANTHROPIC_API_KEY` | (native SDK) | `claude-haiku-4-5-20251001` |
| `openai` | paid | `OPENAI_API_KEY` | `api.openai.com/v1` | `gpt-4o-mini` |

### Adding a provider

Most OpenAI-compatible free tiers (Mistral, Together, DeepInfra, GitHub Models,
Nvidia NIM, …) need only a new entry in `PROVIDER_REGISTRY`:

```ts
{
  id: 'mistral', label: 'Mistral', tier: 'free', protocol: 'openai',
  baseUrl: 'https://api.mistral.ai/v1',
  apiKeyEnv: 'MISTRAL_API_KEY', modelEnv: 'MISTRAL_MODEL',
  defaultModel: 'mistral-small-latest',
},
```

…then set `MISTRAL_API_KEY` and add `mistral` to `LLM_PROVIDER_ORDER`.

## Environment status at implementation time (2026-08-31)

Probed with the keys currently in `.env`:

| Provider | Result |
|---|---|
| **gemini** | ✅ working (`gemini-2.5-flash-lite`, `gemini-2.5-flash`) — the app runs on this today |
| groq | ❌ key authenticates but every model 404s ("does not exist or you do not have access") — account not activated / key scope |
| cerebras | ❌ 404 (no body) on every model — key inactive |
| ollama | ❌ 401 Unauthorized — key invalid/inactive |
| openrouter | ⚠️ key valid, but all `:free` slugs 404 — OpenRouter gates free models behind a one-time \$10 credit purchase (or the data-training privacy toggle) |
| deepseek | ⚠️ key valid, `402 Insufficient Balance` — paid, no credit |

Net: the chain degrades correctly to Gemini. The other providers slot in with no
code change the moment their keys are made valid. The dead-key providers each log
one `fatal` bench line per process start — expected, not a regression.

## Production outage — 2026-09-23

Every free provider on production failed on one LinkedIn PDF extraction:
Cerebras `402` (account needs billing — all models), Gemini `404` on
`gemini-2.5-*` (retired for new users) and `402` "prepayment credits
depleted" on every newer model, OpenRouter `404` (llama-3.3 `:free` removed),
Ollama `gpt-oss:20b` empty content (reasoning ate the 4096-token budget).
Fixes: 402 → `quota` benched for `LLM_BILLING_COOLDOWN_MS` (1h); `fatal`
benched for `LLM_FATAL_COOLDOWN_MS` (6h) instead of the whole process;
empty responses are `transient` (never bench); gpt-oss calls send
`reasoning_effort: "low"`; LinkedIn extraction gets `maxTokens: 8192`; new
Gemini/OpenRouter defaults. Cerebras and Gemini still need account action
(billing / a free-tier AI Studio project) — that's not fixable in code.

**Also 2026-09-23:** Ollama Cloud is the preferred channel for paid usage
(the account gets topped up with credit when free quotas run out), so it now
sits *last* among the free providers — after Groq/Cerebras/Gemini/OpenRouter,
before any `paid`-tier provider. Groq key added to production; its free tier
is 30 RPM / 1K RPD / 8K TPM / 200K TPD on `openai/gpt-oss-120b` (new default)
and `-20b`, so a big request can exceed one minute's token budget — Groq
answers `413`, which is now `transient` (skip this call, don't bench).
User-facing errors: see `backend/src/middleware/errorHandler.ts` — only
`createError` copy reaches the client, filtered once more by `looksTechnical`;
AI-chain failures surface as `AI_UNAVAILABLE` friendly copy.

**Cerebras removed (2026-09-23).** Owner decision — its plan no longer
offers usable free-tier models (every model returned `402` on both
environments' keys). Dropped from `PROVIDER_REGISTRY`, the default order,
both environments' Terraform (secrets + Cloud Run env) and the privacy
policy's processor list. A leftover `CEREBRAS_API_KEY` is ignored.

