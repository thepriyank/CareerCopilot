/**
 * Domain filter for a job title — software engineering plus the other
 * trending tech and corporate roles Jobmagnate matches candidates against.
 *
 * Why this exists (2026-09-09, broadened 2026-09-17): `runProvidersForDiscovery`'s
 * remote-board providers (RemoteOK/WeWorkRemotely/Himalayas) and ATS providers
 * (Greenhouse et al., via `seeds/india-companies.json`) return *everything*
 * on those feeds — there's no title/query filtering at the source, unlike
 * the keyword-search aggregators (JSearch/Adzuna/Jooble/TheirStack), which
 * only ever query `target-job-titles.json`'s list. A real pull surfaced
 * plenty of noise this way (e.g. "Executive Personal Assistant to the
 * Founder"). This filter is the actual gate applied to every discovered
 * job in `discoverJobsGlobally()` regardless of source — the seed list
 * only bounds what the keyword-search providers ask for, it doesn't filter
 * what a board/ATS provider hands back.
 *
 * Originally scoped to pure software-engineering titles only. Broadened
 * 2026-09-17 per product decision to also accept the other tech roles
 * (cloud/security/data/design) and corporate roles (product, business,
 * finance, growth marketing, customer success, HR business partner) that
 * research (LinkedIn Jobs on the Rise, WEF Future of Jobs 2026, India
 * hiring-trend surveys) flagged as consistently trending alongside software
 * engineering — see target-job-titles.json's _comment for the same research.
 * Deliberately still excludes generic/administrative corporate noise
 * (recruiter, executive/personal assistant, accountant, legal, generic
 * project/program manager) — the INCLUDE list stays a curated allowlist,
 * not a blanket admit of every corporate title.
 *
 * Keyword matching, not an LLM call — this runs on every discovery tick
 * against hundreds of titles; a regex pass costs nothing and is completely
 * deterministic, unlike an LLM classification that would burn provider
 * quota and add latency for something this mechanical.
 */

const EXCLUDE_PATTERNS: RegExp[] = [
  // Titles containing "engineer" that aren't software engineering roles —
  // checked first so e.g. "Sales Engineer" never falls through to a
  // positive match on "engineer" alone (there is no such broad match, but
  // this stays as the first, cheapest check either way).
  /\bsales\s+engineer/i,
  /\b(customer|support|success)\s+engineer/i,
  /\bfield\s+(service\s+)?engineer/i,
  /\bnetwork\s+engineer/i,
  /\b(mechanical|electrical|civil|chemical|industrial)\s+engineer/i,
  /\bsystems?\s+administrator/i,
  /\bproject\s+manager/i,
  /\bprogram\s+manager/i,
  /\brecruit(er|ing)\b/i,
  /\bexecutive\s+assistant/i,
  /\bpersonal\s+assistant/i,
  /\bhuman\s+resources?\b|\bhr\s+(manager|specialist|generalist)/i,
  /\baccountant\b|\baccounting\b/i,
  /\blegal\b|\battorney\b|\bparalegal\b/i,
]

const INCLUDE_PATTERNS: RegExp[] = [
  // -- Software engineering (original scope) --
  /\bsoftware\s+(development\s+)?engineer/i,
  /\bsde\b|\bswe\b/i,
  /\b(front[\s-]?end|back[\s-]?end|full[\s-]?stack)\s+(engineer|developer)/i,
  /\bdeveloper\b/i,
  /\bprogrammer\b/i,
  /\b(ai|ml|machine\s+learning|artificial\s+intelligence)\s+engineer/i,
  /\bdata\s+engineer/i,
  /\bplatform\s+engineer/i,
  /\b(devops|site\s+reliability|sre)\s+engineer/i,
  /\bcloud\s+engineer/i,
  /\b(qa|quality\s+assurance)\s+engineer/i,
  /\bsdet\b/i,
  /\bengineering\s+manager/i,
  /\btech(nical)?\s+lead\b/i,
  /\b(staff|principal|lead|senior|sr\.?)\s+(software\s+)?engineer/i,
  /\bmobile\s+(engineer|developer)/i,
  /\b(ios|android)\s+(engineer|developer)/i,

  // -- Other trending tech roles (2026-09-17) --
  /\bcloud\s+(solutions?\s+)?architect/i,
  /\b(cyber\s*security|security)\s+(analyst|engineer|specialist)/i,
  /\bmlops\s+engineer/i,
  /\bdata\s+scientist/i,
  /\bdata\s+analyst/i,
  /\b(ux|ui|product)\s+designer/i,

  // -- Trending corporate roles (2026-09-17) --
  /\bproduct\s+manager/i,
  /\bbusiness\s+analyst/i,
  /\bfinancial\s+analyst/i,
  /\b(growth|digital)\s+marketing\s+(manager|specialist)/i,
  /\bcustomer\s+success\s+manager/i,
  /\bhr\s+business\s+partner\b|\bpeople\s+operations\b/i,
  /\brevenue\s+operations\b/i,
]

export function isAcceptedJobRole(title: string | null | undefined): boolean {
  if (!title) return false
  if (EXCLUDE_PATTERNS.some((p) => p.test(title))) return false
  return INCLUDE_PATTERNS.some((p) => p.test(title))
}
