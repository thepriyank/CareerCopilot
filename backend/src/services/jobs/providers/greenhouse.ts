/**
 * Greenhouse provider — hits the public boards-api JSON endpoint.
 *
 * Ported from santifer/career-ops (`providers/greenhouse.mjs`, MIT License,
 * Copyright (c) 2026 Santiago Fernández de Valderrama).
 */

import { NormalizedJob, Provider, ProviderContext, ProviderEntry } from './types'

const ALLOWED_GREENHOUSE_HOSTS = new Set([
  'boards-api.greenhouse.io',
  'boards.greenhouse.io',
  'job-boards.greenhouse.io',
  'job-boards.eu.greenhouse.io',
])

function assertGreenhouseUrl(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`greenhouse: invalid URL: ${url}`)
  }
  if (parsed.protocol !== 'https:') throw new Error(`greenhouse: URL must use HTTPS: ${url}`)
  if (!ALLOWED_GREENHOUSE_HOSTS.has(parsed.hostname)) {
    throw new Error(`greenhouse: untrusted hostname "${parsed.hostname}" — must be one of: ${[...ALLOWED_GREENHOUSE_HOSTS].join(', ')}`)
  }
  return url
}

function resolveApiUrl(entry: ProviderEntry): string | null {
  if (entry.api) {
    assertGreenhouseUrl(entry.api)
    return entry.api
  }
  const url = entry.careersUrl || ''
  const match = url.match(/job-boards(?:\.eu)?\.greenhouse\.io\/([^/?#]+)/)
  if (match) return `https://boards-api.greenhouse.io/v1/boards/${match[1]}/jobs`
  return null
}

function toEpochMs(value?: string): number | undefined {
  if (!value) return undefined
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

interface GreenhouseJob {
  title?: string
  absolute_url?: string
  location?: { name?: string }
  first_published?: string
}

const greenhouse: Provider = {
  id: 'greenhouse',

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
    if (!apiUrl) throw new Error(`greenhouse: cannot derive API URL for ${entry.name}`)
    assertGreenhouseUrl(apiUrl)
    const json = (await ctx.fetchJson(apiUrl, { redirect: 'error' })) as { jobs?: GreenhouseJob[] } | null
    const jobs = Array.isArray(json?.jobs) ? json!.jobs! : []
    return jobs
      .filter((j) => !!j.absolute_url)
      .map((j) => ({
        title: j.title || '',
        url: j.absolute_url!,
        company: entry.name,
        location: j.location?.name || '',
        postedAt: toEpochMs(j.first_published),
      }))
  },
}

export default greenhouse
