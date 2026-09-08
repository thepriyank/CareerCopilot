/**
 * RemoteOK provider — board-wide aggregator feed (https://remoteok.com/api).
 * Returns the latest ~100 remote postings; index 0 is a metadata object and
 * is skipped.
 *
 * Ported from santifer/career-ops (`providers/remoteok.mjs`, MIT License,
 * Copyright (c) 2026 Santiago Fernández de Valderrama).
 */

import { NormalizedJob, Provider, ProviderContext, ProviderEntry } from './types'
import { htmlToText } from './text'

const FEED_URL = 'https://remoteok.com/api'

interface RemoteOkJob {
  position?: string
  url?: string
  company?: string
  location?: string
  description?: string
  salary_min?: number
  salary_max?: number
}

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
}

/**
 * RemoteOK's feed returns some fields with undecoded HTML entities (`&amp;`)
 * and UTF-8 bytes mis-decoded as Latin-1 (mojibake, e.g. "Ã©" for "é"). Both
 * are cleaned up here rather than left for downstream consumers to trip over.
 */
function cleanText(text: string): string {
  let out = text.replace(/&#(\d+);|&#x([0-9a-f]+);|&\w+;/gi, (m, dec, hex) => {
    if (dec) return String.fromCodePoint(parseInt(dec, 10))
    if (hex) return String.fromCodePoint(parseInt(hex, 16))
    return HTML_ENTITIES[m] ?? m
  })
  // Mojibake fix: bytes that are valid UTF-8 but got decoded as Latin-1/CP1252
  // round-trip cleanly back to the correct text via latin1 -> utf8.
  try {
    const reencoded = Buffer.from(out, 'latin1').toString('utf8')
    if (!reencoded.includes('�')) out = reencoded
  } catch {
    // leave `out` as-is on any encoding edge case
  }
  return out
}

/** Cleans mojibake/entities first, then strips the feed's HTML description down to plain text (line structure preserved for skill-gap parsing). */
function cleanDescription(html: string): string {
  return htmlToText(cleanText(html))
}

const remoteok: Provider = {
  id: 'remoteok',

  detect(entry: ProviderEntry) {
    return entry.provider === 'remoteok' ? { url: FEED_URL } : null
  },

  async fetch(entry: ProviderEntry, ctx: ProviderContext): Promise<NormalizedJob[]> {
    // redirect:'error' prevents SSRF via server-side redirects
    const data = (await ctx.fetchJson(FEED_URL, { redirect: 'error' })) as unknown

    if (!Array.isArray(data)) {
      throw new Error(`remoteok: unexpected API response — expected a JSON array, got ${data === null ? 'null' : typeof data}`)
    }

    return (data as RemoteOkJob[])
      .filter(
        (j) =>
          j &&
          typeof j === 'object' &&
          typeof j.position === 'string' &&
          j.position.trim() !== '' &&
          typeof j.url === 'string' &&
          /^https?:\/\//i.test(j.url.trim())
      )
      .map((j) => ({
        title: cleanText(j.position!.trim()),
        url: j.url!.trim(),
        company: cleanText(
          typeof j.company === 'string' && j.company.trim() ? j.company.trim() : entry.name || 'RemoteOK'
        ),
        location: typeof j.location === 'string' ? cleanText(j.location.trim()) : '',
        description: typeof j.description === 'string' ? cleanDescription(j.description) : '',
        salary:
          typeof j.salary_min === 'number' && typeof j.salary_max === 'number' && j.salary_min > 0 && j.salary_max > 0
            ? { min: j.salary_min, max: j.salary_max, currency: 'USD' }
            : null,
      }))
  },
}

export default remoteok
