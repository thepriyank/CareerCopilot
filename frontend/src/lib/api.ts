import { getToken } from './auth'
import {
  User,
  ResumeFile,
  ParsedResume,
  CandidateProfile,
  OnboardingTurn,
  OnboardingState,
  GeneratedResumeVersion,
  ArtifactStatus,
  JobPosting,
  MatchResult,
  SkillGapReport,
  GeneratedCoverLetter,
  ModelConnectionStatus,
  ApprovalArtifact,
  LinkedInReviewReport,
  AggregatedGap,
  DashboardData,
} from '../types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...(options.body && !(options.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (!res.ok) {
    let code = 'UNKNOWN_ERROR'
    let message = `Request failed: ${res.status}`
    try {
      const body = await res.json()
      code = body?.error?.code ?? code
      message = body?.error?.message ?? message
    } catch {
      // ignore parse error
    }
    throw new ApiError(res.status, code, message)
  }

  if (res.status === 204) return undefined as unknown as T
  return res.json() as Promise<T>
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const auth = {
  register: (email: string, password: string, name?: string) =>
    request<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),

  login: (email: string, password: string) =>
    request<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  // Sign-in AND sign-up in one call, per how Google OAuth actually works —
  // `isNewUser` tells the caller which it was, so the UI can route a fresh
  // signup into onboarding the same way email/password registration does.
  google: (idToken: string) =>
    request<{ user: User; token: string; isNewUser: boolean }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    }),

  me: () => request<{ user: User }>('/api/auth/me'),
}

// ─── Resumes ──────────────────────────────────────────────────────────────────

export const resumes = {
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<{ resumeFile: ResumeFile; parsedResume: ParsedResume; warning?: string }>(
      '/api/resumes/upload',
      { method: 'POST', body: form }
    )
  },

  list: () =>
    request<{ resumes: Array<ResumeFile & { parsedResume: ParsedResume | null }> }>('/api/resumes'),

  get: (fileId: string) =>
    request<{ resumeFile: ResumeFile; parsedResume: ParsedResume | null }>(
      `/api/resumes/${fileId}`
    ),

  updateParsed: (parsedId: string, data: { sections?: unknown; extractedEntities?: unknown }) =>
    request<{ parsedResume: ParsedResume }>(`/api/resumes/parsed/${parsedId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (fileId: string) =>
    request<{ message: string }>(`/api/resumes/${fileId}`, { method: 'DELETE' }),
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export const profile = {
  get: () => request<{ profile: CandidateProfile | null }>('/api/profile'),

  upsert: (data: Partial<CandidateProfile>) =>
    request<{ profile: CandidateProfile }>('/api/profile', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  onboarding: (message: string, state?: OnboardingState) =>
    request<OnboardingTurn>('/api/profile/onboarding', {
      method: 'POST',
      body: JSON.stringify({ message, state }),
    }),
}

// ─── Master Resume ────────────────────────────────────────────────────────────

export const masterResume = {
  generate: () => 
    request<{ masterResume: GeneratedResumeVersion }>('/api/resume/master/generate', {
      method: 'POST',
    }),

  get: () => 
    request<{ masterResume: GeneratedResumeVersion | null }>('/api/resume/master'),

  update: (id: string, data: { content?: unknown; status?: ArtifactStatus }) =>
    request<{ masterResume: GeneratedResumeVersion }>(`/api/resume/master/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  regenerate: (id: string, data: { originalText: string; currentText: string; instruction: string }) =>
    request<{ enhancedText: string }>(`/api/resume/master/${id}/regenerate`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// ─── Approvals ────────────────────────────────────────────────────────────────

export const approvals = {
  list: () => request<{ artifacts: ApprovalArtifact[] }>('/api/approvals'),

  approve: (type: 'resume' | 'cover-letter', id: string, notes?: string) =>
    request<{ resume?: GeneratedResumeVersion; coverLetter?: GeneratedCoverLetter }>(
      `/api/approvals/${type}/${id}/approve`,
      { method: 'POST', body: JSON.stringify({ notes }) }
    ),

  reject: (type: 'resume' | 'cover-letter', id: string, notes?: string) =>
    request<{ resume?: GeneratedResumeVersion; coverLetter?: GeneratedCoverLetter }>(
      `/api/approvals/${type}/${id}/reject`,
      { method: 'POST', body: JSON.stringify({ notes }) }
    ),
}

// ─── LinkedIn review ────────────────────────────────────────────────────────

export const linkedin = {
  getReview: () => request<{ report: LinkedInReviewReport | null }>('/api/linkedin/review'),

  review: (data: { headline?: string; about?: string; experience?: string; skills?: string }) =>
    request<{ report: LinkedInReviewReport }>('/api/linkedin/review', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Reads headline/about/experience/skills out of a LinkedIn "Save to PDF"
  // export — never a live-URL fetch (see linkedinPdfExtractor.ts on the
  // backend for why). Returns extracted text for the user to review/edit
  // before running the existing `review()` call above.
  extractPdf: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<{ extracted: { headline: string; about: string; experience: string; skills: string } }>(
      '/api/linkedin/extract-pdf',
      { method: 'POST', body: form }
    )
  },
}

// ─── Skill roadmap ────────────────────────────────────────────────────────────

export const skillGaps = {
  list: () => request<{ gaps: AggregatedGap[]; savedGoals: string[] }>('/api/skill-gaps'),

  markGoal: (skill: string) =>
    request<{ courseRecommendation: { id: string } }>(`/api/skill-gaps/${encodeURIComponent(skill)}/goal`, {
      method: 'POST',
    }),
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const dashboard = {
  get: () => request<DashboardData>('/api/dashboard'),
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export const jobs = {
  // Returns the caller's job board: whatever they've pasted, plus whatever
  // the system has already matched to their résumé (see surfaceJobs.ts on
  // the backend). There is no manual "discover" call any more — 2026-09-06
  // product decision: discovery is system-internal (a twice-daily cron
  // against an admin-configured pool), never something a candidate
  // triggers. `needsMasterResume` is true until they've generated one —
  // nothing gets matched before that.
  list: () => request<{ jobs: JobPosting[]; needsMasterResume: boolean }>('/api/jobs'),

  get: (id: string) => request<{ job: JobPosting }>(`/api/jobs/${id}`),

  create: (data: {
    title: string
    company?: string
    location?: string
    url?: string
    salary?: string
    description: string
    isRemote?: boolean
  }) =>
    request<{ job: JobPosting }>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMatch: (jobId: string) => request<{ matchResult: MatchResult | null }>(`/api/jobs/${jobId}/match`),

  computeMatch: (jobId: string) =>
    request<{ matchResult: MatchResult }>(`/api/jobs/${jobId}/match`, { method: 'POST' }),

  getSkillGap: (jobId: string) =>
    request<{ skillGapReport: SkillGapReport | null; existing: string[]; supportedByResume: string[] }>(
      `/api/jobs/${jobId}/skill-gap`
    ),

  computeSkillGap: (jobId: string) =>
    request<{ skillGapReport: SkillGapReport; existing: string[]; supportedByResume: string[] }>(
      `/api/jobs/${jobId}/skill-gap`,
      { method: 'POST' }
    ),

  getCoverLetter: (jobId: string) =>
    request<{ coverLetter: GeneratedCoverLetter | null }>(`/api/jobs/${jobId}/cover-letter`),

  generateCoverLetter: (jobId: string) =>
    request<{ coverLetter: GeneratedCoverLetter }>(`/api/jobs/${jobId}/cover-letter`, { method: 'POST' }),

  getTailoredResume: (jobId: string) =>
    request<{ tailoredResume: GeneratedResumeVersion | null }>(`/api/jobs/${jobId}/tailor`),

  generateTailoredResume: (jobId: string) =>
    request<{ tailoredResume: GeneratedResumeVersion }>(`/api/jobs/${jobId}/tailor`, { method: 'POST' }),
}

// ─── File downloads (PDFs) ──────────────────────────────────────────────────────
// Separate from `request<T>()`, which always parses JSON — a PDF response
// needs to be read as a blob and handed to the browser's save flow instead.

export async function downloadFile(path: string, filename: string): Promise<void> {
  const token = getToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!res.ok) {
    let code = 'DOWNLOAD_FAILED'
    let message = `Download failed: ${res.status}`
    try {
      const body = await res.json()
      code = body?.error?.code ?? code
      message = body?.error?.message ?? message
    } catch {
      // ignore parse error
    }
    throw new ApiError(res.status, code, message)
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// ─── Settings: model connection ─────────────────────────────────────────────
// One field, auto-detected: a cloud API key, or a local/self-hosted
// OpenAI-compatible endpoint with the model in a #model= fragment.

export const settings = {
  getModelConnection: () => request<ModelConnectionStatus>('/api/settings/model-connection'),

  setModelConnection: (raw: string) =>
    request<ModelConnectionStatus>('/api/settings/model-connection', {
      method: 'PUT',
      body: JSON.stringify({ raw }),
    }),

  clearModelConnection: () =>
    request<ModelConnectionStatus>('/api/settings/model-connection', { method: 'DELETE' }),
}

// ─── Account (Settings: Privacy & data, Export) ───────────────────────────────

export const account = {
  exportData: () => request<Record<string, unknown>>('/api/account/export'),

  deleteAccount: () => request<{ message: string }>('/api/account', { method: 'DELETE' }),
}

export { ApiError }
