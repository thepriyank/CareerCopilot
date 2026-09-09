/**
 * Adzuna provider — free job-aggregator API (api.adzuna.com), a sanctioned
 * broad-coverage source for India + international postings per
 * `ARCHITECTURE.md`'s job source policy (alongside TheirStack). Adzuna
 * re-syndicates listings that originate on many portals and returns a
 * tracked `redirect_url` back to the original posting.
 *
 * Gated behind `ADZUNA_APP_ID` + `ADZUNA_APP_KEY`. Returns [] when either is
 * missing, so the app behaves identically for anyone who hasn't signed up.
 *
 * Docs: https://developer.adzuna.com/  ·  free tier ~250 calls/day,
 * non-commercial. `GET /v1/api/jobs/{country}/search/{page}` with
 * `app_id` / `app_key` / `results_per_page` / `what` / `where` /
 * `max_days_old` query params.
 */

import { NormalizedJob, Provider, ProviderContext, ProviderEntry } from './types'
import { stripHtml } from './text'

const ADZUNA_HOST = 'api.adzuna.com'
const RESULTS_PER_PAGE = 50
const DEFAULT_MAX_DAYS_OLD = 21
// Adzuna's free tier is ~250 calls/DAY (not/month, unlike JSearch) — one
// call per title (plus one remote-scoped call below) comfortably covers
// every title in target-job-titles.json every single run with no need to
// ration or rotate. 2026-09-09: raised from a static 5 (which, unlike
// JSearch's tighter monthly cap, had no quota justification at all —
// simply left 8 of 13 target categories unsearched for no reason).
const MAX_TITLE_QUERIES = 20

/** ISO-3166 alpha-2 (lowercased) → currency, for the countries Adzuna serves that we care about. */
const COUNTRY_CURRENCY: Record<string, string> = {
  in: 'INR',
  gb: 'GBP',
  us: 'USD',
  au: 'AUD',
  ca: 'CAD',
  sg: 'SGD',
  de: 'EUR',
  nl: 'EUR',
  fr: 'EUR',
}

interface AggregatorQuery {
  countryCodes?: string[]
  titles?: string[]
  maxAgeDays?: number
  limit?: number
}

interface AdzunaResult {
  title?: string
  redirect_url?: string
  company?: { display_name?: string }
  location?: { display_name?: string }
  description?: string
  created?: string
  salary_min?: number
  salary_max?: number
}

function creds(): { appId: string; appKey: string } | null {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY
  return appId && appKey ? { appId, appKey } : null
}

function toEpochMs(value?: string): number | undefined {
  if (!value) return undefined
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

function buildUrl(country: string, params: Record<string, string>): string {
  const qs = new URLSearchParams({
    results_per_page: String(RESULTS_PER_PAGE),
    'content-type': 'application/json',
    ...params,
  })
  return `https://${ADZUNA_HOST}/v1/api/jobs/${country}/search/1?${qs.toString()}`
}

function normalize(country: string, results: AdzunaResult[]): NormalizedJob[] {
  const currency = COUNTRY_CURRENCY[country] ?? 'USD'
  return results
    .filter((r): r is AdzunaResult & { redirect_url: string } => typeof r?.redirect_url === 'string' && !!r.redirect_url)
    .map((r) => {
      const min = r.salary_min ?? r.salary_max
      const max = r.salary_max ?? r.salary_min
      return {
        title: stripHtml(r.title) || 'Untitled role',
        url: r.redirect_url,
        company: stripHtml(r.company?.display_name),
        location: stripHtml(r.location?.display_name),
        description: stripHtml(r.description),
        postedAt: toEpochMs(r.created),
        salary: min && max ? { min, max, currency } : null,
      }
    })
}

const adzuna: Provider = {
  id: 'adzuna',

  detect(_entry: ProviderEntry) {
    return creds() ? { url: `https://${ADZUNA_HOST}/v1/api/jobs` } : null
  },

  async fetch(entry: ProviderEntry, ctx: ProviderContext): Promise<NormalizedJob[]> {
    const c = creds()
    if (!c) return []

    const query: AggregatorQuery = (entry as { query?: AggregatorQuery }).query ?? {}
    const country = (query.countryCodes?.[0] ?? 'in').toLowerCase()
    const maxDaysOld = String(query.maxAgeDays ?? DEFAULT_MAX_DAYS_OLD)
    const auth = { app_id: c.appId, app_key: c.appKey, max_days_old: maxDaysOld }

    // One request per target role (capped), plus one remote-scoped request.
    // Comfortably inside the free tier's ~250 calls/day for a daily refresh.
    const titles = (query.titles ?? []).map((t) => t.trim()).filter(Boolean).slice(0, MAX_TITLE_QUERIES)
    const requests: Array<{ label: string; url: string }> = []
    if (titles.length === 0) {
      requests.push({ label: country, url: buildUrl(country, auth) })
    } else {
      for (const what of titles) requests.push({ label: `${country}:${what}`, url: buildUrl(country, { ...auth, what }) })
    }
    requests.push({ label: 'remote', url: buildUrl(country, { ...auth, what_or: 'remote', where: 'remote' }) })

    const out: NormalizedJob[] = []
    for (const req of requests) {
      let json: unknown
      try {
        json = await ctx.fetchJson(req.url, { redirect: 'error', headers: { accept: 'application/json' } })
      } catch (err) {
        throw new Error(`adzuna: request failed (${req.label}) — ${(err as Error).message}`)
      }
      const results = Array.isArray((json as { results?: unknown })?.results)
        ? (json as { results: AdzunaResult[] }).results
        : []
      out.push(...normalize(country, results))
      if (ctx.sleep) await ctx.sleep(300)
    }
    return out
  },
}

export default adzuna
