# Jobmagnate – Feature Prompts for Claude

This file defines each major feature with a concise spec plus a ready-to-use prompt that Claude can expand into a phase-wise development plan, tickets, and technical details.

---

## F1 – Resume ingestion and parsing

**Description:**  
Ingest user resumes (PDF, DOCX), extract text, detect sections, normalize skills, and produce a structured `ParsedResume` that the user can review and correct.

**Prompt for Claude:**

“You are an AI software architect. Expand the F1 Resume Ingestion and Parsing feature into a detailed, phase-wise implementation plan.

Include:
- Ingestion pipeline (file upload, storage, virus scanning if any).
- Text extraction and section detection strategy.
- Entity and skill normalization approach and data structures.
- Confidence scoring logic and how it surfaces in the UI.
- Editable review UI for users to correct parsed data.
- API endpoints, request/response schemas.
- Database schema changes (tables/collections).
- Testing strategy and edge cases (e.g., image-only PDFs, multilingual, non-standard formats).
- Milestones from smallest viable version to a robust v1.

Output as a structured plan that can be turned into engineering tickets.”

---

## F2 – Candidate onboarding chat

**Description:**  
Interactive chat to collect career goals, target roles, industries, locations, salary expectations, remote preferences, and constraints, and map them into `CandidateProfile`.

**Prompt for Claude:**

“You are designing F2 Candidate Onboarding Chat for an AI career platform. Break it into a phase-wise plan.

Cover:
- Conversation states and flows (welcome, goals, preferences, constraints).
- Data fields and mapping to the CandidateProfile schema.
- Prompt design for extracting structured data from free-text answers.
- Validation and follow-up questions for ambiguous responses.
- UX decisions for buttons vs text input.
- Backend data model and APIs to save/update preferences.
- Analytics to track completion and drop-off.
- Test cases and edge cases (skipped questions, contradictory answers).

Return a clear implementation roadmap plus suggested prompt templates.”

---

## F3 – Master resume enhancement

**Description:**  
Transform parsed resume into an ATS-friendly, impact-focused master resume while preserving truthfulness and allowing user review.

**Prompt for Claude:**

“Act as a lead engineer and product writer for F3 Master Resume Enhancement.

Produce a phased plan that includes:
- Rules and prompts for converting bullets into impact/achievement statements.
- Section hierarchy for ATS-friendliness and best practices.
- Mechanism to ensure no fabricated roles, companies, or degrees are introduced.
- Diff rendering strategy between original and enhanced content.
- UX for user edits and acceptance of changes.
- Backend data structures to store versions and provenance.
- Evaluation metrics for ‘quality’ of enhanced resumes.
- Unit and integration testing considerations.

Output should be suitable for creating tickets for backend, frontend, and prompt engineering.”

---

## F4 – Job search and match scoring

**Description:**  
Ingest job descriptions (initially via paste; later via integrations), normalize them, compute match scores with candidate profile and resume, and surface explanation.

**Prompt for Claude:**

“For F4 Job Search and Match Scoring, build a detailed technical and product plan.

Include:
- MVP ingestion method (pasted JDs), and hooks for future job-board APIs.
- Normalization of titles, skills, experience level, location, salary where available.
- Embeddings strategy and storage (vector DB schema).
- Match scoring function combining semantic similarity and hard filters (e.g., location, years).
- Explanation generator (‘Matched skills’, ‘Missing skills’, ‘Preference alignment’).
- APIs for searching and retrieving matches.
- UI pattern for displaying ranked jobs and filters.
- Evaluation metrics (CTR, save rate, apply rate).
- Edge cases (very short JDs, extremely long JDs, conflicting requirements).

Return a structured plan plus pseudo-code or diagrams where helpful.”

---

## F5 – Job-specific tailoring (resume + cover letter)

**Description:**  
From master resume and job posting, generate a tailored resume and cover letter, show diffs, and require approval.

**Prompt for Claude:**

“You are designing F5 Job-Specific Tailoring. Expand it into a multi-phase implementation plan.

Cover:
- Prompt templates for generating tailored resumes from a master resume and JD.
- Prompt templates for tailored cover letters combining candidate profile, JD, and company info.
- Strategy for preserving truthfulness and avoiding hallucinated experience.
- Diff rendering for tailored resume vs master resume.
- Editor UX for both resume and cover letter (inline edits, regenerate section).
- APIs, data models for GeneratedResumeVersion and GeneratedCoverLetter.
- Approval workflow integration (states, transitions, logging).
- Performance considerations and caching strategies.

Return a detailed plan suitable for breaking down into tickets.”

---

## F6 – Review and approval workflow

**Description:**  
Every AI-generated artifact must be reviewable, editable, and explicitly approved before export or submission.

**Prompt for Claude:**

“Design F6 Review and Approval Workflow as a state machine and application feature.

Include:
- Artifact states (Draft, In Review, Approved, Rejected).
- Backend representation and transitions.
- UI patterns (status indicators, filters, actions).
- Audit log schema for tracking changes and approvals.
- How regeneration interacts with approval (e.g., reverts to Draft).
- Permission model (who can approve).
- Integration with export and submission flows so they require ‘Approved’ status.
- Testing plan covering typical and edge flows.

Output the plan with diagrams or clear textual descriptions.”

---

## F7 – Skill-gap analysis and course suggestions

**Description:**  
Analyze candidate profile and target jobs to surface missing skills and recommend external courses and learning paths.

**Prompt for Claude:**

“Act as a product and ML architect for F7 Skill-Gap Analysis and Course Suggestions.

Plan:
- Data sources for skill gaps (target roles, matched jobs, candidate profile).
- Skill taxonomy and normalization approach.
- Scoring and ranking logic for gaps (impact, frequency, effort).
- Recommendation engine for linking gaps to external courses (e.g., search/query APIs).
- UX for displaying gaps, priorities, and suggested courses.
- Data model for SkillGapReport and CourseRecommendation.
- Analytics: which suggestions users click or save.
- Future extensibility for direct LMS integration.

Return a rigorous roadmap and pseudo-code for key algorithms.”

---

## F8 – LinkedIn review (MVP)

**Description:**  
Provide structured feedback on a LinkedIn-like profile (headline, about, experience, skills) to better align with target roles.

**Prompt for Claude:**

“For F8 LinkedIn Review, design a feature roadmap.

Include:
- Input methods (pasted profile vs fields).
- Analysis rubric for headline, about, experience bullets, skills.
- Prompt templates to generate feedback and example improvements.
- Data model for LinkedInReviewReport.
- UI for section-by-section feedback with suggested rewrites.
- Hooks for future premium features (content calendar, outreach templates).
- Guardrails to avoid violating platform automation policies.

Return an implementation plan plus draft prompts for analysis and suggestions.”