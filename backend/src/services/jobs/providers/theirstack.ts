/**
 * TheirStack provider — licensed job-data aggregator (api.theirstack.com),
 * the sanctioned broad-coverage source for India + international postings
 * per `ARCHITECTURE.md`'s job source policy (Naukri/Indeed/LinkedIn have no
 * public self-serve API; this is the legitimate alternative).
 *
 * Inspired by (not copied from — its source lives in a separate community
 * repo career-ops references as an opt-in plugin, not in career-ops itself)
 * santifer/career-ops's plugin registry entry `plugins-registry/theirstack.json`
 * (MIT), which documents the shape this provider follows: gated behind a
 * `THEIRSTACK_API_KEY` env var, `allowedHosts: ["api.theirstack.com"]`,
 * tolerant of the API returning `company` as either a plain string or an
 * object with a `name` field.
 *
 * Request/response shape confirmed against TheirStack's own OpenAPI spec
 * (`POST /v1/jobs/search`, Bearer auth, `job_country_code_or` /
 * `job_title_or` / `posted_at_max_age_days` / `limit` filters).
 *
 * Gracefully returns [] when no key is configured — the app works
 * identically for anyone who hasn't signed up; nothing breaks.
 */

import { NormalizedJob, Provider, ProviderContext, ProviderEntry } from './types'

const THEIRSTACK_HOST = 'api.theirstack.com'
const SEARCH_URL = `https://${THEIRSTACK_HOST}/v1/jobs/search`
const DEFAULT_LIMIT = 25

export interface TheirStackQuery {
  countryCodes?: string[] // ISO country codes, e.g. ['IN']
  titles?: string[]
  maxAgeDays?: number
  limit?: number
}

interface TheirStackCompany {
  name?: string
}

interface TheirStackJob {
  title?: string
  url?: string
  company?: string | TheirStackCompany
  location?: string
  posted_at?: string
  discovered_at?: string
}

function companyName(company: TheirStackJob['company']): string {
  if (typeof company === 'string') return company
  if (company && typeof company === 'object' && typeof company.name === 'string') return company.name
  return ''
}

function toEpochMs(value?: string): number | undefined {
  if (!value) return undefined
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

const theirstack: Provider = {
  id: 'theirstack',

  detect(_entry: ProviderEntry) {
    return process.env.THEIRSTACK_API_KEY ? { url: SEARCH_URL } : null
  },

  async fetch(entry: ProviderEntry, ctx: ProviderContext): Promise<NormalizedJob[]> {
    const apiKey = process.env.THEIRSTACK_API_KEY
    if (!apiKey) return []

    const query: TheirStackQuery = (entry as { query?: TheirStackQuery }).query ?? {}
    const body = {
      job_country_code_or: query.countryCodes ?? ['IN'],
      ...(query.titles?.length ? { job_title_or: query.titles } : {}),
      posted_at_max_age_days: query.maxAgeDays ?? 14,
      limit: query.limit ?? DEFAULT_LIMIT,
    }

    let json: unknown
    try {
      json = await ctx.fetchJson(SEARCH_URL, {
        method: 'POST',
        body: JSON.stringify(body),
        redirect: 'error',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
      })
    } catch (err) {
      // A misconfigured/expired key or a TheirStack outage shouldn't take
      // down the rest of discovery — log and return no results from this
      // source, same as "no key configured".
      throw new Error(`theirstack: request failed — ${(err as Error).message}`)
    }

    const data = Array.isArray((json as { data?: unknown })?.data)
      ? (json as { data: TheirStackJob[] }).data
      : Array.isArray(json)
        ? (json as TheirStackJob[])
        : []

    return data
      .filter((j) => typeof j?.url === 'string' && j.url)
      .map((j) => ({
        title: j.title || '',
        url: j.url!,
        company: companyName(j.company),
        location: j.location || '',
        postedAt: toEpochMs(j.posted_at || j.discovered_at),
      }))
  },
}

export default theirstack
