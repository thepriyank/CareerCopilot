import { getToken } from './auth'
import {
  User,
  ResumeFile,
  ParsedResume,
  CandidateProfile,
  OnboardingTurn,
  OnboardingState,
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

export { ApiError }
