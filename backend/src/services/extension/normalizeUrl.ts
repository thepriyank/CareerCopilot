/**
 * Normalizes a form/application URL for the extension's job-identification
 * matching (see "Job identification" in docs/assisted_apply_extension_plan.md)
 * — deliberately more aggressive than `services/jobs/jobIdentity.ts`'s
 * `canonicalizeUrl`, which intentionally *keeps* query strings because some
 * providers encode the job id there. Here the goal is the opposite: catch
 * the same posting arriving with different tracking junk, since users click
 * through links that pick up `utm_*` etc. Also the ledger key for
 * `ExtensionFill` (quota + idempotency).
 */

const TRACKING_PARAM_PATTERN = /^(utm_|gh_src$|ref$|ref_|source$|fbclid$|gclid$)/i

export function normalizeApplicationUrl(url: string): string {
  const trimmed = url.trim()
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return trimmed.toLowerCase()
  }

  parsed.protocol = parsed.protocol.toLowerCase()
  parsed.hostname = parsed.hostname.toLowerCase()
  parsed.hash = ''

  const kept = [...parsed.searchParams.entries()].filter(([key]) => !TRACKING_PARAM_PATTERN.test(key))
  parsed.search = ''
  for (const [key, value] of kept) parsed.searchParams.append(key, value)

  if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.slice(0, -1)
  }

  return parsed.toString()
}
