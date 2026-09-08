// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  name?: string | null
  plan: 'FREE' | 'PREMIUM'
  region?: string | null
  createdAt: string
}

// ─── Resume File ──────────────────────────────────────────────────────────────

export interface ResumeFile {
  id: string
  userId: string
  fileUrl: string
  fileType: 'PDF' | 'DOCX'
  fileName: string
  fileSize: number
  uploadedAt: string
  parsedResume?: ParsedResume | null
}

// ─── Parsed Resume ────────────────────────────────────────────────────────────

export type SectionType =
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'
  | 'publications'
  | 'volunteering'
  | 'languages'
  | 'other'

export interface ResumeSection {
  type: SectionType
  title: string
  content: string
  confidence: number
}

export interface WorkExperience {
  id: string
  company: string
  title: string
  location?: string
  startDate?: string
  endDate?: string
  current?: boolean
  bullets: string[]
}

export interface Education {
  id: string
  institution: string
  degree?: string
  field?: string
  startDate?: string
  endDate?: string
  gpa?: string
}

export interface Skill {
  id: string
  name: string
  category?: string
}

export interface Certification {
  id: string
  name: string
  issuer?: string
  date?: string
}

export interface Project {
  id: string
  name: string
  description: string
  technologies?: string[]
  url?: string
}

export interface ContactInfo {
  name?: string
  email?: string
  phone?: string
  location?: string
  linkedin?: string
  website?: string
}

export interface ExtractedEntities {
  contact: ContactInfo
  summary?: string
  experience: WorkExperience[]
  education: Education[]
  skills: Skill[]
  certifications: Certification[]
  projects: Project[]
}

export interface ConfidenceScores {
  overall: number
  name: number
  email: number
  phone: number
  experience: number
  education: number
  skills: number
}

export interface ParsedResume {
  id: string
  userId: string
  sourceFileId: string
  sections: ResumeSection[]
  extractedEntities: ExtractedEntities
  confidenceScores: ConfidenceScores
  rawText?: string | null
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REVIEW_NEEDED'
  createdAt: string
  updatedAt: string
}

// ─── Candidate Profile ────────────────────────────────────────────────────────

export type RemotePreference = 'REMOTE' | 'HYBRID' | 'ONSITE' | 'OPEN'
export type SearchUrgency = 'ACTIVELY_LOOKING' | 'OPEN_TO_OPPORTUNITIES' | 'NOT_LOOKING'

export type OnboardingState =
  | 'WELCOME'
  | 'TARGET_ROLES'
  | 'INDUSTRIES'
  | 'LOCATIONS'
  | 'REMOTE_PREFERENCE'
  | 'SALARY'
  | 'URGENCY'
  | 'NOTICE_PERIOD'
  | 'VISA_STATUS'
  | 'DONE'

export interface CandidateProfile {
  id: string
  userId: string
  targetRoles: string[]
  industries: string[]
  locations: string[]
  remotePreference: RemotePreference
  salaryMin?: number | null
  salaryMax?: number | null
  salaryCurrency: string
  urgency: SearchUrgency
  noticePeriod?: string | null
  visaStatus?: string | null
  summary?: string | null
  completionScore: number
  onboardingState: OnboardingState
  createdAt: string
  updatedAt: string
}

export interface OnboardingTurn {
  message: string
  state: OnboardingState
  profileUpdates: Record<string, unknown>
  isComplete: boolean
  completionScore: number
  nextQuestion?: string
}

// ─── Generated Resumes ────────────────────────────────────────────────────────

export type ArtifactStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED'
export type ResumeVersionType = 'ORIGINAL' | 'MASTER' | 'TAILORED'

export interface GeneratedResumeVersion {
  id: string
  userId: string
  jobId?: string | null
  sourceResumeId?: string | null
  source?: ParsedResume | null   // populated when loaded with relations
  content: ExtractedEntities
  provenance?: Record<string, unknown>
  diffFromId?: string | null
  type: ResumeVersionType
  status: ArtifactStatus
  createdAt: string
  updatedAt: string
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardTopMatch {
  jobId: string
  title: string
  company: string | null
  location: string | null
  isRemote: boolean | null
  score: number
  matchedSkills: string[]
  missingSkills: string[]
}

export interface DashboardActivity {
  description: string
  at: string
}

export interface DashboardData {
  masterResume: { status: ArtifactStatus; updatedAt: string } | null
  matchesThisWeek: number
  pendingApprovalCount: number
  reviewedCount: number
  approvalRate: number | null
  topMatches: DashboardTopMatch[]
  recentActivity: DashboardActivity[]
  topSkillGap: AggregatedGap | null
  linkedIn: { overallScore: number | null; headlineRewrite: string | null } | null
}

// ─── Skill roadmap (F7) ───────────────────────────────────────────────────────

export interface AggregatedGap {
  skill: string
  weight: number
  frequency: number
  tier: 'critical' | 'high' | 'medium' | 'low'
}

export interface CourseSuggestion {
  provider: string
  title: string
  url: string
}

// ─── LinkedIn review (F8) ─────────────────────────────────────────────────────

export type LinkedInSectionKey = 'headline' | 'about' | 'experience' | 'skills'

export interface LinkedInSectionFeedback {
  score: number
  narrative: string
}

export interface LinkedInReviewReport {
  id: string
  userId: string
  sections: Partial<Record<LinkedInSectionKey, LinkedInSectionFeedback>>
  suggestions: { headlineRewrites: { label: string; text: string }[] }
  overallScore: number | null
  createdAt: string
}

// ─── Approvals (F6) ───────────────────────────────────────────────────────────

export interface ApprovalArtifact {
  id: string
  artifactType: 'resume' | 'cover-letter'
  resumeVersionType?: 'MASTER' | 'TAILORED'
  status: ArtifactStatus
  jobId: string | null
  jobTitle: string | null
  jobCompany: string | null
  updatedAt: string
  preview: string
}

// ─── Jobs (F4) ─────────────────────────────────────────────────────────────────

export type ExperienceLevel = 'intern' | 'entry' | 'mid' | 'senior'

export interface JobPosting {
  id: string
  userId: string
  source: string
  url: string | null
  title: string
  company: string | null
  location: string | null
  salary: string | null
  description: string
  normalizedFields: Record<string, unknown>
  skills: string[]
  experienceLevel: ExperienceLevel | null
  isRemote: boolean | null
  createdAt: string
  // The system's own match score against the caller's résumé, if computed
  // yet (null for a just-pasted job with no score computed). See
  // surfaceJobs.ts on the backend for how a pool job earns a place here.
  matchScore: number | null
}

// ─── Match scoring (F4) ─────────────────────────────────────────────────────────

export type LocationFit = 'remote-ok' | 'location-match' | 'location-mismatch' | 'unknown'
export type SalaryFit = 'within-range' | 'below-range' | 'above-range' | 'unknown'

export interface MatchScoreRationale {
  lexicalSimilarity: number
  matchedSkills: string[]
  missingSkills: string[]
  locationFit: LocationFit
  salaryFit: SalaryFit
}

export interface MatchResult {
  id: string
  userId: string
  jobId: string
  score: number
  rationale: MatchScoreRationale
  gaps: string[]
  createdAt: string
}

// ─── Skill gap (F7) ──────────────────────────────────────────────────────────

export interface SkillGapReport {
  id: string
  userId: string
  jobId: string | null
  roleContext: string | null
  missingSkills: string[]
  existingSkills: string[]
  supportedByResumeSkills: string[]
  priorityRanking: unknown[]
  createdAt: string
}

// ─── Cover letters (F5) ──────────────────────────────────────────────────────

export interface CoverLetterAchievement {
  lead: string
  impact: string
}

export interface CoverLetterPayload {
  candidate: {
    name: string
    location?: string
    email?: string
    phone?: string
    linkedin?: string
    github?: string
    credentials?: string[]
  }
  letter: {
    role_title: string
    company?: string
    city?: string
    date?: string
    greeting?: string
    opening: string
    profile_intro: string
    achievements?: CoverLetterAchievement[]
    problems_section?: string
    closing?: string
    language_closing?: string
    footnotes?: unknown[]
  }
}

export interface GeneratedCoverLetter {
  id: string
  userId: string
  jobId: string
  content: CoverLetterPayload
  provenance?: Record<string, unknown>
  status: ArtifactStatus
  createdAt: string
  updatedAt: string
}

// ─── Settings: model connection ─────────────────────────────────────────────

export interface ModelConnectionStatus {
  configured: boolean
  kind: 'local' | 'cloud' | null
  preview: string | null
  warning?: string
}
