/**
 * Domains the extension must refuse to act on, enforced server-side (never
 * trust a client-side check alone — same principle as quota.ts). Tier 2
 * (generic LLM mapping) works on any form mechanically, which is exactly
 * why this needs to be an explicit runtime gate rather than "we just didn't
 * build an adapter for it" — that argument doesn't hold once there are no
 * per-ATS adapters at all.
 *
 * LinkedIn is excluded per `BRD.md` §9/§10, "unless those are separately
 * revisited" — under discussion 2026-09-14 (comparing this to how a
 * general-purpose AI browser assistant's one-off, user-directed actions
 * differ from a packaged product automating the same platform at scale);
 * not resolved, so it stays blocked here until it is. Naukri, Indeed,
 * Glassdoor and Wellfound/AngelList need the same written per-platform
 * review `BRD.md` §11 requires before any aggregator support — see open
 * question 1 in the plan doc.
 */
const EXCLUDED_DOMAIN_SUFFIXES = [
  'linkedin.com',
  'naukri.com',
  'indeed.com',
  'glassdoor.com',
  'glassdoor.co.in',
  'wellfound.com',
  'angel.co',
]

export function isExcludedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase()
  return EXCLUDED_DOMAIN_SUFFIXES.some((suffix) => lower === suffix || lower.endsWith(`.${suffix}`))
}
