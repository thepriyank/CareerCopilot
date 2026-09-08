/**
 * SmartRecruiters provider — hits the public postings API, paginated.
 *
 * Ported from santifer/career-ops (`providers/smartrecruiters.mjs`, MIT
 * License, Copyright (c) 2026 Santiago Fernández de Valderrama).
 */

import { NormalizedJob, Provider, ProviderContext, ProviderEntry } from './types'

const ALLOWED_SMARTRECRUITERS_HOSTS = new Set(['api.smartrecruiters.com'])
const SR_CAREERS_HOSTS = new Set(['careers.smartrecruiters.com', 'jobs.smartrecruiters.com'])
const SR_PAGE_SIZE = 100
const SR_MAX_PAGES = 50 // safety cap (5000 postings @ 100/page)

function assertSmartRecruitersUrl(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`smartrecruiters: invalid URL: ${url}`)
  }
  if (parsed.protocol !== 'https:') throw new Error(`smartrecruiters: URL must use HTTPS: ${url}`)
  if (!ALLOWED_SMARTRECRUITERS_HOSTS.has(parsed.hostname)) {
    throw new Error(`smartrecruiters: untrusted hostname "${parsed.hostname}" — must be one of: ${[...ALLOWED_SMARTRECRUITERS_HOSTS].join(', ')}`)
  }
  return url
}

function resolveSlug(entry: ProviderEntry): string | null {
  for (const raw of [entry.api, entry.careersUrl]) {
    if (typeof raw !== 'string' || !raw) continue
    let parsed: URL
    try {
      parsed = new URL(raw)
    } catch {
      continue
    }
    if (parsed.protocol !== 'https:') continue
    if (!SR_CAREERS_HOSTS.has(parsed.hostname)) continue
    const slug = parsed.pathname.split('/').filter(Boolean)[0]
    if (slug) return slug
  }
  return null
}

function buildPostingsUrl(slug: string, offset = 0): string {
  return `https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=${SR_PAGE_SIZE}&offset=${offset}&status=PUBLIC`
}

function resolveApiUrl(entry: ProviderEntry): string | null {
  const slug = resolveSlug(entry)
  return slug ? buildPostingsUrl(slug, 0) : null
}

interface SmartRecruitersLocation {
  fullLocation?: string
  city?: string
  region?: string
  country?: string
  remote?: boolean
}
interface SmartRecruitersJob {
  id?: string
  name?: string
  ref?: string
  location?: SmartRecruitersLocation
}

/** Parse a SmartRecruiters /postings response. Exported for unit tests. */
export function parseSmartRecruitersResponse(json: { content?: unknown } | null, companyName: string): NormalizedJob[] {
  const items = json?.content
  if (!Array.isArray(items)) return []
  return (items as SmartRecruitersJob[]).map((j) => {
    const loc = j.location || {}
    const fullLocation = loc.fullLocation || [loc.city, loc.region, loc.country].filter(Boolean).join(', ')
    const remote = loc.remote ? 'Remote' : ''
    const location = [fullLocation, remote].filter(Boolean).join(', ')
    const slugified = (j.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    let url = ''
    if (typeof j.ref === 'string') {
      let parsedRef: URL | null
      try {
        parsedRef = new URL(j.ref)
      } catch {
        parsedRef = null
      }
      if (
        parsedRef &&
        parsedRef.protocol === 'https:' &&
        parsedRef.hostname === 'api.smartrecruiters.com' &&
        parsedRef.pathname.startsWith('/v1/companies/')
      ) {
        const restOfPath = parsedRef.pathname.slice('/v1/companies/'.length)
        url = `https://jobs.smartrecruiters.com/${restOfPath}`
      }
    }
    if (!url && j.id) {
      const companySlug = (companyName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      if (companySlug) {
        url = `https://jobs.smartrecruiters.com/${companySlug}/${j.id}-${slugified}`
      }
    }
    return { title: j.name || '', url, location, company: companyName }
  })
}

const smartrecruiters: Provider = {
  id: 'smartrecruiters',

  detect(entry: ProviderEntry) {
    const apiUrl = resolveApiUrl(entry)
    return apiUrl ? { url: apiUrl } : null
  },

  async fetch(entry: ProviderEntry, ctx: ProviderContext): Promise<NormalizedJob[]> {
    const slug = resolveSlug(entry)
    if (!slug) throw new Error(`smartrecruiters: cannot derive API URL for ${entry.name}`)

    const all: NormalizedJob[] = []
    for (let page = 0; page < SR_MAX_PAGES; page++) {
      const apiUrl = buildPostingsUrl(slug, page * SR_PAGE_SIZE)
      assertSmartRecruitersUrl(apiUrl)
      const json = (await ctx.fetchJson(apiUrl, { redirect: 'error' })) as { content?: unknown } | null
      const parsed = parseSmartRecruitersResponse(json, entry.name)
      if (parsed.length === 0) break
      all.push(...parsed)
      if (parsed.length < SR_PAGE_SIZE) break
    }
    return all
  },
}

export default smartrecruiters
