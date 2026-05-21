// ─── Resume Parsing Types ─────────────────────────────────────────────────────

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
  normalized?: string
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

export interface ParsedResumeData {
  sections: ResumeSection[]
  extractedEntities: ExtractedEntities
  confidenceScores: ConfidenceScores
  rawText: string
}

// ─── Candidate Profile Types ──────────────────────────────────────────────────

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

export interface OnboardingTurn {
  message: string
  state: OnboardingState
  profileUpdates: Partial<{
    targetRoles: string[]
    industries: string[]
    locations: string[]
    remotePreference: RemotePreference
    salaryMin: number
    salaryMax: number
    salaryCurrency: string
    urgency: SearchUrgency
    noticePeriod: string
    visaStatus: string
  }>
  isComplete: boolean
  completionScore: number
  nextQuestion?: string
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiError {
  error: {
    code: string
    message: string
  }
}

// ─── Express augmentation ─────────────────────────────────────────────────────

import { Request } from 'express'

export interface AuthRequest extends Request {
  userId?: string
  userPlan?: string
}
