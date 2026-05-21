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
