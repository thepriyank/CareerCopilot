# F2 – Candidate Onboarding Chat: Implementation Plan

## Overview

F2 guides a newly registered user through a short conversational flow that collects career goals, preferences, and constraints. Answers are mapped to a `CandidateProfile` in the database. The conversation is driven by Claude Haiku for NLU extraction, not free-form LLM chat.

---

## Conversation States

The onboarding proceeds through a fixed sequence of states. Each state corresponds to one question asked by the AI.

| State | Question Topic | Required? |
|-------|---------------|-----------|
| `WELCOME` | Introduction — confirm ready to start | Yes |
| `TARGET_ROLES` | Target job titles / roles | Yes |
| `INDUSTRIES` | Preferred industries | Yes |
| `LOCATIONS` | Geographic preferences | Yes |
| `REMOTE_PREFERENCE` | Remote / Hybrid / On-site | Yes |
| `SALARY` | Expected salary range | Skippable |
| `URGENCY` | How actively looking | Yes |
| `NOTICE_PERIOD` | Notice period at current role | Skippable |
| `VISA_STATUS` | Work authorisation | Skippable |
| `DONE` | Completion message | — |

---

## Data Mapping to CandidateProfile

| State | Extracted Fields | CandidateProfile Fields |
|-------|-----------------|------------------------|
| TARGET_ROLES | `targetRoles: string[]` | `targetRoles` |
| INDUSTRIES | `industries: string[]` | `industries` |
| LOCATIONS | `locations: string[]` | `locations` |
| REMOTE_PREFERENCE | `remotePreference: enum` | `remotePreference` |
| SALARY | `salaryMin, salaryMax, salaryCurrency` | `salaryMin, salaryMax, salaryCurrency` |
| URGENCY | `urgency: enum` | `urgency` |
| NOTICE_PERIOD | `noticePeriod: string` | `noticePeriod` |
| VISA_STATUS | `visaStatus: string` | `visaStatus` |

The `completionScore` (0–100) increments with each completed state.

---

## NLU Extraction Strategy

Each user answer is sent to Claude Haiku with a focused prompt:
```
You are extracting structured data from: "[answer]"
To question: "[question]"
Return JSON: {schema}
```

This avoids full conversational LLM overhead and keeps latency low.

Example extractions:
- "I'm looking for PM or Product Manager roles" → `{ "targetRoles": ["Product Manager", "PM"] }`
- "Remote first, but open to hybrid in NYC" → `{ "remotePreference": "HYBRID", "locations": ["New York, NY"] }`
- "$90k to $120k USD" → `{ "salaryMin": 90000, "salaryMax": 120000, "salaryCurrency": "USD" }`
- "skip" → `{}` (no update)

---

## API Endpoint

```
POST /api/profile/onboarding
Authorization: Bearer <token>

Request:
{
  "message": "string",          // User's answer to current question
  "state": "WELCOME"            // Optional — client tracks state; server also stores it
}

Response:
{
  "message": "string",          // Next question or completion message
  "state": "TARGET_ROLES",      // New state after processing
  "profileUpdates": { ... },    // Data that was extracted and saved
  "isComplete": false,
  "completionScore": 15,
  "nextQuestion": "..."
}
```

---

## Frontend Chat UX

### Design Principles (from DESIGN_DOC.md)
- Chat-like bubble interface (AI on left, user on right)
- Quick-reply chips for common answers where applicable
- Progress bar showing completion score
- "Skip" option for non-required questions
- Completion summary before navigating away

### Component: `OnboardingChat`

State machine:
```
idle → loading → answer_sent → loading → next_question → ...
```

User interaction flow:
1. Page loads → show welcome message + text input
2. User types answer → POST `/api/profile/onboarding`
3. Show loading indicator
4. Receive response → show bot reply (next question) in bubble
5. Repeat until `isComplete: true`
6. Show completion card: "Profile is ready! Upload your resume →"

### Quick-reply chips per state
- `REMOTE_PREFERENCE`: [Remote] [Hybrid] [On-site] [Open to all]
- `URGENCY`: [Actively applying] [Open to opportunities] [Just exploring]

---

## Database Schema (CandidateProfile)

```prisma
model CandidateProfile {
  id               String           @id @default(uuid())
  userId           String           @unique
  targetRoles      String[]
  industries       String[]
  locations        String[]
  remotePreference RemotePreference @default(OPEN)
  salaryMin        Int?
  salaryMax        Int?
  salaryCurrency   String           @default("USD")
  urgency          SearchUrgency    @default(ACTIVELY_LOOKING)
  noticePeriod     String?
  visaStatus       String?
  summary          String?
  completionScore  Int              @default(0)
  onboardingState  String           @default("WELCOME")
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt
}
```

---

## Validation and Edge Cases

| Case | Handling |
|------|----------|
| User skips a required question | Accept "skip" keyword; keep field empty; advance state |
| Contradictory answers | Accept latest answer; user can update from profile settings later |
| Very long answer | Truncate to 1000 chars before sending to Claude |
| Claude NLU returns nothing | Keep existing field value; advance state anyway |
| User refreshes mid-flow | State persisted in DB; restore from `profile.onboardingState` |
| User has no API key | Use platform API key (same as F1 parsing) |

---

## Analytics Events to Track

- `onboarding_started` — first turn sent
- `onboarding_step_completed` — per state transition
- `onboarding_completed` — when DONE is reached
- `onboarding_dropped` — session ended without DONE (via timeout or navigation)

---

## Test Cases

### Unit Tests
- `extractProfileUpdate('SALARY', '$80k-$120k')` → `{ salaryMin: 80000, salaryMax: 120000, salaryCurrency: 'USD' }`
- `extractProfileUpdate('REMOTE_PREFERENCE', 'Remote only')` → `{ remotePreference: 'REMOTE' }`
- `extractProfileUpdate('TARGET_ROLES', 'skip')` → `{}`
- `normaliseRemotePreference('ON-SITE')` → `'ONSITE'`
- `normaliseUrgency('actively looking')` → handled gracefully

### Integration Tests
- Full onboarding flow from WELCOME to DONE: profile created with all fields.
- Skip optional states: profile saved without those fields.
- Resuming: second session starts from stored `onboardingState`.

---

## Milestones

| Milestone | Description | Status |
|-----------|-------------|--------|
| M1 | `/api/profile/onboarding` endpoint processes one turn | ✅ Done |
| M2 | Full state machine from WELCOME → DONE | ✅ Done |
| M3 | Frontend chat UI renders questions and answers | ✅ Done |
| M4 | Quick-reply chips for REMOTE_PREFERENCE and URGENCY | ✅ Done |
| M5 | Profile completion screen with edit capability | Pending |
| M6 | Analytics events | Pending |
