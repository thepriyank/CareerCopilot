import { normalizeApplicationUrl } from './normalizeUrl'
import { listJobViews, JobView } from '../jobs/jobView'

export interface JobResolution {
  job: JobView | null
  // Only populated when nothing matched — a shortlist for the extension's
  // "which job is this?" picker, most-relevant first (listJobViews' own
  // ordering). See "Job identification" in the plan doc.
  candidates: JobView[]
}

const CANDIDATE_LIMIT = 20

/**
 * Matches an application form's URL to one of the user's saved jobs.
 * Exact match first, then normalized (strips tracking params/fragment/
 * trailing slash — see normalizeUrl.ts). Adapter-extracted job-id matching
 * (tier 3 in the plan doc) waits until an adapter actually exists (Phase 1).
 * Never throws on no match — job identification failing must degrade the
 * fill, never block it.
 */
export async function resolveJobForUrl(userId: string, formUrl: string): Promise<JobResolution> {
  const jobs = await listJobViews(userId)

  const exact = jobs.find((j) => j.url === formUrl)
  if (exact) return { job: exact, candidates: [] }

  const normalizedTarget = normalizeApplicationUrl(formUrl)
  const normalized = jobs.find((j) => j.url && normalizeApplicationUrl(j.url) === normalizedTarget)
  if (normalized) return { job: normalized, candidates: [] }

  return { job: null, candidates: jobs.slice(0, CANDIDATE_LIMIT) }
}
