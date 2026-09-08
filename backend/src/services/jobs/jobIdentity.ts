/**
 * Turns a job's URL into the dedup key `JobListing.urlHash` is keyed on —
 * so the same real posting, however many times it's re-discovered (by
 * different users, or the same user across cron runs), resolves to the same
 * global row. See JobListing.ts's doc comment for why this exists.
 */

import { createHash, randomUUID } from 'crypto'

/**
 * Light-touch normalization — enough to catch the same URL showing up with
 * a different case or a trailing slash, without being clever enough to
 * accidentally collide two different postings. Deliberately does NOT strip
 * query strings: many providers encode the job's actual id there
 * (`?jk=abc123`), so two different postings on the same host and path but a
 * different query are two different jobs, not duplicates.
 */
export function canonicalizeUrl(url: string): string {
  const trimmed = url.trim()
  try {
    const parsed = new URL(trimmed)
    parsed.protocol = parsed.protocol.toLowerCase()
    parsed.hostname = parsed.hostname.toLowerCase()
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1)
    }
    return parsed.toString()
  } catch {
    // Not a parseable absolute URL — fall back to the trimmed original
    // rather than throwing; the hash still dedupes identical garbage
    // consistently even if it can't normalize it.
    return trimmed
  }
}

/**
 * The actual `JobListing.urlHash` value for a given job. A job with no URL
 * (a manual paste with nothing pasted into the link field) gets a random,
 * never-repeating hash — there's nothing to key dedup on, so it never
 * collides with anything, matching today's behavior where paste never
 * deduped either.
 */
export function hashJobUrl(url: string | null | undefined): string {
  if (!url) return `no-url:${randomUUID()}`
  return createHash('sha256').update(canonicalizeUrl(url)).digest('hex')
}
