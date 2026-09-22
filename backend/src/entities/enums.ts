export enum Plan {
  FREE = 'FREE',
  PREMIUM = 'PREMIUM',
}

// Which specific pass a PREMIUM user is actually on — `Plan.PREMIUM` alone
// doesn't distinguish "on the free trial" from "bought a 3-month pass",
// which the Settings -> Plan page needs to say so (and the business needs
// to be able to query). Null for a FREE user with no active or past pass.
// Values for the three paid tiers deliberately match
// services/payments/passPricing.ts's `PassType` string-for-string, so a
// purchased pass can be assigned here directly with no translation.
export enum PlanTier {
  TRIAL = 'TRIAL',
  ONE_MONTH = 'ONE_MONTH',
  THREE_MONTH = 'THREE_MONTH',
  ANNUAL = 'ANNUAL',
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

// Lifecycle state of a shared JobListing — see JobListing.ts's `status`/
// `expiredAt` comment and services/jobs/jobCleanup.ts for the rules that
// move a listing between these.
export enum JobListingStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
}

// Why a candidate marked a job "not interested" (see UserJob.notInterestedAt
// et al.) — a structured category, not just a free-text note, specifically
// so this data can later feed the matching algorithm as a real preference
// signal (2026-09-21 product decision: capture it now, wire it into scoring
// later — see NM-27 in Jira). Named to line up with the axes matchScore.ts
// already reasons about (seniority, salary, location, skills) rather than
// inventing a separate taxonomy — ROLE_TOO_JUNIOR/ROLE_TOO_SENIOR map
// directly to experienceFit.ts's 'overqualified'/'underqualified'.
export enum NotInterestedReason {
  ROLE_TOO_JUNIOR = 'ROLE_TOO_JUNIOR',
  ROLE_TOO_SENIOR = 'ROLE_TOO_SENIOR',
  SALARY_TOO_LOW = 'SALARY_TOO_LOW',
  LOCATION_MISMATCH = 'LOCATION_MISMATCH',
  SKILLS_MISMATCH = 'SKILLS_MISMATCH',
  WRONG_ROLE_TYPE = 'WRONG_ROLE_TYPE',
  COMPANY = 'COMPANY',
  OTHER = 'OTHER',
}

// In-app notification types — see entities/Notification.ts and
// services/notifications/passExpiryNotifier.ts. One value today
// (PASS_EXPIRING); designed to grow rather than be reused loosely, since
// `meta` shape differs per type.
export enum NotificationType {
  PASS_EXPIRING = 'PASS_EXPIRING',
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
