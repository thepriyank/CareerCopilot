# AI Career Copilot – Architecture

## 1. Technology Stack

### Backend
| Layer | Choice | Rationale |
|-------|--------|-----------|
| Runtime | Node.js 20 LTS | Broad ecosystem; same language as frontend |
| Language | TypeScript 5.x | End-to-end type safety |
| Framework | Express.js 4.x | Lightweight, widely understood, easy to extend |
| ORM | Prisma 5.x | Type-safe DB access with migrations |
| AI SDK | @anthropic-ai/sdk | First-class Claude support; user-key + platform-key strategy |
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
| File Storage | Local filesystem (dev) / S3-compatible (prod) | Raw uploaded resume files |

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
│            Prisma ORM     Anthropic SDK                         │
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
```

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
1. User-provided API key stored in their settings (encrypted at rest)
2. Platform API key as fallback

### Guardrails
- All generation prompts include the candidate's extracted fact-set as context
- Prompts explicitly instruct the model not to invent roles, employers, degrees, or skills
- Generated output is logged alongside the source data for auditability

---

## 5. Data Model Summary

See `backend/prisma/schema.prisma` for the full Prisma schema. Core entities:

```
User ──< ResumeFile ──┤ ParsedResume
     ──< CandidateProfile
     ──< JobPosting ──< MatchResult
     ──< GeneratedResumeVersion ──< ApprovalRecord
     ──< GeneratedCoverLetter   ──< ApprovalRecord
     ──< SkillGapReport ──< CourseRecommendation
     ──< LinkedInReviewReport
     ──< ModelUsageRecord
```

---

## 6. Security & Privacy

- Passwords hashed with bcrypt (12 salt rounds)
- JWT signed HS256, 7-day expiry, refreshable
- Resume file URLs are opaque UUIDs served through authenticated endpoints
- Raw resume text is **never** written to application logs
- All PII fields are user-scoped (foreign key on userId enforced at DB level)
- Users can delete their account and all associated data (cascade deletes in Prisma)

---

## 7. Deployment (MVP)

**Local development:**
```
# Backend
cd backend && npm run dev        # ts-node-dev, port 3001

# Frontend  
cd frontend && npm run dev       # Next.js dev, port 3000

# Database
docker-compose up -d             # PostgreSQL on port 5432
```

**Production (future):**
- Backend → Docker on Railway / Render / Fly.io
- Frontend → Vercel
- Database → Managed PostgreSQL (Supabase / Neon)
- File storage → Cloudflare R2 or AWS S3
