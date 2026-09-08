/**
 * JSearch provider — job-aggregator API pulling from Google for Jobs' index
 * (which itself re-syndicates LinkedIn, Indeed, Glassdoor, ZipRecruiter,
 * company career pages, and more). Evaluated 2026-09-06 against a real
 * 10-job manual pull — see `docs/F4_job_search_and_match_plan.md` for the
 * outcome. Approved for live use.
 *
 * The SAME underlying product (OpenWeb Ninja) is sold two ways: directly via
 * their own API (`api.openwebninja.com`, header `x-api-key`) and via the
 * RapidAPI marketplace (`jsearch.p.rapidapi.com`, headers `X-RapidAPI-Key` /
 * `X-RapidAPI-Host`) — same company, same data, two independent free-tier
 * monthly quotas (~200 requests/month each as of this writing). Configure
 * either or both:
 *   JSEARCH_RAPID_API_KEY         — RapidAPI marketplace key
 *   JSEARCH_OPEN_WEB_NINJA_API_KEY — OpenWeb Ninja direct-portal key
 *   JSEARCH_RAPIDAPI_KEY / JSEARCH_OPENWEBNINJA_KEY / JSEARCH_API_KEY —
 *     accepted aliases (JSEARCH_API_KEY is this provider's original
 *     single-key name, treated as a RapidAPI key)
 * Only ONE credential is used per search call — see jobCredentialChain.ts
 * for why querying both would be pointless (identical results, wasted quota)
 * — falling through to the next configured credential only once the current
 * one is confirmed exhausted for the month.
 *
 * Response shape is defensively tolerant of `data` being either a plain
 * array (the older, still-documented shape) or `{ jobs: [...] }` — confirmed
 * live on 2026-09-06 that BOTH endpoints now return the latter (RapidAPI's
 * plain `/search` was retired sometime after this provider was first written;
 * it now 404s, and `/search-v2` is the only working path — see git history /
 * jsearch.test.ts for the shape checks). OpenWeb Ninja's `search-v2` reportedly
 * also returns `required_technologies` / `soft_skills` / `methodologies`
 * fields — not yet consumed here (unverified against real data; worth
 * revisiting if/when AI-based skill extraction is built, since the provider
 * may have already done some of that work for us).
 */

import { NormalizedJob, Provider, ProviderContext, ProviderEntry } from './types'
import { usableCredentials, handleJobApiFailure } from './jobCredentialChain'
import { logger } from '../../../utils/logger'

const RAPIDAPI_HOST = 'jsearch.p.rapidapi.com'
// RapidAPI retired the old `/search` path (returns 404 "Endpoint '/search' does
// not exist" as of 2026-09-06 — confirmed by direct curl against a real key)
// in favor of `/search-v2`, matching OpenWeb Ninja's own versioned endpoint.
// Response shape is unchanged (`{ data: { jobs: [...] } }`, same field names),
// so normalizeJSearchResponse needed no changes — only the URL did.
const RAPIDAPI_SEARCH_URL = `https://${RAPIDAPI_HOST}/search-v2`
const OPENWEBNINJA_SEARCH_URL = 'https://api.openwebninja.com/jsearch/search-v2'
const DEFAULT_EMPLOYMENT_TYPES = 'FULLTIME'
const MAX_TITLE_QUERIES = 3

export interface AggregatorQuery {
  countryCodes?: string[]
  titles?: string[]
  maxAgeDays?: number
  limit?: number
}

/** ISO-3166 alpha-2 (lowercased) → currency, for salary fields JSearch doesn't tag with one. */
const COUNTRY_CURRENCY: Record<string, string> = {
  in: 'INR',
  gb: 'GBP',
  us: 'USD',
  au: 'AUD',
  ca: 'CAD',
  sg: 'SGD',
}

interface JSearchJob {
  job_title?: string
  job_apply_link?: string
  employer_name?: string
  job_location?: string
  job_city?: string
  job_state?: string
  job_country?: string
  job_is_remote?: boolean
  job_description?: string
  job_posted_at_timestamp?: number
  job_min_salary?: number
  job_max_salary?: number
  job_salary_currency?: string
}

type CredentialStyle = 'rapidapi' | 'openwebninja'
interface JSearchCredential {
  id: string
  style: CredentialStyle
  key: string
}

/** Configured credentials, in priority order (RapidAPI first — this provider's original key). */
function configuredCredentials(): JSearchCredential[] {
  const out: JSearchCredential[] = []
  const rapidKey = process.env.JSEARCH_RAPID_API_KEY || process.env.JSEARCH_RAPIDAPI_KEY || process.env.JSEARCH_API_KEY
  if (rapidKey) out.push({ id: 'jsearch-rapidapi', style: 'rapidapi', key: rapidKey })
  const ninjaKey = process.env.JSEARCH_OPEN_WEB_NINJA_API_KEY || process.env.JSEARCH_OPENWEBNINJA_KEY
  if (ninjaKey) out.push({ id: 'jsearch-openwebninja', style: 'openwebninja', key: ninjaKey })
  return out
}

function locationText(j: JSearchJob): string {
  if (j.job_location && j.job_location.trim()) return j.job_location.trim()
  return [j.job_city, j.job_state, j.job_country].filter(Boolean).join(', ')
}

function buildRequest(cred: JSearchCredential, query: string, country: string): { url: string; headers: Record<string, string> } {
  if (cred.style === 'rapidapi') {
    const qs = new URLSearchParams({
      query,
      page: '1',
      num_pages: '1',
      country,
      employment_types: DEFAULT_EMPLOYMENT_TYPES,
      language: 'en',
    })
    return {
      url: `${RAPIDAPI_SEARCH_URL}?${qs.toString()}`,
      headers: { 'X-RapidAPI-Key': cred.key, 'X-RapidAPI-Host': RAPIDAPI_HOST },
    }
  }
  // openwebninja direct — same core query params, its own auth header, no RapidAPI-specific paging params.
  const qs = new URLSearchParams({ query, country, language: 'en' })
  return {
    url: `${OPENWEBNINJA_SEARCH_URL}?${qs.toString()}`,
    headers: { 'x-api-key': cred.key },
  }
}

/** Extracted for unit testing — handles both documented response shapes. */
export function normalizeJSearchResponse(json: unknown): NormalizedJob[] {
  const data = (json as { data?: unknown })?.data
  const jobs: JSearchJob[] = Array.isArray(data)
    ? (data as JSearchJob[])
    : Array.isArray((data as { jobs?: unknown })?.jobs)
      ? ((data as { jobs: JSearchJob[] }).jobs)
      : []

  return jobs
    .filter((j): j is JSearchJob & { job_apply_link: string } => typeof j?.job_apply_link === 'string' && !!j.job_apply_link)
    .map((j) => {
      const country = (j.job_country || 'in').toLowerCase()
      const currency = j.job_salary_currency || COUNTRY_CURRENCY[country] || 'USD'
      const hasSalary = typeof j.job_min_salary === 'number' && typeof j.job_max_salary === 'number'
      return {
        title: j.job_title?.trim() || 'Untitled role',
        url: j.job_apply_link,
        company: j.employer_name?.trim() || '',
        location: locationText(j),
        description: j.job_description?.trim() || '',
        isRemote: typeof j.job_is_remote === 'boolean' ? j.job_is_remote : undefined,
        postedAt:
          typeof j.job_posted_at_timestamp === 'number' ? j.job_posted_at_timestamp * 1000 : undefined,
        salary: hasSalary ? { min: j.job_min_salary!, max: j.job_max_salary!, currency } : null,
      }
    })
}

const jsearch: Provider = {
  id: 'jsearch',

  detect(_entry: ProviderEntry) {
    return configuredCredentials().length > 0 ? { url: RAPIDAPI_SEARCH_URL } : null
  },

  async fetch(entry: ProviderEntry, ctx: ProviderContext): Promise<NormalizedJob[]> {
    const credentials = configuredCredentials()
    if (credentials.length === 0) return []

    const query: AggregatorQuery = (entry as { query?: AggregatorQuery }).query ?? {}
    const country = (query.countryCodes?.[0] ?? 'in').toLowerCase()
    const titles = (query.titles ?? []).map((t) => t.trim()).filter(Boolean).slice(0, MAX_TITLE_QUERIES)
    const searchTerms = titles.length > 0 ? titles : ['engineering manager']

    const out: NormalizedJob[] = []
    let lastErr: unknown
    let anySucceeded = false

    for (const term of searchTerms) {
      const usable = usableCredentials(credentials)
      if (usable.length === 0) {
        logger.warn('jsearch: every configured credential is exhausted for this month; skipping remaining terms')
        break
      }

      // Try credentials in order for THIS term only — one success is enough;
      // never call a second credential for a term the first already answered.
      for (const cred of usable) {
        const { url, headers } = buildRequest(cred, term, country)
        try {
          const json = await ctx.fetchJson(url, { redirect: 'error', headers })
          out.push(...normalizeJSearchResponse(json))
          anySucceeded = true
          break
        } catch (err) {
          lastErr = err
          const kind = handleJobApiFailure(cred.id, err)
          logger.warn(`jsearch: credential "${cred.id}" failed (${kind}) for term "${term}"`, {
            err: (err as Error).message,
          })
        }
      }
      if (ctx.sleep) await ctx.sleep(300)
    }

    // Only throw if literally nothing came back and there was a real error —
    // a partial success (some terms answered, others hit exhausted/failed
    // credentials) should still return what it found rather than lose it.
    if (!anySucceeded && lastErr) {
      throw new Error(`jsearch: every credential failed — ${(lastErr as Error).message}`)
    }
    return out
  },
}

export default jsearch
