# F1 – Resume Ingestion and Parsing: Implementation Plan

## Overview

F1 ingests a user's resume (PDF or DOCX), extracts raw text, detects sections, extracts structured entities using Claude, computes confidence scores, persists the result, and presents it to the user for review and correction.

---

## Phase 1 – Smallest Viable Slice (done first)

**Goal:** Upload a file, extract raw text, store it, return a basic parsed result.

### Tasks
1. `POST /api/resumes/upload`
   - Accept `multipart/form-data` with a `file` field.
   - Validate MIME type: `application/pdf` or `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
   - Validate max size: 10 MB.
   - Save file to `backend/uploads/<uuid>.<ext>`.
   - Create `ResumeFile` record in DB.
   - Extract raw text (pdf-parse for PDF, mammoth for DOCX).
   - Return `{ resumeFileId, rawText: first 200 chars, status: 'PROCESSING' }`.
2. Basic smoke test: upload a PDF and get a 200 back.

---

## Phase 2 – Section Detection + AI Entity Extraction

**Goal:** Turn raw text into structured sections and entities using Claude Haiku.

### Section Detection (`sectionDetector.ts`)

Algorithm:
1. Split text into lines.
2. For each line, check against a map of regex patterns per section type.
3. Assign content between matched headers to the identified section.
4. Return `ResumeSection[]`.

Supported section types:
- `summary` – "Summary", "Profile", "Objective", "About"
- `experience` – "Work Experience", "Professional Experience", "Employment History"
- `education` – "Education", "Academic Background", "Degrees"
- `skills` – "Skills", "Technical Skills", "Core Competencies", "Technologies"
- `projects` – "Projects", "Personal Projects", "Side Projects"
- `certifications` – "Certifications", "Licenses & Certifications", "Credentials"
- `other` – fallback bucket

### Entity Extraction (`entityExtractor.ts`)

Send the raw text to Claude Haiku with a structured extraction prompt.

**Prompt template:**
```
You are a professional resume parser. Extract structured information from this resume text.

RULES:
- Only extract information explicitly stated in the text.
- Do NOT invent, infer, or add any information.
- If a field is absent, omit it from the output.
- Preserve the exact wording of bullet points.
- For dates, preserve original format (e.g., "Jan 2020", "2018–2021", "Present").

Return valid JSON matching this exact schema:
{
  "contact": { "name": "...", "email": "...", "phone": "...", "location": "...", "linkedin": "...", "website": "..." },
  "summary": "...",
  "experience": [
    { "company": "...", "title": "...", "location": "...", "startDate": "...", "endDate": "...", "current": false, "bullets": ["..."] }
  ],
  "education": [
    { "institution": "...", "degree": "...", "field": "...", "startDate": "...", "endDate": "...", "gpa": "..." }
  ],
  "skills": [{ "name": "...", "category": "..." }],
  "certifications": [{ "name": "...", "issuer": "...", "date": "..." }],
  "projects": [{ "name": "...", "description": "...", "technologies": ["..."], "url": "..." }]
}

RESUME TEXT:
{resumeText}
```

### Confidence Scoring

Compute `ConfidenceScores` based on:
| Field | Scoring rule |
|-------|-------------|
| `overall` | Weighted average of sub-scores |
| `name` | 1.0 if found, 0 if not |
| `email` | 1.0 if valid email regex, 0.5 if found but malformed |
| `phone` | 1.0 if found |
| `experience` | 1.0 if ≥1 role, 0.7 if roles found but no bullets, 0 if empty |
| `education` | 1.0 if ≥1 degree, 0 if empty |
| `skills` | 1.0 if ≥5 skills, 0.5 if 1–4, 0 if empty |

### API Endpoints

```
POST /api/resumes/upload
  Body: multipart/form-data { file }
  Response 200: { resumeFile: ResumeFile, parsedResume: ParsedResume }
  Response 400: { error: { code: 'INVALID_FILE_TYPE' | 'FILE_TOO_LARGE', message } }

GET /api/resumes
  Response 200: { resumes: Array<ResumeFile & { parsedResume: ParsedResume | null }> }

GET /api/resumes/:fileId
  Response 200: { resumeFile: ResumeFile, parsedResume: ParsedResume | null }
  Response 404: not found

PUT /api/resumes/parsed/:parsedResumeId
  Body: { sections?, extractedEntities?, notes? }
  Response 200: { parsedResume: ParsedResume }
```

---

## Phase 3 – UI for Review and Correction

**Goal:** User sees a structured view of parsed data and can edit fields.

### Frontend Views

1. **Upload page** (`/resume/upload`)
   - Drag-and-drop zone with file-type guidance.
   - Upload progress indicator.
   - On success: redirect to parsed resume view.
   - On error: inline error message + retry.

2. **Parsed resume view** (`/resume/[id]`)
   - Sections: Contact info, Summary, Experience, Education, Skills, Projects, Certifications.
   - Each section shows extracted content.
   - Confidence badge (green ≥ 0.8, amber 0.5–0.79, red < 0.5).
   - Inline edit: click a field to edit, auto-save on blur via `PUT /api/resumes/parsed/:id`.
   - "Looks good, proceed to onboarding →" CTA once overall confidence ≥ 0.6.

---

## Phase 4 – Edge Cases and Robustness

### Edge Cases
| Case | Handling |
|------|----------|
| Image-only PDF | pdf-parse returns empty string; respond with `status: REVIEW_NEEDED` and message "Your PDF appears to be image-based. Please upload a text-based PDF or paste your resume text." |
| Very large PDF (100+ pages) | Cap text extraction at 50 000 characters to avoid token overflow |
| Multi-language resume | Claude handles English + Latin scripts; flag non-English with `language: 'unknown'` in extracted entities |
| Malformed DOCX | Wrap mammoth call in try/catch; return `PARSE_FAILED` with retry option |
| Duplicate upload | Allow; create a new `ResumeFile` and `ParsedResume`; let user choose their active resume |
| Missing contact section | Confidence scores penalise missing fields; prompt user to review |

---

## Database Schema

```prisma
model ResumeFile {
  id          String      @id @default(uuid())
  userId      String
  fileUrl     String                         // relative path: "uploads/<uuid>.pdf"
  fileType    FileType                       // PDF | DOCX
  fileName    String                         // original file name
  fileSize    Int                            // bytes
  uploadedAt  DateTime    @default(now())
  parsedResume ParsedResume?
}

model ParsedResume {
  id                String      @id @default(uuid())
  userId            String
  sourceFileId      String      @unique
  sections          Json        // ResumeSection[]
  extractedEntities Json        // ExtractedEntities
  confidenceScores  Json        // ConfidenceScores
  rawText           String?     @db.Text
  status            ParseStatus // PROCESSING | COMPLETED | FAILED | REVIEW_NEEDED
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
}
```

---

## Testing Plan

### Unit Tests
- `sectionDetector.ts`: 10+ cases covering common headers, ALL-CAPS headers, mixed-case, sections with no content, extra whitespace.
- `entityExtractor.ts`: mock Claude response; verify entities mapped correctly; verify empty response handled gracefully.
- `resumeParser.ts`: mock pdf-parse and mammoth; verify full pipeline returns expected `ParsedResumeData`.

### Integration Tests (Phase 2)
- Upload a real PDF fixture → verify `ParsedResume` created in test DB.
- Upload a real DOCX fixture → same.
- Upload an oversized file → verify 400 response.
- Upload an invalid type → verify 400 response.

### Fixtures
- `tests/fixtures/sample_resume.pdf` – standard single-page resume
- `tests/fixtures/sample_resume.docx` – same content in DOCX
- `tests/fixtures/image_only.pdf` – scanned PDF (no text layer)

---

## Milestones

| Milestone | Description | Status |
|-----------|-------------|--------|
| M1 | File upload stored, raw text extracted, API returns 200 | ✅ Done (Phase 1) |
| M2 | Section detection + Claude entity extraction + confidence scores | ✅ Done (Phase 2) |
| M3 | Frontend upload form + parsed resume view | ✅ Done (Phase 2) |
| M4 | Inline editing of parsed fields | In progress |
| M5 | Edge case handling (image PDF, large files) | Pending |
| M6 | Full unit + integration test suite | Pending |
