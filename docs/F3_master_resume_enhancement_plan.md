# F3 – Master Resume Enhancement: Implementation Plan

## Overview
F3 transforms a parsed resume (from F1) and a candidate profile (from F2) into an ATS-friendly, impact-focused master resume. This process preserves the candidate's factual truthfulness while elevating the language. The user can review the changes (diffs), accept/reject them, and finalize the master resume.

---

## Architecture & Data Flow

1. **Input:** `ParsedResume` (extracted entities) + `CandidateProfile` (target roles, preferences).
2. **AI Processing:** Send bullets and summary to Claude Haiku/Sonnet with a strict prompt to enhance them using the STAR (Situation, Task, Action, Result) method and active verbs, without hallucinating metrics or skills.
3. **Output:** `MasterResume` draft.
4. **Review UX:** Side-by-side or inline diff showing original vs. enhanced text.
5. **Approval:** User can edit inline, regenerate a section, or approve the entire document.

---

## Database Schema (Prisma)

```prisma
model MasterResume {
  id               String   @id @default(uuid())
  userId           String   @unique
  sourceParsedId   String?  // Reference to ParsedResume
  content          Json     // The enhanced resume data (similar to ExtractedEntities)
  status           String   @default("DRAFT") // DRAFT, REVIEWING, APPROVED
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

---

## AI Prompt Strategy

**Goal:** Enhance bullet points.
**Prompt Template:**
```
You are an expert resume writer. Enhance the following resume bullet points for a candidate targeting {targetRoles}.
Rules:
1. Start each bullet with a strong action verb.
2. Focus on impact and results. If metrics are present, highlight them. If not, do NOT invent them.
3. Do NOT add new skills, tools, or experiences that are not in the original text.
4. Keep the tone professional, concise, and ATS-friendly.

Original Bullets:
{bullets}

Return a JSON array of enhanced strings.
```

---

## API Endpoints

- `POST /api/resume/master/generate`
  - Body: `{ parsedResumeId }`
  - Action: Fetches ParsedResume & Profile, runs AI enhancement, creates MasterResume(DRAFT).
- `GET /api/resume/master`
  - Action: Fetches the user's current MasterResume.
- `PUT /api/resume/master/:id`
  - Body: `{ content, status }`
  - Action: Updates the resume (e.g., user manual edits or status change to APPROVED).

---

## Frontend UX

### Component: `MasterResumeEditor`
1. **Generation State:** Loading spinner while AI enhances the resume.
2. **Diff View:** For each section (Summary, Experience), show the original text on the left and the enhanced text on the right (or use a rich text diff view).
3. **Controls:**
   - "Accept All" / "Reject All"
   - Individual edit buttons for each enhanced bullet.
   - "Regenerate" button with a custom instruction input (e.g., "Make it shorter").
4. **Completion:** "Approve Master Resume" button to finalize.

---

## Milestones

| Milestone | Description | Status |
|-----------|-------------|--------|
| M1 | Backend: Prisma schema update for `MasterResume` | Pending |
| M2 | Backend: `/api/resume/master/generate` endpoint with Claude integration | Pending |
| M3 | Frontend: Master resume generation trigger and loading state | Pending |
| M4 | Frontend: Diff view for reviewing enhanced content | Pending |
| M5 | Frontend: Editing, regenerating, and approval flow | Pending |
| M6 | Integration: End-to-end flow from F1 -> F2 -> F3 | Pending |
