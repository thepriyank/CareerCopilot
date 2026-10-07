import type { AttachmentPayload, FieldMappingEntry, FillableProfileFields, FormFieldSchema } from '../lib/fieldSchema'

// Overridden at build time for local dev — see scripts/build.mjs's
// `--api=` flag and README. Defaults to production. Was pointed at the
// raw Cloud Run URL from 0.1.0 onward (api.jobmagnate.com had no DNS
// record at the time — see git history); the domain mapping + cert are
// live now, so this points at the branded domain again as of 0.1.1.
export const API_BASE_URL = (globalThis as { JOBMAGNATE_API_BASE_URL?: string }).JOBMAGNATE_API_BASE_URL
  ?? 'https://api.jobmagnate.com'

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

  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers as Record<string, string> | undefined),
      },
    })
  } catch {
    // Raw fetch errors ("Failed to fetch", "NetworkError…") aren't user copy.
    throw new ApiError(0, 'NETWORK_ERROR', "Can't reach JobMagnate right now. Check your connection and try again.")
  }

  if (!res.ok) {
    // The backend only ever sends user-safe messages (see
    // backend/src/middleware/errorHandler.ts); a non-JSON body means a proxy
    // / platform error page, so fall back to generic copy, never the status.
    const body = await res.json().catch(() => null)
    throw new ApiError(
      res.status,
      body?.error?.code ?? 'UNKNOWN_ERROR',
      body?.error?.message ?? 'Something went wrong on our side. Please try again in a moment.'
    )
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
  /** Approved cover letter as plain text, for textarea fields (NM-4). */
  coverLetterText?: string | null
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000 // stay well under String.fromCharCode's argument limit
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/**
 * Downloads the résumé or cover letter to attach (NM-4). The server
 * re-resolves which artifact (approved-only) from the job id — the
 * extension never picks one. Returns null when there's nothing to attach
 * (404); other failures throw like any API call.
 */
export async function fetchArtifact(
  kind: 'resume' | 'cover-letter',
  jobId: string | null
): Promise<AttachmentPayload | null> {
  const token = await getToken()
  if (!token) throw new ApiError(401, 'NOT_CONNECTED', 'Connect the extension to JobMagnate first')
  const query = jobId ? `?jobId=${encodeURIComponent(jobId)}` : ''

  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}/api/extension/artifacts/${kind}${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', "Can't reach JobMagnate right now. Check your connection and try again.")
  }
  if (res.status === 404) return null
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body?.error?.code ?? 'UNKNOWN_ERROR', body?.error?.message ?? 'Something went wrong on our side. Please try again in a moment.')
  }

  return {
    base64: toBase64(await res.arrayBuffer()),
    filename: res.headers.get('X-Filename') ?? (kind === 'resume' ? 'Resume.pdf' : 'Cover_Letter.pdf'),
    mimeType: res.headers.get('Content-Type')?.split(';')[0] ?? 'application/pdf',
  }
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
