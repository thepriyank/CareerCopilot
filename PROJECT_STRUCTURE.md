# AI Career Copilot – Project Structure

## Top-Level Layout

```
ai-career-copilot/
├── backend/          # Express + TypeScript API server
├── frontend/         # Next.js 14 web application
├── docs/             # Feature plans and decision records
├── ARCHITECTURE.md   # Stack, services, API design, security
├── PROJECT_STRUCTURE.md  # This file
├── BRD.md            # Business Requirements Document
├── PRD.md            # Product Requirements Document
├── DESIGN_DOC.md     # UX/UI design spec
├── FEATURE_PROMPTS.md # Per-feature implementation prompts
├── CLAUDE.md         # Claude Code operating instructions
└── README.md         # Getting-started guide
```

---

## Backend (`backend/`)

```
backend/
├── prisma/
│   ├── schema.prisma         # Prisma data model (all entities)
│   └── migrations/           # Auto-generated migration files
│
├── src/
│   ├── index.ts              # Express app entry point
│   │
│   ├── config/
│   │   └── index.ts          # Typed config from environment variables
│   │
│   ├── middleware/
│   │   ├── auth.ts           # JWT verification, req.user attachment
│   │   ├── errorHandler.ts   # Centralised error → JSON response
│   │   └── upload.ts         # Multer configuration (file type, size limits)
│   │
│   ├── routes/
│   │   ├── index.ts          # Mounts all sub-routers under /api
│   │   ├── auth.routes.ts    # POST /register, POST /login, GET /me
│   │   ├── resume.routes.ts  # F1: upload, list, get, update parsed
│   │   └── profile.routes.ts # F2: get, upsert, onboarding chat
│   │
│   ├── services/
│   │   ├── parsing/
│   │   │   ├── resumeParser.ts     # Orchestrates extraction pipeline
│   │   │   ├── sectionDetector.ts  # Regex-based section header detection
│   │   │   └── entityExtractor.ts  # Claude-based entity extraction
│   │   │
│   │   ├── ai/
│   │   │   └── anthropicClient.ts  # Anthropic SDK wrapper; model selection; usage log
│   │   │
│   │   └── storage/
│   │       └── fileStorage.ts      # Save/delete files; abstraction over local/S3
│   │
│   ├── types/
│   │   └── index.ts          # Shared TS interfaces (ParsedResume, Entities, etc.)
│   │
│   └── utils/
│       └── logger.ts         # Winston logger instance
│
├── tests/
│   └── unit/
│       ├── sectionDetector.test.ts
│       └── resumeParser.test.ts
│
├── uploads/                  # Runtime upload directory (git-ignored)
├── .env                      # Local secrets (git-ignored)
├── .env.example              # Template for environment variables
├── .gitignore
├── jest.config.ts
├── package.json
├── README.md
└── tsconfig.json
```

### Key Backend Conventions
- **Route handlers** are thin: validate input (Zod), call a service, return JSON.
- **Services** contain all business logic. No Express types inside services.
- **Prisma client** is imported from `@prisma/client`; a single shared instance lives in `src/config/index.ts`.
- **Errors** are thrown as `{ statusCode, code, message }` objects and caught by `errorHandler.ts`.
- **Environment** is loaded once in `src/config/index.ts`; nothing reads `process.env` directly elsewhere.

---

## Frontend (`frontend/`)

```
frontend/
├── public/                   # Static assets (favicon, og-image, etc.)
│
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── layout.tsx        # Root layout (font, meta, providers)
│   │   ├── page.tsx          # Landing page
│   │   ├── globals.css       # Tailwind base + custom CSS vars
│   │   │
│   │   ├── (auth)/           # Route group — no shared layout
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── register/
│   │   │       └── page.tsx
│   │   │
│   │   └── (dashboard)/      # Authenticated area
│   │       ├── layout.tsx    # Sidebar navigation + auth guard
│   │       ├── dashboard/
│   │       │   └── page.tsx  # Overview: resume status, recent jobs
│   │       ├── resume/
│   │       │   ├── upload/
│   │       │   │   └── page.tsx   # F1: drag-and-drop upload
│   │       │   └── [id]/
│   │       │       └── page.tsx   # F1: parsed resume viewer/editor
│   │       └── onboarding/
│   │           └── page.tsx       # F2: chat-based onboarding
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   └── Card.tsx
│   │   │
│   │   ├── resume/
│   │   │   ├── ResumeUploader.tsx    # Drag-and-drop zone + upload logic
│   │   │   └── ParsedResumeView.tsx  # Structured view of parsed sections
│   │   │
│   │   └── onboarding/
│   │       └── OnboardingChat.tsx    # Chat bubbles + input
│   │
│   ├── hooks/
│   │   └── useResumeUpload.ts        # Upload state machine hook
│   │
│   ├── lib/
│   │   ├── api.ts            # Typed fetch wrapper (attaches JWT, handles errors)
│   │   └── auth.ts           # Token storage helpers (localStorage)
│   │
│   └── types/
│       └── index.ts          # Shared TS types mirrored from backend
│
├── .gitignore
├── next.config.ts
├── package.json
├── postcss.config.js
├── README.md
├── tailwind.config.ts
└── tsconfig.json
```

### Key Frontend Conventions
- **All API calls** go through `src/lib/api.ts` (never raw `fetch` in components).
- **Auth token** lives in `localStorage` under key `copilot_token`; reading/writing through `src/lib/auth.ts`.
- **Route groups** `(auth)` and `(dashboard)` share no layouts; the dashboard layout has the auth guard.
- **Component naming**: PascalCase files, one default export per file.
- **No `any`**: all API responses typed against `src/types/index.ts`.

---

## Docs (`docs/`)

```
docs/
├── F1_resume_ingestion_and_parsing_plan.md
├── F2_candidate_onboarding_chat_plan.md
├── F3_master_resume_enhancement_plan.md   (created when F3 starts)
├── F4_job_search_and_match_plan.md        (created when F4 starts)
├── F5_job_specific_tailoring_plan.md      (created when F5 starts)
├── F6_review_and_approval_plan.md         (created when F6 starts)
├── F7_skill_gap_analysis_plan.md          (created when F7 starts)
└── F8_linkedin_review_plan.md             (created when F8 starts)
```

Each plan doc covers: phases, data models, API endpoints, UI, edge cases, and test plan.
