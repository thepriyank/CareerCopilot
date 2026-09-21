import type { FieldMappingEntry, FillableProfileFields, FormFieldSchema } from '../lib/fieldSchema'

// Overridden at build time for local dev — see scripts/build.mjs's
// `--api=` flag and README. Defaults to production. `api.jobmagnate.com`
// has no DNS record (no Cloud Run domain mapping was ever created for
// it — only the apex `jobmagnate.com` is mapped, to the frontend); the
// backend is only reachable at its Cloud Run URL, exactly like the web
// app's own NEXT_PUBLIC_API_URL build arg points at it. Point here too
// until/unless an api.jobmagnate.com domain mapping is added.
export const API_BASE_URL = (globalThis as { JOBMAGNATE_API_BASE_URL?: string }).JOBMAGNATE_API_BASE_URL
  ?? 'https://jobmagnate-backend-production-w4642vyi6a-as.a.run.app'

const TOKEN_STORAGE_KEY = 'jobmagnateExtensionToken'

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function getToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(TOKEN_STORAGE_KEY)
  return (result[TOKEN_STORAGE_KEY] as string | undefined) ?? null
}

export async function setToken(token: string): Promise<void> {
  await chrome.storage.local.set({ [TOKEN_STORAGE_KEY]: token })
}

export async function clearToken(): Promise<void> {
  await chrome.storage.local.remove(TOKEN_STORAGE_KEY)
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken()
  if (!token) throw new ApiError(401, 'NOT_CONNECTED', 'Connect the extension to JobMagnate first')

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string> | undefined),
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body?.error?.code ?? 'UNKNOWN_ERROR', body?.error?.message ?? `Request failed: ${res.status}`)
  }

  return res.json() as Promise<T>
}

export interface ExtensionProfileResponse {
  profile: FillableProfileFields
  plan: 'FREE' | 'PREMIUM'
  remainingFills: number | null
}

export function fetchProfile(): Promise<ExtensionProfileResponse> {
  return apiFetch<ExtensionProfileResponse>('/api/extension/profile')
}

export interface ExtensionFillsResponse extends ExtensionProfileResponse {
  job: { id: string; title: string; company: string | null } | null
  resume: { type: string; id: string; downloadUrl: string } | null
  unapprovedTailoredResumeExists: boolean
  coverLetter: { id: string; downloadUrl: string } | null
}

export function requestFill(url: string): Promise<ExtensionFillsResponse> {
  return apiFetch<ExtensionFillsResponse>('/api/extension/fills', {
    method: 'POST',
    body: JSON.stringify({ url }),
  })
}

export function requestFieldMap(hostname: string, schema: FormFieldSchema[]): Promise<{ mapping: FieldMappingEntry[] }> {
  return apiFetch<{ mapping: FieldMappingEntry[] }>('/api/extension/field-map', {
    method: 'POST',
    body: JSON.stringify({ hostname, schema }),
  })
}

export function markApplied(jobId: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/api/extension/applications', {
    method: 'POST',
    body: JSON.stringify({ jobId }),
  })
}
