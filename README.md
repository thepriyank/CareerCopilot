# Jobmagnate

Jobmagnate is an AI-powered, candidate-first platform that helps job seekers:

- Upload and parse resumes.
- Clarify their career goals and preferences.
- Generate an ATS-friendly master resume.
- Match to relevant jobs with explainable scores.
- Generate job-specific resumes and cover letters.
- Review and approve all AI-generated output.
- Identify skill gaps and discover relevant courses.
- Get structured feedback on their LinkedIn profile.

This repository contains product docs (BRD, PRD, design spec, feature prompts) that are meant to be used with Claude Code and Claude Design to build the app step by step.

## Repository structure

- `BRD.md` – Business Requirements Document: why this product exists, who it serves, and business goals.
- `PRD.md` – Product Requirements Document: what we’re building and the technical requirements.
- `DESIGN_DOC.md` – UX/UI design document describing flows, screens, and design system direction.
- `FEATURE_PROMPTS.md` – Feature-level prompts to expand each feature into a dev plan.
- `CLAUDE_DESIGN_PROMPT.md` – Prompt to feed into Claude Design to generate designs.
- `CLAUDE.md` – Instructions for Claude Code on how to work inside this repo.
- (Later) `/backend`, `/frontend`, `/mobile`, `/infra` etc. will be created as the implementation begins.

## How to use this repo with Claude Code

1. **Start in planning mode**  
   Open this repo in Claude Code. First, read `BRD.md`, `PRD.md`, and `DESIGN_DOC.md` to understand the product. Use Plan/Explore mode before editing files.

2. **Refine product and design if needed**  
   - For product-level changes, edit `BRD.md` and `PRD.md` with approval.
   - For UX/UI, update `DESIGN_DOC.md` and regenerate designs using Claude Design with `CLAUDE_DESIGN_PROMPT.md`.

3. **Use FEATURE_PROMPTS.md to expand features**  
   For each feature F1–F8:
   - Copy the corresponding prompt from `FEATURE_PROMPTS.md`.
   - Ask Claude Code to expand it into a phase-wise technical plan.
   - Optionally create feature-specific docs (e.g., `docs/F1_resume_parsing_plan.md`).

4. **Create implementation plan and project structure**  
   Once feature plans exist:
   - Define the initial architecture and tech stack.
   - Create `PROJECT_STRUCTURE.md` or `ARCHITECTURE.md` (Claude can help).
   - Scaffold backend and frontend directories and minimal code.

5. **Iterative implementation workflow**  
   For each feature:
   - Plan → Code → Review → Test → Commit.
   - Keep prompts and explanations in `docs/` so Claude Code can reference them.
   - Keep `CLAUDE.md` updated if conventions or commands change.

## Recommended development order (MVP)

1. F1 – Resume ingestion and parsing.
2. F2 – Candidate onboarding chat.
3. F3 – Master resume enhancement.
4. F4 – Job search and match scoring (start with pasted JDs).
5. F5 – Job-specific tailoring (resume + cover letter).
6. F6 – Review and approval workflow.
7. F7 – Skill-gap analysis and course suggestions.
8. F8 – LinkedIn review.

After MVP, we can add premium features, auto-apply workflows, and on-device LLM experiments.

## Design workflow with Claude Design

1. Open Claude Design and provide:
   - `DESIGN_DOC.md`
   - `CLAUDE_DESIGN_PROMPT.md`
2. Ask Claude Design to:
   - Generate a design system (colors, typography, components).
   - Create screen mockups for the core flows (desktop and mobile).
3. When satisfied, export the design bundle for handoff to Claude Code.
4. In Claude Code, implement UI components according to the design system.

## Contributing / working with Claude Code

- Always keep `CLAUDE.md` in sync with how you want Claude Code to behave.
- Prefer small, incremental changes with clear commit messages.
- Add new docs under `docs/` when needed, and link them from `README.md`.