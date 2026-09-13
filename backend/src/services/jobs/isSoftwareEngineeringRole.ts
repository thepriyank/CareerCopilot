/**
 * Software-engineering domain filter for a job title.
 *
 * Why this exists (2026-09-09): `runProvidersForDiscovery`'s remote-board
 * providers (RemoteOK/WeWorkRemotely/Himalayas) and ATS providers
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
  /\bproduct\s+manager/i,
  /\bproject\s+manager/i,
  /\bprogram\s+manager/i,
  /\bmarketing\b/i,
  /\bsales\b/i,
  /\brecruit(er|ing)\b/i,
  /\bexecutive\s+assistant/i,
  /\bpersonal\s+assistant/i,
  /\bhuman\s+resources?\b|\bhr\s+(manager|specialist|generalist)/i,
  /\baccountant\b|\baccounting\b/i,
  /\blegal\b|\battorney\b|\bparalegal\b/i,
]

const INCLUDE_PATTERNS: RegExp[] = [
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
]

export function isSoftwareEngineeringRole(title: string | null | undefined): boolean {
  if (!title) return false
  if (EXCLUDE_PATTERNS.some((p) => p.test(title))) return false
  return INCLUDE_PATTERNS.some((p) => p.test(title))
}
