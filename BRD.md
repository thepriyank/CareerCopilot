# Jobmagnate – Business Requirements Document (BRD)

## 1. Product name

Jobmagnate

## 2. Business vision

Build a candidate-first AI platform that helps job seekers present themselves better, match to relevant jobs, tailor applications, improve skills, and eventually build professional network reach with guided AI support. The product should reduce friction in job searching while keeping the user in control of every submission.

## 3. Problem statement

Job seekers spend extensive time rewriting resumes and cover letters for each role, often without knowing what ATS systems actually value or how to improve fit. Existing tools typically optimize either resume formatting or job search tracking, but not the full loop of profile understanding, matching, tailoring, review, and skill improvement in one trusted workflow.

## 4. Business objectives

- Help users create a strong master resume and job-specific variants.
- Improve application relevance and ATS compatibility.
- Increase interview callback probability through better tailoring.
- Convert skill gaps into structured upskilling actions.
- Build a paid premium layer around career growth and outreach later.

## 5. Business goals

- Reduce time spent on each application while improving quality.
- Increase number of high-quality applications submitted per active user.
- Improve user confidence by showing every AI-generated edit before submission.
- Create a scalable AI-first workflow that supports user API keys and hosted fallback models.
- Establish a platform that can later support LinkedIn optimization and recruiter outreach.

### 5.1 Success metrics

- Resume upload → completed profile conversion rate.
- Master resume creation rate per new user.
- Job match → job-view → apply rate.
- Approval rate on AI-edited resumes and cover letters.
- Skills-gap recommendation engagement (views, saves, clicks).
- Premium conversion rate from free to paid.
- Self-reported interview callback rate.

## 6. Target audience

- **Primary market: India.** The product, job-sourcing strategy, and market calibration (compensation ranges, notice-period norms, portal selection) are built India-first. International remote roles are in scope specifically where they are realistically open to India-based applicants.
- Freshers and entry-level candidates.
- Mid-level professionals switching roles.
- Tech, product, design, analytics, and operations roles.
- Privacy-conscious users who want local or user-key-based AI.
- Premium users seeking career acceleration and network growth later.

## 7. Scope

### 7.1 MVP in scope

- Resume upload and parsing (PDF, DOCX).
- User career onboarding interview/chat.
- Master resume enhancement into ATS-friendly format.
- Job search and matching, sourced only through channels that don't require storing a user's third-party credentials or violate a platform's terms of service: public per-company ATS APIs (curated toward India-hiring companies), remote job boards explicitly open to India-based candidates, licensed job-data aggregators (e.g. TheirStack-style providers), and user-pasted JDs. Naukri, Indeed, LinkedIn, and Wellfound/AngelList have no public self-serve job-search API as of this writing (Indeed's Publisher program closed to new applicants in 2023; Naukri and Wellfound have never offered one) — for these, pasting a JD manually remains the supported path until/unless a legitimate partner API becomes available.
- Per-job tailored resume generation.
- Per-job cover letter generation.
- Candidate review and approval flow for all AI output.
- Skill-gap analysis with topic and course suggestions (Udemy and similar).
- LinkedIn profile review feedback only (no automation).

### 7.2 Post-MVP (out of scope for first release)

- Auto-apply with approval checkpoints.
- LinkedIn content generation and scheduling.
- Recruiter discovery and outreach recommendations.
- Network expansion suggestions based on graph analysis.
- Direct learning platform integrations and in-app course delivery.
- On-device LLM execution as a supported feature.

## 8. Business constraints

- Candidate consent is mandatory before any application is exported or submitted.
- Generated content must not invent experience, skills, or qualifications.
- User data must be protected because resumes contain sensitive personal and employment data.
- Platform should support user-provided AI keys and server fallback models.
- Initial product should avoid heavy third-party dependencies that block launch.

## 9. Key risks and mitigations

- **Trust / accuracy risk**  
  Mitigation: Require user approval, show diffs, and allow manual edits.

- **Hallucination risk**  
  Mitigation: Constrain generation to extracted facts; use checks that compare outputs to known profile data.

- **Privacy and security risk**  
  Mitigation: Encrypt data at rest and in transit; clear data retention policy; allow deletion on request.

- **Bias in match scoring or recommendations**  
  Mitigation: Use transparent match explanations; allow user override; regularly review scoring logic.

- **Platform-policy risk (especially LinkedIn)**  
  Mitigation: Limit MVP to passive feedback; avoid automation that violates platform terms.

## 10. Business non-goals (for MVP)

- No fully autonomous job submissions without user intervention.
- No recruiter CRM or ATS replacement for employers.
- No mass outreach automation to recruiters.
- No direct course selling or deep edtech partnerships in v1.
- No requirement that on-device LLMs work before launch.

## 11. High-level roadmap

- Phase 1: Resume ingestion, onboarding, master resume, job matching, per-job tailoring, approval.
- Phase 2: Skill-gap analysis, course suggestions, LinkedIn review, analytics.
- Phase 3: Premium network features, auto-apply with safeguards, on-device LLM experiments.
  - "Auto-apply with safeguards" is deliberately not specified further than that phrase anywhere else in this document. Before any implementation work starts on it, it must clear all of the following, and this list is the gate, not a suggestion:
    - **OAuth-only.** No product code ever stores a user's raw password or session cookie for a third-party site. If a platform doesn't offer an official OAuth/partner API, it is not a candidate for auto-apply, full stop — scraping an authenticated session using a user's own credentials is still automated access under most platforms' terms, regardless of consent.
    - **Per-application human confirmation stays mandatory**, exactly as it already is everywhere else in this document (§8, §9, §10) — "safeguards" means a human clicks submit on every single application, not a batch approval.
    - **A written per-platform legal/ToS review**, done before integration work starts, not after.
    - **A security audit** of whatever credential/token storage the OAuth flow requires.
    - LinkedIn is out of consideration entirely per this document's existing constraints (§9, §10) unless those are separately revisited.