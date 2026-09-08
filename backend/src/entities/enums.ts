export enum Plan {
  FREE = 'FREE',
  PREMIUM = 'PREMIUM',
}

// How a user's identity was established — see User.ts's firebaseUid comment
// and routes/auth.routes.ts's POST /google. PASSWORD is the original/
// default flow (email + bcrypt); GOOGLE means they signed in via Firebase's
// Google provider and may have no passwordHash at all.
export enum AuthProvider {
  PASSWORD = 'PASSWORD',
  GOOGLE = 'GOOGLE',
}

export enum FileType {
  PDF = 'PDF',
  DOCX = 'DOCX',
}

export enum ParseStatus {
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REVIEW_NEEDED = 'REVIEW_NEEDED',
}

export enum RemotePreference {
  REMOTE = 'REMOTE',
  HYBRID = 'HYBRID',
  ONSITE = 'ONSITE',
  OPEN = 'OPEN',
}

export enum SearchUrgency {
  ACTIVELY_LOOKING = 'ACTIVELY_LOOKING',
  OPEN_TO_OPPORTUNITIES = 'OPEN_TO_OPPORTUNITIES',
  NOT_LOOKING = 'NOT_LOOKING',
}

export enum ArtifactStatus {
  DRAFT = 'DRAFT',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum ArtifactType {
  RESUME_VERSION = 'RESUME_VERSION',
  COVER_LETTER = 'COVER_LETTER',
}

export enum ResumeVersionType {
  ORIGINAL = 'ORIGINAL',
  MASTER = 'MASTER',
  TAILORED = 'TAILORED',
}

// How a user came to have a given JobListing in their list — see UserJob.
export enum JobOrigin {
  // System-wide discovery cron found it in the shared pool and it scored
  // well enough against this candidate's résumé to surface automatically
  // (see services/matching/surfaceJobs.ts). Replaces the old per-candidate
  // "DISCOVERED" meaning from before discovery became system-wide
  // (2026-09-06) — kept as a distinct value rather than renamed in place so
  // any pre-existing DISCOVERED rows from that era aren't silently
  // reinterpreted.
  MATCHED = 'MATCHED',
  DISCOVERED = 'DISCOVERED',
  PASTED = 'PASTED',
}
