/**
 * Lever provider — hits the public postings endpoint.
 *
 * Ported from santifer/career-ops (`providers/lever.mjs`, MIT License,
 * Copyright (c) 2026 Santiago Fernández de Valderrama).
 */

import { NormalizedJob, Provider, ProviderContext, ProviderEntry } from './types'

const ALLOWED_LEVER_HOSTS = new Set(['api.lever.co', 'api.eu.lever.co'])

function assertLeverUrl(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`lever: invalid URL: ${url}`)
  }
  if (parsed.protocol !== 'https:') throw new Error(`lever: URL must use HTTPS: ${url}`)
  if (!ALLOWED_LEVER_HOSTS.has(parsed.hostname)) {
    throw new Error(`lever: untrusted hostname "${parsed.hostname}" — must be one of: ${[...ALLOWED_LEVER_HOSTS].join(', ')}`)
  }
  return url
}

function resolveApiUrl(entry: ProviderEntry): string | null {
  if (entry.api) {
    assertLeverUrl(entry.api)
    return entry.api
  }
  let url: URL
  try {
    url = new URL(entry.careersUrl || '')
  } catch {
    return null
  }
  const host = url.hostname.match(/^jobs\.((?:eu\.)?lever\.co)$/)
  if (!host) return null
  const slug = url.pathname.split('/').filter(Boolean)[0]
  if (!slug) return null
  return `https://api.${host[1]}/v0/postings/${slug}`
}

interface LeverJob {
  text?: string
  hostedUrl?: string
  categories?: { location?: string }
  descriptionPlain?: string
  createdAt?: number
}

const lever: Provider = {
  id: 'lever',

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
    if (!apiUrl) throw new Error(`lever: cannot derive API URL for ${entry.name}`)
    assertLeverUrl(apiUrl)
    const json = (await ctx.fetchJson(apiUrl, { redirect: 'error' })) as LeverJob[] | null
    if (!Array.isArray(json)) return []
    return json.map((j) => ({
      title: j.text || '',
      url: j.hostedUrl || '',
      company: entry.name,
      location: j.categories?.location || '',
      description: typeof j.descriptionPlain === 'string' ? j.descriptionPlain : '',
      postedAt: typeof j.createdAt === 'number' ? j.createdAt : undefined,
    }))
  },
}

export default lever
