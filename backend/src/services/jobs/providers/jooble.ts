/**
 * Jooble provider — free job-aggregator API (jooble.org), a sanctioned
 * broad-coverage source for India + remote postings per `ARCHITECTURE.md`'s
 * job source policy (alongside TheirStack and Adzuna). Jooble re-syndicates
 * listings from many portals and returns a `link` back to the original
 * posting.
 *
 * Gated behind `JOOBLE_API_KEY`. Returns [] when it is missing, so the app
 * behaves identically for anyone who hasn't signed up.
 *
 * Docs: https://jooble.org/api/about  ·  free, informal rate limits,
 * attribution expected per their terms. `POST https://jooble.org/api/{key}`
 * with a JSON body `{ keywords, location, page }`.
 */

import { NormalizedJob, Provider, ProviderContext, ProviderEntry } from './types'
import { stripHtml } from './text'

const JOOBLE_HOST = 'jooble.org'
// Unlike jsearch.ts/adzuna.ts, Jooble ORs every keyword into a single
// request (see the join(', ') below) — the call count is always 1
// regardless of how many titles are included, so there's no quota
// tradeoff to a higher cap here at all. 2026-09-09: raised from a static
// 6 that was arbitrarily leaving 7 of 13 target categories out of Jooble's
// one query for zero benefit.
const MAX_KEYWORDS = 20

interface AggregatorQuery {
  countryCodes?: string[]
  titles?: string[]
  maxAgeDays?: number
  limit?: number
}

interface JoobleJob {
  title?: string
  location?: string
  snippet?: string
  salary?: string
  source?: string
  link?: string
  company?: string
  updated?: string
}

/** Rough ISO country → a location string Jooble understands. Falls back to the raw code. */
const COUNTRY_LOCATION: Record<string, string> = {
  in: 'India',
  gb: 'United Kingdom',
  us: 'United States',
  au: 'Australia',
  ca: 'Canada',
  sg: 'Singapore',
}

function apiKey(): string | undefined {
  return process.env.JOOBLE_API_KEY || undefined
}

function toEpochMs(value?: string): number | undefined {
  if (!value) return undefined
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

function normalize(jobs: JoobleJob[]): NormalizedJob[] {
  return jobs
    .filter((j): j is JoobleJob & { link: string } => typeof j?.link === 'string' && !!j.link)
    .map((j) => ({
      title: stripHtml(j.title) || 'Untitled role',
      url: j.link,
      company: stripHtml(j.company) || stripHtml(j.source),
      location: stripHtml(j.location),
      description: stripHtml(j.snippet),
      postedAt: toEpochMs(j.updated),
    }))
}

const jooble: Provider = {
  id: 'jooble',

  detect(_entry: ProviderEntry) {
    return apiKey() ? { url: `https://${JOOBLE_HOST}/api` } : null
  },

  async fetch(entry: ProviderEntry, ctx: ProviderContext): Promise<NormalizedJob[]> {
    const key = apiKey()
    if (!key) return []

    const query: AggregatorQuery = (entry as { query?: AggregatorQuery }).query ?? {}
    const country = (query.countryCodes?.[0] ?? 'in').toLowerCase()
    const keywords = (query.titles ?? []).map((t) => t.trim()).filter(Boolean).slice(0, MAX_KEYWORDS).join(', ')

    const url = `https://${JOOBLE_HOST}/api/${encodeURIComponent(key)}`

    // Two passes: the target country, then remote-anywhere.
    const locations = [COUNTRY_LOCATION[country] ?? country, 'Remote']

    const out: NormalizedJob[] = []
    for (const location of locations) {
      let json: unknown
      try {
        json = await ctx.fetchJson(url, {
          method: 'POST',
          body: JSON.stringify({ keywords, location, page: '1' }),
          redirect: 'error',
          headers: { 'content-type': 'application/json' },
        })
      } catch (err) {
        throw new Error(`jooble: request failed (${location}) — ${(err as Error).message}`)
      }
      const jobs = Array.isArray((json as { jobs?: unknown })?.jobs) ? (json as { jobs: JoobleJob[] }).jobs : []
      out.push(...normalize(jobs))
      if (ctx.sleep) await ctx.sleep(300)
    }
    return out
  },
}

export default jooble
