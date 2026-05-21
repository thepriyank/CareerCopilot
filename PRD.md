# AI Career Copilot – Product Requirements Document (PRD)

## 1. Product overview

AI Career Copilot is a web and mobile platform that ingests a candidate’s resume, learns about their career goals through guided chat, generates an improved master resume, matches relevant jobs, produces job-specific resumes and cover letters, and presents everything for human review and approval before export or application.

AI is positioned as an assistive layer, not a fully autonomous actor. The system must be transparent, traceable, and respectful of user control.

## 2. Product principles

- Human-in-the-loop for all outward actions.
- Truthful, evidence-based generation.
- Personalization over generic automation.
- Explainable recommendations (show “why” for matches and edits).
- Privacy and data security by design.
- Modular AI components with swappable models.

## 3. User roles

- **Candidate:** Main end user.
- **Premium Candidate:** Candidate with access to advanced features (e.g., advanced LinkedIn review, expanded analytics).
- **Admin:** Internal operator for configuration, issue resolution.
- **Support / Reviewer:** Internal or contractor role to inspect logs and help users.

Recruiter-facing roles are not part of MVP.

## 4. Core data objects

- `User` (id, email, auth, region, plan, settings).
- `ResumeFile` (id, userId, fileUrl, fileType, uploadTimestamp).
- `ParsedResume` (id, userId, sourceFileId, sections, extractedEntities, confidenceScores).
- `CandidateProfile` (id, userId, preferences, goals, constraints).
- `JobPosting` (id, source, url, normalizedFields, rawDescription).
- `MatchResult` (id, userId, jobId, score, rationale, gaps).
- `GeneratedResumeVersion` (id, userId, jobIdOptional, content, provenance, diffFrom).
- `GeneratedCoverLetter` (id, userId, jobId, content, provenance).
- `ApprovalRecord` (id, userId, artifactId, artifactType, status, timestamp).
- `SkillGapReport` (id, userId, roleContext, missingSkills, priorityRanking).
- `CourseRecommendation` (id, userId, skillGapId, provider, url, metadata).
- `LinkedInReviewReport` (id, userId, sections, suggestions).
- `ModelUsageRecord` (id, userId, modelName, apiKeySource, tokensUsed, costEstimate).

## 5. System architecture (high-level)

- **API gateway / backend** (Node.js/TS or Python):  
  Exposes REST/GraphQL endpoints for all clients (web/mobile). Handles authentication, rate limiting, logging.

- **AI Orchestrator service:**  
  Encapsulates all LLM calls, embeddings, and prompt templates. Supports:
  - User-supplied API keys.
  - Fallback to open-source models hosted on your infra.
  - Model selection per task.

- **Parsing service:**  
  Resume/JD ingestion, OCR where needed, section detection, entity extraction, skill normalization.

- **Matching service:**  
  Embeddings-based similarity plus rules (e.g., location, years of experience).

- **Generation service:**  
  Resume rewriting, job-specific tailoring, cover letters, skill-gap explanations, LinkedIn suggestions.

- **Storage:**  
  SQL or document DB for core entities, vector DB for embeddings, object storage for raw files.

- **Analytics / logging:**  
  Centralized logs, prompt+response storage (with PII minimization), usage dashboards.

- **Frontends:**  
  - Web app (React/Next).
  - Mobile app (React Native/Flutter) consuming same backend.

## 6. Functional requirements (MVP)

### 6.1 Resume ingestion and parsing

- Accept PDF and DOCX uploads.
- Extract text; detect sections (summary, experience, education, skills, projects, certifications).
- Normalize skills into a controlled vocabulary (where possible).
- Compute confidence per extracted field.
- Store a parsed representation linked to the original file.
- Present extracted data to user for review and correction.

### 6.2 Candidate onboarding chat

- Guide user through questions about goals, target roles, industries, locations, salary expectations, remote preference, job-search urgency, and constraints (notice period, visa, etc.).
- Map responses to structured fields on `CandidateProfile`.
- Allow user to skip non-critical questions.
- Provide an onboarding completion summary.

### 6.3 Master resume enhancement

- Generate an ATS-friendly master resume from parsed resume and candidate profile.
- Improve clarity and impact of bullet points (achievement-oriented).
- Reorganize sections for best practice ATS layout.
- Respect truthfulness: no invented roles, skills, or achievements.
- Provide a diff view against the original content.
- Allow user edits before saving as “Master Resume v1”.

### 6.4 Job search and match scoring

- Allow user to:
  - Paste job descriptions.
  - Or browse jobs from integrated job sources (phase 1 may start with pasted JDs only).
- For each job:
  - Normalize job data (title, skills, experience level, location, salary).
  - Compute a match score using embeddings and rule-based filters.
  - Show match explanation: matched skills, missing skills, and alignment to preferences.

### 6.5 Job-specific tailoring

- For each job the user selects:
  - Generate a tailored resume variant from Master Resume.
  - Emphasize relevant skills and experience.
  - Generate a tailored cover letter incorporating:
    - Candidate background.
    - Career goals.
    - Job description.
    - Known company info (if provided).
- Show resume and cover letter for review.
- Support inline edits and regeneration of specific sections.

### 6.6 Review and approval workflow

- Every generated artifact (master resume, tailored resume, cover letter) must have:
  - Status: Draft → Reviewed → Approved.
- User must explicitly mark artifacts as Approved before export or submission.
- Keep versions and change history.
- Log approvals in `ApprovalRecord`.

### 6.7 Skill-gap analysis and course suggestions

- Analyze patterns across:
  - Target jobs.
  - Candidate profile.
  - Master resume.
- Identify missing or underrepresented skills and concepts.
- Produce a `SkillGapReport` ranked by impact.
- For each gap, suggest:
  - Skill topic.
  - External course links (e.g., Udemy) with basic metadata.
- Let users save learning goals to their profile.

### 6.8 LinkedIn review (MVP)

- Allow user to either:
  - Paste LinkedIn profile text.
  - Or fill fields similar to LinkedIn (headline, about, experience).
- Analyze:
  - Clarity and impact.
  - Alignment with target roles.
  - Keyword coverage.
- Produce a `LinkedInReviewReport`:
  - Section-level feedback.
  - Suggested headline examples.
  - Suggested summary structure.
- No automated LinkedIn actions in MVP.

## 7. Non-functional requirements (NFRs)

- **Performance:**  
  - Parsing and initial profile generation should complete within a reasonable latency target (e.g., 5–10 seconds on normal resumes).
  - Match scoring per job should feel near-instant (<2 seconds) after data is available.

- **Security & privacy:**  
  - Encrypt data at rest and in transit.
  - Allow users to delete their account and associated data.
  - Separate logs and PII where possible.

- **Reliability:**  
  - Graceful degradation if AI provider is unavailable.
  - Clear error messages and retry options.

- **Observability:**  
  - Log all AI calls with anonymized metadata.
  - Track feature usage and success metrics.

## 8. AI model strategy

- **Model types:**
  - Embedding model for similarity search (resume ↔ job, skills, courses).
  - Instruction-tuned small/medium model for rewriting, summarization, and matching explanations.
  - Larger model (via user-provided API key) for high-quality cover letters and nuanced edits.

- **Sources:**
  - User-provided API keys (e.g., OpenAI, Anthropic) configured in settings.
  - Open-source fallback models hosted on your server, with appropriate licenses.

- **Selection logic:**
  - If user key exists and is valid, use that for generation-heavy tasks.
  - Else, use your hosted open-source model for basic functionality.
  - Always use your own embeddings pipeline for scoring.

## 9. Guardrails and safety

- Compare generated resume and cover letter text to extracted facts:
  - Flag potential hallucinations (new employers, roles, degrees).
- Keep a “truth layer” of verified facts and restrict generation prompts to them.
- Explicit UX copy stating user is responsible for final content.
- Clear display of model/source (e.g., “Generated using your API key” vs “Platform model”).

## 10. Feature-level breakdown (see FEATURE_PROMPTS.md)

Each feature has:
- Description.
- Technical details.
- Acceptance criteria.
- A dedicated prompt for Claude to expand into a phase-wise plan.

This PRD defines the overall product and the technical expectations; `FEATURE_PROMPTS.md` is the operational layer Claude Code can use to break down implementation.