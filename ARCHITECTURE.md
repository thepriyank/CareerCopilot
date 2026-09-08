# Jobmagnate – Architecture

## 1. Technology Stack

### Backend
| Layer | Choice | Rationale |
|-------|--------|-----------|
| Runtime | Node.js 20 LTS | Broad ecosystem; same language as frontend |
| Language | TypeScript 5.x | End-to-end type safety |
| Framework | Express.js 4.x | Lightweight, widely understood, easy to extend |
| ORM | TypeORM 0.3.x | Type-safe DB access with real migrations (`synchronize: false` — see §5) |
| AI SDK | @anthropic-ai/sdk + openai | Anthropic for Claude; `openai` SDK (custom `baseURL`) for every OpenAI-compatible provider in the fallback chain |
| Auth | JWT (jsonwebtoken + bcryptjs) | Stateless, scalable |
| File upload | Multer | De facto multipart handler for Express |
| PDF parsing | pdf-parse | Pure JS, no native deps |
| DOCX parsing | mammoth | High-fidelity DOCX → text/HTML |
| Validation | Zod | Runtime + compile-time schema validation |
| Logging | Winston | Structured logs; easy to ship to external services |
| Testing | Jest + ts-jest | Standard; supports TypeScript out of the box |

### Frontend
| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 14+ (App Router) | SSR/SSG, routing, great DX |
| Language | TypeScript 5.x | Shared types with backend |
| Styling | Tailwind CSS 3.x | Utility-first; matches clean doc-centric design |
| State | React built-ins + SWR | Minimal overhead for MVP |
| Testing | Jest + React Testing Library | Standard React testing |

### Data Stores
| Store | Technology | Purpose |
|-------|-----------|---------|
| Primary DB | PostgreSQL 15+ | All relational data (users, resumes, profiles, jobs) |
| Vector DB | pgvector extension on PostgreSQL | Embeddings for job–resume similarity (Phase 2) |
| File Storage | Local filesystem (dev) / Google Cloud Storage (prod, `GCS_BUCKET_NAME`) | Raw uploaded resume files, encrypted at rest by the app either way (`services/storage/fileStorage.ts`) |
| Cache / rate limiting | Redis (`REDIS_URL`, optional) | LLM-response cache + per-user rate limiting (`services/cache/`) |

---

## 2. Services Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Clients                                  │
│              Next.js Web App    (React Native Mobile — later)   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS / REST
┌───────────────────────────▼─────────────────────────────────────┐
│                   Express API (backend/)                        │
│                                                                 │
│  Routes → Middleware (auth, validate, upload) → Controllers     │
│                         │                                       │
│  ┌──────────┬───────────┼──────────────┬────────────────────┐  │
│  │  Auth    │ Parsing   │  AI          │  Storage           │  │
│  │ service  │ service   │  Orchestrator│  service           │  │
│  └──────────┴─────┬─────┴──────┬───────┴────────────────────┘  │
│                   │            │                                 │
│            TypeORM        Anthropic SDK                         │
└───────────────────┼────────────┼────────────────────────────────┘
                    │            │
          ┌─────────▼──┐   ┌────▼──────────┐
          │ PostgreSQL  │   │ Anthropic API │
          │ (+ pgvector)│   │ (Claude)      │
          └────────────┘   └───────────────┘
```

### Service Modules

| Service | File(s) | Responsibility |
|---------|---------|---------------|
| `auth` | `routes/auth.routes.ts` | Register, login, JWT management |
| `parsing` | `services/parsing/` | Text extraction, section detection, entity extraction, confidence scoring |
| `ai` | `services/ai/anthropicClient.ts` | Claude API wrapper; model selection; usage tracking |
| `storage` | `services/storage/fileStorage.ts` | File upload/download abstraction |
| `profile` | `routes/profile.routes.ts` | CandidateProfile CRUD and onboarding chat |
| `matching` | `services/matching/` (Phase 2) | Embeddings-based job–resume matching |
| `generation` | `services/generation/` (F3+) | Master resume, tailored resume, cover letter |
| `approval` | `routes/approval.routes.ts` (F6) | Artifact state machine and audit log |

---

## 3. API Design

- **Style**: REST
- **Base path**: `/api`
- **Auth**: `Authorization: Bearer <jwt>` header on all protected routes
- **Format**: `application/json` for all request/response bodies except file uploads (`multipart/form-data`)
- **Error format**:
  ```json
  { "error": { "code": "PARSE_FAILED", "message": "Could not extract text from PDF" } }
  ```

### Current Endpoints (F1 + F2)

```
POST   /api/auth/register            Register new user
POST   /api/auth/login               Login, receive JWT
GET    /api/auth/me                  Get current user

POST   /api/resumes/upload           Upload PDF/DOCX, trigger parse (F1)
GET    /api/resumes                  List user's resume files (F1)
GET    /api/resumes/:fileId          Get resume file + parsed data (F1)
PUT    /api/resumes/parsed/:id       Update parsed resume fields (F1)

GET    /api/profile                  Get CandidateProfile (F2)
POST   /api/profile                  Create/update CandidateProfile (F2)
POST   /api/profile/onboarding       Process one onboarding chat turn (F2)

GET    /api/settings/model-connection    Get the saved connection (masked if cloud)
PUT    /api/settings/model-connection    Save one (cloud key or local URL — see §4)
DELETE /api/settings/model-connection    Clear it, revert to platform default
```

### Job source policy (F4)

Per `BRD.md` §6/§7.1: sourcing is India-first and limited to channels that need no stored user credentials and no ToS-violating automation.

- **In scope:** public per-company ATS JSON APIs (Greenhouse, Lever, Ashby, SmartRecruiters — curated toward India-hiring companies), remote boards explicitly open to India-based candidates (RemoteOK, WeWorkRemotely, Himalayas), licensed/free aggregators (TheirStack, Adzuna, Jooble, JSearch — all key-gated, optional, degrade to no-op without a key), and user-pasted JDs.
- **On aggregators re-syndicating LinkedIn/Indeed content:** TheirStack, Adzuna, Jooble, and JSearch each re-syndicate postings that originate on many portals — JSearch in particular queries Google for Jobs' own index, which itself aggregates public postings from LinkedIn, Indeed, Glassdoor, and others. This is a legitimate licensed/free API relationship (no credentials stored, no ToS-violating automation against those platforms directly), distinct from and not in conflict with the hard "no LinkedIn/Naukri automation, no stored third-party credentials" rule below — we are not automating or scraping those sites ourselves.
- **Explicitly out of scope:** directly automating or scraping Naukri, Indeed, LinkedIn, Wellfound/AngelList, or storing a user's credentials for any of them — none offer a public self-serve jobs API for that (Indeed's Publisher program closed to new applicants in 2023), and doing so would mean either violating their ToS or storing user credentials, both hard nos per `CLAUDE.md` §7. Manual JD paste remains the supported path when no aggregator surfaces a given posting.
- **Provider pattern:** each source is a small module under `backend/src/services/jobs/providers/` — hostname allowlist + `redirect: 'error'` on every fetch (SSRF hardening), returns a normalized `{title, url, company, location, postedAt}[]`. Pattern adapted from the MIT-licensed [santifer/career-ops](https://github.com/santifer/career-ops) `providers/` directory (JSearch is this project's own addition, not part of that upstream).
- **Multi-credential rotation:** a provider can hold more than one API key for the *same* underlying data source (JSearch: OpenWeb Ninja's own API + the same product resold via RapidAPI) via `providers/jobCredentialChain.ts` — tries one credential per search, only falls through to the next once the current one is confirmed exhausted for the month, so two free-tier quotas add up instead of double-fetching the same jobs.
- **Discovery is system-internal, not candidate-triggered (2026-09-06 product decision):** there is no HTTP route for discovery at all — only `services/jobs/discoveryCron.ts` (`node-cron`, 7am/5pm IST by default via `JOB_DISCOVERY_CRON_SCHEDULE`, off by default via `JOB_DISCOVERY_CRON_ENABLED`) calls it, once per tick, against a system-wide target-title list (`providers/seeds/target-job-titles.json` — a placeholder for the admin-configurable list `docs/F4_job_search_and_match_plan.md` describes, not built yet). Results land in the shared `JobListing` pool (`entities/JobListing.ts` + `UserJob.ts`, the Phase 0 global-pool design from that doc); a candidate never sees the raw pool — `GET /api/jobs` (`services/matching/surfaceJobs.ts`) scores it against their master résumé on every call and auto-attaches whatever clears `JOB_MATCH_MIN_SCORE` (default 40/100). No master résumé yet → an empty board, not raw postings.

### Planned Endpoints (F3–F8)

```
POST   /api/generate/master-resume         Generate ATS master resume (F3)
POST   /api/jobs                           Add job posting (pasted JD) (F4)
GET    /api/jobs                           List jobs with match scores (F4)
GET    /api/jobs/:id/match                 Match explanation for a job (F4)
POST   /api/jobs/:id/tailor                Tailored resume + cover letter (F5)
POST   /api/approvals/:type/:id/approve   Approve artifact (F6)
POST   /api/approvals/:type/:id/reject    Reject artifact (F6)
GET    /api/skill-gaps                     Skill gap report (F7)
POST   /api/linkedin/review               LinkedIn profile analysis (F8)
```

---

## 4. AI Model Strategy

### Model Selection by Task

| Task | Model | Why |
|------|-------|-----|
| Resume parsing / extraction | `claude-haiku-4-5-20251001` | Fast, cheap, sufficient for structured extraction |
| Onboarding chat NLU | `claude-haiku-4-5-20251001` | Low-latency conversational responses |
| Master resume rewriting | `claude-sonnet-4-6` | Needs high-quality nuanced writing |
| Tailored resume generation | `claude-sonnet-4-6` | Same |
| Cover letter generation | `claude-sonnet-4-6` | Highest quality needed |
| Match explanations | `claude-haiku-4-5-20251001` | Structured JSON output |
| Skill-gap analysis | `claude-haiku-4-5-20251001` | Structured JSON output |
| LinkedIn review | `claude-sonnet-4-6` | Needs editorial judgment |

### API Key Priority (per PRD §8)
1. User-provided API key / local endpoint stored in their settings (encrypted at rest) — bypasses the chain below entirely
2. **Platform provider chain** — an ordered list of OpenAI-compatible providers, every free-tier one tried before any paid one

#### The platform provider chain

`generate()` walks `config.llm.providers` and uses the first provider that answers. A provider is *active* only when its API-key env var is set (`GEMINI_API_KEY`, `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `OLLAMA_API_KEY`, `OPENROUTER_API_KEY`, …); adding a new free tier is: drop the key in `.env`, and if it's not already known, add one line to `PROVIDER_REGISTRY` in `services/ai/providerRegistry.ts`.

- **Order:** `LLM_PROVIDER_ORDER` (csv of provider ids) sets priority; a stable free-before-paid partition is then applied unconditionally.
- **Paid providers** (`deepseek`, `anthropic`, `openai`) are excluded unless `LLM_ALLOW_PAID` is truthy — a guard against surprise spend in local dev.
- **Failure handling** (`services/ai/providerChain.ts`): a `429`/quota failure benches the provider for `LLM_COOLDOWN_MS` (or the response's `Retry-After`); a `401`/`403` or a `400`/`404`/"model unavailable" benches it for the rest of the process; a `5xx`/network blip just skips it for that one call. Bench state is in-memory, so a restart re-reads the env and gives every provider a fresh chance.
- All providers except Anthropic are called over the OpenAI Chat Completions wire protocol through the `openai` SDK with a per-provider `baseURL`; Anthropic uses `@anthropic-ai/sdk`.
- Legacy `OPENROUTER_PRESET` / `config.openrouter` are still read (as OpenRouter's model id) for back-compat.

Free/open-weight models are weaker at strict JSON adherence than Claude. `generateJson()` strips ```` ``` ```` / backtick wrappers and, failing that, slices out the first `{…}`/`[…]` block before giving up with a clear "AI returned malformed JSON" — but expect a higher retry rate on free tiers.

Full walkthrough, provider table, and "adding a provider": [`docs/llm_provider_fallback.md`](docs/llm_provider_fallback.md).

### Model connection (Settings → API keys)

One field (`Settings → Model connection`), auto-detected by shape:
- Starts with `http://`/`https://` → a **local or self-hosted OpenAI-compatible endpoint**, with the model name in a `#model=` fragment (fragments are never sent over the wire — a client-side-only annotation): `http://localhost:11434/v1#model=gemma4:e4b` for Ollama. The same convention works unmodified against LM Studio, `llama.cpp`'s server, vLLM, text-generation-webui, koboldcpp, LocalAI, or a hosted OpenAI-compatible gateway (OpenRouter, Groq, Together.ai, OpenAI itself) — only the host changes, since they all speak the same Chat Completions wire protocol. Implemented with the official `openai` npm SDK pointed at a custom `baseURL`.
- Anything else → a raw cloud API key (Anthropic today).

Parsing/validation: `backend/src/services/ai/modelConnection.ts`. Storage: `User.settings.modelConnection`, AES-256-GCM encrypted at rest (`backend/src/utils/encryption.ts`, keyed by `SETTINGS_ENCRYPTION_KEY`) — the field may hold a real cloud secret, so it's always encrypted regardless of which kind was saved. Resolution order in `anthropicClient.ts`'s `generate()`/`generateJson()`: explicit per-call override → the calling user's saved connection → platform default. Every call site (`entityExtractor.ts`, `resumeEnhancer.ts`, `coverLetterGenerator.ts`, onboarding NLU) is unaffected by which branch resolves — the function signatures never changed.

**SSRF note.** The backend makes an outbound request to whatever URL is saved here. That's the point for today's deployment model — one operator, backend and (optionally) Ollama on the same machine, matching `BRD.md` §6's "privacy-conscious, local/user-key-based AI" audience. `modelConnection.ts` blocks the well-known cloud metadata addresses (`169.254.169.254` etc.) as defense-in-depth, but that is **not** a general SSRF allowlist — arbitrary localhost/private-network endpoints are the intended use case. Before this app is ever deployed as a shared multi-tenant service, this feature needs either a stricter allowlist or a server-side kill switch; that's a decision for that point, not now.

### Guardrails
- All generation prompts include the candidate's extracted fact-set as context
- Prompts explicitly instruct the model not to invent roles, employers, degrees, or skills
- Generated output is logged alongside the source data for auditability

---

## 5. Data Model Summary

TypeORM entities under `backend/src/entities/` (no `schema.prisma` — this
project moved off Prisma; `synchronize: false` permanently, real migrations
under `backend/src/migrations/` run via `migration:generate` / `migration:run`
— see `config/dataSource.ts`). Core entities:

```
User ──< ResumeFile ──┤ ParsedResume
     ──< CandidateProfile
     ──< UserJob >── JobListing                  (Phase 0 global pool, 2026-09-06 —
     ──< MatchResult                              JobListing is shared across users,
     ──< GeneratedResumeVersion ──< ApprovalRecord keyed by a hash of its canonical URL;
     ──< GeneratedCoverLetter   ──< ApprovalRecord UserJob is the per-candidate join)
     ──< SkillGapReport ──< CourseRecommendation
     ──< LinkedInReviewReport
     ──< ModelUsageRecord
```

`MatchResult`/`GeneratedResumeVersion`/`GeneratedCoverLetter`/`SkillGapReport`
all key off `UserJob.id` (still called `jobId` on each), not `JobListing.id`
directly — a match score or tailored resume is inherently per-candidate, and
`UserJob` already resolves to exactly one candidate. See `UserJob.ts`'s own
comment.

---

## 6. Security & Privacy

- Passwords hashed with bcrypt (12 salt rounds)
- JWT signed HS256, 7-day expiry, refreshable
- Resume file URLs are opaque UUIDs served through authenticated endpoints
- Raw resume text is **never** written to application logs
- All PII fields are user-scoped (foreign key on userId enforced at DB level)
- Users can delete their account and all associated data (cascade deletes via TypeORM entity relations)

---

## 7. Deployment

**Local development:**
```
# Backend
cd backend && npm run dev        # ts-node-dev, port 3001

# Frontend  
cd frontend && npm run dev       # Next.js dev, port 3000

# Database + Redis
docker-compose up -d             # PostgreSQL on 5432, Redis on 6379
```

**Production (decided 2026-09-08 — see `docs/cicd_terraform_plan.md` for the
full Terraform/GitHub Actions design; this is the settled target, not a menu):**
- Backend **and** frontend → **GCP Cloud Run**, both in the existing GCP
  project (`jobmagnet-6a1ab` — already holds GCS + Firebase; isolated by
  resource naming/IAM rather than a separate project per environment)
- Two environments to start: `staging` and `production` — each its own Cloud
  Run services and its own Neon branch. Frontend served at `jobmagnate.com`
  (custom domain mapping onto its Cloud Run service)
- Database → **Neon** (serverless Postgres; project `polished-unit-87797764`,
  branch-per-environment, reached over public TLS — no VPC connector needed).
  Branch policy lives in root `neon.ts`, deployed via the `neon` CLI
- File storage → **Google Cloud Storage** (`GCS_BUCKET_NAME` — decided
  2026-09-07; implemented behind `services/storage/fileStorage.ts`'s backend
  interface, local disk until configured). On Cloud Run, credentials come
  from the attached service account's Application Default Credentials —
  no `GCS_KEY_FILE`/`GCS_CREDENTIALS_JSON` secret shipped
- Auth → Firebase Admin resolves the same way (ADC via the attached service
  account) since the Firebase project is the same GCP project
- Cache / rate limiting → **Redis skipped for MVP** (decided 2026-09-08).
  Both the LLM-response cache and the per-user rate limiter were built to
  fail open when `REDIS_URL` is unset (`services/cache/`) — no crash, just no
  caching/no throttling. Revisit by pointing `REDIS_URL` at an external
  managed Redis (e.g. Upstash — free tier, public TLS, no VPC connector) if
  real usage makes either matter; GCP Memorystore was considered and
  rejected for MVP purely on cost (needs a VPC connector + non-free
  instance, ~$50–70/mo minimum, vs. ~$0 for an external option)
- `discoveryCron.ts`'s in-process schedule and `index.ts`'s boot-time
  `runMigrations()` both need rework before Cloud Run can safely run more
  than one instance — tracked as Phase E of `docs/cicd_terraform_plan.md`,
  not yet done
