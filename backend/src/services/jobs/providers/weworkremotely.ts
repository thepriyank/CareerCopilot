/**
 * We Work Remotely provider — board-wide RSS feed
 * (https://weworkremotely.com/remote-jobs.rss). Public, no-auth, XML —
 * parsed in-process with a small tag extractor rather than adding an XML
 * dependency.
 *
 * Ported from santifer/career-ops (`providers/weworkremotely.mjs`, MIT
 * License, Copyright (c) 2026 Santiago Fernández de Valderrama).
 */

import { NormalizedJob, Provider, ProviderContext, ProviderEntry } from './types'
import { htmlToText } from './text'

const FEED_URL = 'https://weworkremotely.com/remote-jobs.rss'
const TRUSTED_HOST = 'weworkremotely.com'

function assertWwrUrl(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`weworkremotely: invalid URL: ${url}`)
  }
  if (parsed.protocol !== 'https:') throw new Error(`weworkremotely: URL must use HTTPS: ${url}`)
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`weworkremotely: untrusted hostname "${parsed.hostname}" - must be ${TRUSTED_HOST}`)
  }
  return url
}

function toEpochMs(value?: string): number | undefined {
  if (!value) return undefined
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

function fallbackCompany(entry: ProviderEntry): string {
  return entry.name?.trim() ? entry.name.trim() : 'We Work Remotely'
}

function fromCodePoint(cp: number): string {
  try {
    return String.fromCodePoint(cp)
  } catch {
    return ''
  }
}

// Numeric entities decoded first; &amp; decoded LAST so "&amp;lt;" yields
// "&lt;" rather than over-decoding to "<".
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function extractText(inner: string): string {
  const cdata = inner.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/)
  if (cdata) return cdata[1].trim()
  return decodeXmlEntities(inner).trim()
}

function tagText(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  return m ? extractText(m[1]) : ''
}

function cleanUrl(value: string): string {
  if (!value) return ''
  const trimmed = value.trim()
  try {
    const parsed = new URL(trimmed)
    const host = parsed.hostname.toLowerCase()
    const trusted = host === TRUSTED_HOST || host.endsWith(`.${TRUSTED_HOST}`)
    return parsed.protocol === 'https:' && trusted ? parsed.href : ''
  } catch {
    return ''
  }
}

function splitTitle(rawTitle: string, defaultCompany: string): { company: string; title: string } {
  const text = rawTitle.trim()
  const colon = text.indexOf(':')
  if (colon > 0) {
    const company = text.slice(0, colon).trim()
    const title = text.slice(colon + 1).trim()
    if (company && title) return { company, title }
  }
  return { company: defaultCompany, title: text }
}

/** Parse We Work Remotely's public RSS jobs feed. Exported for unit tests. */
export function parseWwrFeed(xml: string, defaultCompany = 'We Work Remotely'): NormalizedJob[] {
  if (typeof xml !== 'string') return []
  const fallback = defaultCompany?.trim() ? defaultCompany.trim() : 'We Work Remotely'
  const jobs: NormalizedJob[] = []
  const blocks = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) || []

  for (const item of blocks) {
    const url = cleanUrl(tagText(item, 'link'))
    if (!url) continue

    const rawTitle = tagText(item, 'title')
    if (!rawTitle) continue

    const { company, title } = splitTitle(rawTitle, fallback)
    const location = tagText(item, 'region') || tagText(item, 'category')

    jobs.push({
      title,
      company,
      location,
      url,
      // tagText already strips the outer CDATA/entities; the inner content is
      // still HTML (the feed embeds a logo <img> plus <p>/<h2>/<ul> markup).
      description: htmlToText(tagText(item, 'description')),
      postedAt: toEpochMs(tagText(item, 'pubDate')),
    })
  }

  return jobs
}

const weworkremotely: Provider = {
  id: 'weworkremotely',

  detect(entry: ProviderEntry) {
    return entry.provider === 'weworkremotely' ? { url: FEED_URL } : null
  },

  async fetch(entry: ProviderEntry, ctx: ProviderContext): Promise<NormalizedJob[]> {
    const feedUrl = assertWwrUrl(FEED_URL)
    const text = await ctx.fetchText(feedUrl, { redirect: 'error' })
    return parseWwrFeed(text, fallbackCompany(entry))
  },
}

export default weworkremotely
