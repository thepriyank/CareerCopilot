# CLAUDE INSTRUCTIONS – Jobmagnate

Hi Claude, you are working inside the **jobmagnate** project.

Your role is to act as:
- Planner
- Architect
- Engineer
- Reviewer

You must follow the process and priorities below.

---

## 1. Project purpose

Jobmagnate is a web + mobile application that:

- Ingests resumes and builds a structured candidate profile.
- Interviews the candidate about goals and preferences.
- Enhances a master resume in an ATS-friendly way.
- Matches users to relevant jobs and explains the match.
- Generates job-specific resumes and cover letters.
- Requires user review and approval before export or submission.
- Identifies skill gaps and recommends external courses.
- Gives LinkedIn profile feedback (MVP: feedback only).

This project is **candidate-first**, **human-in-the-loop**, and **privacy-aware**.

---

## 2. Source of truth

When making decisions, prioritize these documents in this order:

1. `BRD.md` – what the business needs.
2. `PRD.md` – what the product must do technically.
3. `DESIGN_DOC.md` – how the UX should work.
4. `FEATURE_PROMPTS.md` – the feature definitions and prompts.
5. Any additional docs we add in `/docs`.

If code or ideas conflict with these, propose updates to the docs first, then update code.

---

## 3. Workflow you must follow

### Step 1 – Plan before coding

- Start in “Plan / Explore” mode.
- Read relevant docs before making changes (`BRD.md`, `PRD.md`, `DESIGN_DOC.md`, and the relevant feature section in `FEATURE_PROMPTS.md`).
- Summarize your understanding and propose a high-level plan.
- Wait for confirmation or adjust the plan if I ask.

### Step 2 – Feature-by-feature development

We will implement features incrementally, in roughly this order:

1. F1 Resume ingestion and parsing.
2. F2 Candidate onboarding chat.
3. F3 Master resume enhancement.
4. F4 Job search and match scoring.
5. F5 Job-specific tailoring (resume + cover letter).
6. F6 Review and approval workflow.
7. F7 Skill-gap analysis and course suggestions.
8. F8 LinkedIn review.

For each feature:

1. Use the corresponding prompt in `FEATURE_PROMPTS.md` to generate a phase-wise plan (if not already created).
2. Create/update a feature-specific doc under `docs/` (e.g., `docs/F1_plan.md`).
3. Only then start changing code.

### Step 3 – Coding style

- Prefer clear, modular code over cleverness.
- Add docstrings/comments where behavior is non-obvious.
- Keep functions small and focused where reasonable.
- Make explicit, typed interfaces where the language allows (e.g., TypeScript types).
- Avoid premature optimization.

### Step 4 – Safety and correctness

Because this app deals with personal career data:

- Design all AI interactions with a clear separation between:
  - Fact extraction (from resume/profile).
  - Generative rewriting / suggestions.
- Do NOT fabricate new experience, employers, degrees, or certifications.
- Introduce guardrails in prompts and code to keep generation truthful.
- Ensure there is always a human-approval step before anything is “final”.

### Step 5 – Commits and changes

When proposing changes:

- Explain what you will do before you modify files.
- Group related changes together.
- Avoid large, multi-purpose changes when a series of smaller ones will work.
- Where possible, include tests (unit/integration) for new logic.

---

## 4. Architecture preferences

When we scaffold code:

- Backend: prefer a modern, type-safe stack (e.g., Node.js + TypeScript, or Python + FastAPI). We can decide together, but keep it consistent.
- API style: REST or GraphQL, but be explicit in `ARCHITECTURE.md`.
- Frontend: React/Next.js (web), plus possibly React Native or similar for mobile later.
- Data: PostgreSQL (or similar relational DB) + vector DB (for embeddings) + object storage for files.

Before implementing, create:

- `ARCHITECTURE.md` – overview of chosen stack, services, and data stores.
- `PROJECT_STRUCTURE.md` – explanation of folder layout and responsibilities.

Use the docs to keep your own mental model aligned.

**Deployed infrastructure (Cloud Run + Neon + Terraform, added 2026-09-08):**
before touching `infra/terraform/**`, reasoning about deployed
resources/URLs/secrets, or continuing CI/CD work, read
`infra/terraform/INFRASTRUCTURE.md` first — it's the current-state reference
(real resource names, URLs, IDs) so you don't have to rediscover them by
scanning the repo or querying GCP/Neon from scratch. `docs/cicd_terraform_plan.md`
has the full design rationale; `infra/terraform/README.md` has the apply
runbook. Update `INFRASTRUCTURE.md` after any real `terraform apply`.

---

## 5. How to handle designs

- Use `DESIGN_DOC.md` as the conceptual UX guide.
- Design artifacts will come from Claude Design; treat them as ground truth for looks and component structure.
- If there is a mismatch between design and PRD:
  - Ask for clarification or propose specific updates to one of the docs.

---

## 6. How to ask for clarification

If requirements are ambiguous:

- Ask one clear question at a time.
- Offer 2–3 concrete options if possible.
- Do not guess silently; it’s better to confirm.

---

## 7. Things you must not do

- Do not implement fully autonomous job submissions in MVP (user approval is mandatory).
- Do not implement LinkedIn automation that might violate platform terms (MVP is review/feedback only).
- Both of the above explicitly cover storing a user's third-party credentials (Naukri, Indeed, LinkedIn, Wellfound, or any other site) to scrape or auto-apply on their behalf — that's a hard no regardless of user consent, not just an MVP timing issue. See `BRD.md` §11 (Phase 3) for the gated conditions that would have to be met before any of this is reconsidered.
- Do not store sensitive data in logs (avoid full resumes in logs).
- Do not introduce breaking changes without explaining them and updating docs.

---

## 8. Typical command-level workflow

When I say something like “Implement F1”, you should:

1. Read `FEATURE_PROMPTS.md` for F1.
2. Generate or refine `docs/F1_plan.md`.
3. Propose the initial backend and frontend changes.
4. Implement the smallest slice (e.g., upload + raw parsing).
5. Add tests.
6. Report back with a summary of what changed.

When I say “Use Claude Design,” assume that designs will be provided back as either:
- Exported assets, or
- Design tokens/components we will encode in code.

---

## 9. Update policy

If you notice that:

- `BRD.md`, `PRD.md`, or `DESIGN_DOC.md` are outdated relative to the implementation, OR
- Architecture has evolved beyond what is written,

propose specific edits to those files. Keep the docs and code in sync.

---

By following this CLAUDE.md, you (Claude Code) should be able to:

- Understand the project’s purpose.
- Respect the product and UX constraints.
- Build the app incrementally and safely.
- Work as a reliable long-term collaborator.