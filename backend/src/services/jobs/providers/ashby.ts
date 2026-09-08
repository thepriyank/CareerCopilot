/**
 * Ashby provider — hits the public posting-api endpoint.
 *
 * Ported from santifer/career-ops (`providers/ashby.mjs`, MIT License,
 * Copyright (c) 2026 Santiago Fernández de Valderrama). Ashby's public
 * posting-api carries a ~10s+ server-side latency floor and rate-limits
 * repeated unauthenticated hits, so this uses a longer timeout plus a
 * backoff+jitter retry, exactly as the source does.
 */

import { NormalizedJob, Provider, ProviderContext, ProviderEntry } from './types'

const ASHBY_TIMEOUT_MS = 30_000
const ASHBY_RETRIES = 2

const INTERVAL_MULTIPLIERS: Record<string, number> = {
  '1 HOUR': 2080,
  '1 DAY': 260,
  '1 WEEK': 52,
  '2 WEEK': 26,
  '0.5 MONTH': 24,
  '1 MONTH': 12,
  '2 MONTH': 6,
  '3 MONTH': 4,
  '6 MONTH': 2,
  '1 YEAR': 1,
}

interface AshbyCompensation {
  interval?: string
  minValue?: unknown
  maxValue?: unknown
  currency?: unknown
}

export function parseCompensation(comp: AshbyCompensation | null | undefined): { min: number; max: number; currency: string } | null {
  if (!comp) return null

  const multiplier = INTERVAL_MULTIPLIERS[comp.interval || '1 YEAR']
  if (!multiplier) return null

  const normalizeNum = (v: unknown): number | null => {
    if (v == null) return null
    if (typeof v === 'string' && v.trim() === '') return null
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? n : null
  }
  const minValue = normalizeNum(comp.minValue)
  const maxValue = normalizeNum(comp.maxValue)
  const currency = typeof comp.currency === 'string' ? comp.currency.trim() : ''

  if (minValue == null && maxValue == null) return null

  const min = minValue != null ? minValue * multiplier : null
  const max = maxValue != null ? maxValue * multiplier : null
  if (min == null && max == null) return null

  const resolvedMin = (min ?? max)!
  const resolvedMax = (max ?? min)!
  return {
    min: Math.min(resolvedMin, resolvedMax),
    max: Math.max(resolvedMin, resolvedMax),
    currency: currency.toUpperCase(),
  }
}

const ALLOWED_ASHBY_HOSTS = new Set(['api.ashbyhq.com'])

function assertAshbyUrl(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`ashby: invalid URL: ${url}`)
  }
  if (parsed.protocol !== 'https:') throw new Error(`ashby: URL must use HTTPS: ${url}`)
  if (!ALLOWED_ASHBY_HOSTS.has(parsed.hostname)) {
    throw new Error(`ashby: untrusted hostname "${parsed.hostname}" — must be one of: ${[...ALLOWED_ASHBY_HOSTS].join(', ')}`)
  }
  return url
}

function resolveApiUrl(entry: ProviderEntry): string | null {
  if (entry.api) {
    assertAshbyUrl(entry.api)
    return entry.api
  }
  const url = entry.careersUrl || ''
  const match = url.match(/jobs\.ashbyhq\.com\/([^/?#]+)/)
  if (!match) return null
  return `https://api.ashbyhq.com/posting-api/job-board/${match[1]}?includeCompensation=true`
}

function sleep(ms: number, ctx: ProviderContext): Promise<void> {
  if (typeof ctx.sleep === 'function') return ctx.sleep(ms)
  return new Promise((r) => setTimeout(r, ms))
}

function toEpochMs(value?: string): number | undefined {
  if (!value) return undefined
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

interface AshbySecondaryLocation {
  location?: string
  address?: { postalAddress?: { addressLocality?: string; addressCountry?: string } }
}

interface AshbyJob {
  title?: string
  jobUrl?: string
  location?: string
  secondaryLocations?: AshbySecondaryLocation[]
  compensation?: AshbyCompensation
  publishedAt?: string
}

function formatLocation(j: AshbyJob): string {
  const parts: string[] = []
  if (typeof j.location === 'string' && j.location.trim()) parts.push(j.location.trim())
  if (Array.isArray(j.secondaryLocations)) {
    for (const s of j.secondaryLocations) {
      if (!s || typeof s !== 'object') continue
      if (typeof s.location === 'string' && s.location.trim()) parts.push(s.location.trim())
      const pa = s.address?.postalAddress
      if (pa) {
        for (const k of ['addressLocality', 'addressCountry'] as const) {
          if (typeof pa[k] === 'string' && pa[k]!.trim()) parts.push(pa[k]!.trim())
        }
      }
    }
  }
  return [...new Set(parts)].join(' · ')
}

const ashby: Provider = {
  id: 'ashby',

  detect(entry: ProviderEntry) {
    try {
      const apiUrl = resolveApiUrl(entry)
      return apiUrl ? { url: apiUrl } : null
    } catch {
      return null
    }
  },

  async fetch(entry: ProviderEntry, ctx: ProviderContext): Promise<NormalizedJob[]> {
    const apiUrl = resolveApiUrl(entry)
    if (!apiUrl) throw new Error(`ashby: cannot derive API URL for ${entry.name}`)
    assertAshbyUrl(apiUrl)
    let lastErr: unknown
    for (let attempt = 0; attempt <= ASHBY_RETRIES; attempt++) {
      if (attempt > 0) {
        const backoff = 1000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 500)
        await sleep(backoff, ctx)
      }
      try {
        const json = (await ctx.fetchJson(apiUrl, { timeoutMs: ASHBY_TIMEOUT_MS, redirect: 'error' })) as { jobs?: AshbyJob[] } | null
        const jobs = Array.isArray(json?.jobs) ? json!.jobs! : []
        return jobs.map((j) => ({
          title: j.title || '',
          url: j.jobUrl || '',
          company: entry.name,
          location: formatLocation(j),
          salary: parseCompensation(j.compensation),
          postedAt: toEpochMs(j.publishedAt),
        }))
      } catch (e) {
        lastErr = e
      }
    }
    throw lastErr
  },
}

export default ashby
