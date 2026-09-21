/**
 * Match scoring (F4) — v4 (2026-09-21): skills, seniority, and salary are
 * gates a job must clear; location is a minor, non-gating nudge.
 *
 * Replaced v3 (2026-09-13: skillCoverage 2/3 + preferenceFit 1/3, no
 * seniority signal at all) after a real case exposed its failure mode: a
 * 10-YOE Staff/Senior-Staff/EM candidate's résumé contains enough generic
 * skills (Python, SQL, AWS, leadership, ...) that Intern/Junior/entry-level
 * postings needing only a handful of them still scored well under v3 —
 * skill-subset overlap with zero regard for whether the role's actual level
 * was anywhere close. `JobListing.experienceLevel` was already computed at
 * ingestion (classifyTier(title)) and simply never read by scoring.
 *
 * Explicit product decision on what "non-negotiable" means here: skills,
 * years-of-experience fit, and salary fit are each MULTIPLICATIVE gates on
 * the score — a bad enough mismatch on any one of them crushes the overall
 * score even at 100% on the others, because real candidates don't
 * compromise on these. Location is additive and minor (10% of the score,
 * never gates) because it's the one preference people actually *do*
 * negotiate on. Job title is deliberately NOT a scored signal at all —
 * titles for the same real role vary too much across companies ("Staff
 * Engineer" vs "Senior Engineer II" vs "Tech Lead") to be a reliable
 * decision-maker; `CandidateProfile.targetRoles` stays used only for
 * résumé-enhancement/cover-letter prompts, not matching.
 *
 * Seniority and salary are both judged by the LLM at ingestion
 * (services/skills/extractJobSkills.ts), from the JD's title + description
 * + years together — not a regex guess — because judging "is this really a
 * Staff-level role" from surface phrasing is exactly the kind of holistic
 * reading a keyword pattern can't do reliably. See experienceFit.ts for the
 * years-distance comparison against the candidate's own stated
 * `CandidateProfile.yearsOfExperience`.
 *
 * Skill coverage compares two already-AI-extracted structured lists — the
 * job's skills at discovery time (`services/skills/extractJobSkills.ts`,
 * persisted on `JobListing.skills`), the résumé's at parse time
 * (`services/parsing/entityExtractor.ts`, persisted on
 * `ExtractedEntities.skills`). No LLM call happens here; the cost of
 * extraction was already paid once, elsewhere. `avoidTechnologies` is a
 * separate hard exclusion, checked before this function ever runs — see
 * avoidedTechFilter.ts.
 *
 * PRD.md §5/§8's "embeddings-based similarity" direction (the old
 * `services/matching/semanticSimilarity.ts`, deleted 2026-09-13) remains
 * out of this file's roadmap.
 */

import { CandidateProfile } from '../../entities/CandidateProfile'
import { RemotePreference } from '../../entities/enums'
import { computeExperienceFit, resolveJobYearsBand, ExperienceFit } from './experienceFit'

/**
 * The subset of a job's fields scoring actually needs — structural, not
 * `JobView` specifically, so this can score either a candidate's already-
 * attached `JobView` (the `/match` route) or a raw `JobListing` straight
 * from the shared pool before any `UserJob` exists for that candidate (see
 * `services/matching/surfaceJobs.ts`, which scans the whole pool to decide
 * what's worth attaching in the first place).
 */
export interface MatchableJob {
  description: string
  skills: string[]
  isRemote: boolean | null
  location: string | null
  salary: string | null
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  experienceLevel: string | null
  minYearsExperience: number | null
  maxYearsExperience: number | null
}

export type LocationFit = 'remote-ok' | 'location-match' | 'location-mismatch' | 'unknown'
export type SalaryFit = 'within-range' | 'below-range' | 'above-range' | 'unknown'
export type { ExperienceFit }

export interface MatchScoreRationale {
  matchedSkills: string[]
  missingSkills: string[]
  locationFit: LocationFit
  salaryFit: SalaryFit
  experienceFit: ExperienceFit
  // 0-1 raw values feeding the gated formula below — exposed so the UI can
  // show the actual breakdown rather than a bare number.
  skillCoverage: number
  seniorityFit: number
  salaryFitScore: number
  locationFitScore: number
  // Years beyond the job's acceptable band the candidate sits at (0 when
  // closely-matched or unknown) — the concrete number behind experienceFit.
  experienceGapYears: number
}

export interface MatchScoreResult {
  score: number // 0-100
  rationale: MatchScoreRationale
  gaps: string[]
}

// Location is the only negotiable signal here (candidates routinely
// relocate for the right role) — it's additive and capped at 10% of the
// score. The other 90% is the gated product of skills × seniority × salary:
// each is a fraction of 1, so a severe mismatch on any single one pulls the
// whole product down regardless of how good the other two are. This is
// deliberate — see this file's header for why these three don't average
// out a bad mismatch the way a plain weighted sum would.
const LOCATION_WEIGHT = 0.1
const GATED_WEIGHT = 1 - LOCATION_WEIGHT

function computeLocationFit(job: MatchableJob, profile: CandidateProfile | null): LocationFit {
  if (!profile) return 'unknown'
  const remoteFriendlyPreference =
    profile.remotePreference === RemotePreference.REMOTE || profile.remotePreference === RemotePreference.OPEN
  if (job.isRemote && remoteFriendlyPreference) return 'remote-ok'
  if (!job.location || !profile.locations?.length) return 'unknown'

  const jobLocationLower = job.location.toLowerCase()
  const matches = profile.locations.some(
    (loc) => jobLocationLower.includes(loc.toLowerCase()) || loc.toLowerCase().includes(jobLocationLower)
  )
  return matches ? 'location-match' : 'location-mismatch'
}

// Location is negotiable (product decision, 2026-09-21) — "a good match can
// come, location can be adjusted by many candidates." A mismatch still
// costs something (it's real information), but never zeroes out the way a
// non-negotiable gate would; this is a minor additive score, not a gate.
function locationFitScore(locationFit: LocationFit): number {
  return { 'remote-ok': 1, 'location-match': 1, unknown: 0.6, 'location-mismatch': 0.3 }[locationFit]
}

/**
 * Extracts a best-effort numeric range from a free-text salary string
 * (e.g. "12,00,000 - 18,00,000", "$120k - $150k", "₹15L"). Understands `k`
 * (thousands) and `l`/`lakh`/`lac` (hundred-thousands, common in Indian
 * postings) suffixes. Returns null when nothing numeric is found — callers
 * must treat that as "can't tell", not "zero".
 */
export function parseSalaryRange(text: string): { min: number; max: number } | null {
  const matches = [...text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(k|l|lakh|lac)?/gi)]
    .map((m) => {
      const raw = parseFloat(m[1].replace(/,/g, ''))
      if (Number.isNaN(raw)) return null
      const suffix = m[2]?.toLowerCase()
      if (suffix === 'k') return raw * 1_000
      if (suffix === 'l' || suffix === 'lakh' || suffix === 'lac') return raw * 100_000
      return raw
    })
    .filter((n): n is number => n !== null && n > 0)

  if (matches.length === 0) return null
  return { min: Math.min(...matches), max: Math.max(...matches) }
}

const CURRENCY_MARKERS: Array<{ pattern: RegExp; code: string }> = [
  { pattern: /₹|\brs\.?\b|\binr\b|\blpa\b|\blakh\b|\blac\b/i, code: 'INR' },
  { pattern: /\$|\busd\b/i, code: 'USD' },
  { pattern: /£|\bgbp\b/i, code: 'GBP' },
  { pattern: /€|\beur\b/i, code: 'EUR' },
]

/**
 * Best-effort currency sniff from a free-text salary string — used by
 * `upsertJobListing` (discoveryService.ts) to tag the scraper-provided
 * `salary` string's own deterministic parse with a currency, since JobSpy's
 * `build_salary()` always appends one (defaulting to "INR" — see
 * scripts/jobspy-ingest/scrape_and_post.py). Returns null when nothing
 * recognizable is found, which callers must treat as "unknown", never as a
 * default currency — comparing raw numbers across an actually-unknown
 * currency is worse than not comparing at all.
 */
export function detectCurrencyCode(text: string): string | null {
  for (const { pattern, code } of CURRENCY_MARKERS) {
    if (pattern.test(text)) return code
  }
  return null
}

// Genuinely can't tell (no figure on either side, or the two figures are in
// different currencies we can't safely compare) must NOT read as a penalty
// — "if a job doesn't disclose salary... rely on [skills/experience]
// instead" per product decision. Mildly below a full free pass since salary
// is meant to matter once it's actually knowable, matching the same
// UNKNOWN_FIT convention as experienceFit.ts.
const SALARY_UNKNOWN_FIT = 0.85
const SALARY_FLOOR = 0.05
// How steeply a below-range job's fit falls off relative to *how far* short
// of the candidate's minimum ask it pays — e.g. a job paying 50% of what
// the candidate wants (shortfall ratio 0.5) lands at 1 - 0.5*1.5 = 0.25.
const BELOW_RANGE_DECAY = 1.5

function computeSalaryFit(job: MatchableJob, profile: CandidateProfile | null): SalaryFit {
  if (!profile || (profile.salaryMin == null && profile.salaryMax == null)) return 'unknown'
  if (job.salaryMin == null && job.salaryMax == null) return 'unknown'
  if (job.salaryCurrency && profile.salaryCurrency && job.salaryCurrency !== profile.salaryCurrency) return 'unknown'

  const jobMin = job.salaryMin ?? job.salaryMax!
  const jobMax = job.salaryMax ?? job.salaryMin!
  const profileMin = profile.salaryMin ?? 0
  const profileMax = profile.salaryMax ?? Number.POSITIVE_INFINITY

  const overlaps = jobMax >= profileMin && jobMin <= profileMax
  if (overlaps) return 'within-range'
  return jobMax < profileMin ? 'below-range' : 'above-range'
}

/**
 * Numeric counterpart to `computeSalaryFit`'s category — this is what
 * actually feeds the gated score. A job paying *more* than the candidate
 * asked for is never a problem (full credit); paying less decays smoothly
 * with how large the shortfall is, rather than the old binary "below-range
 * = flat penalty" — a job 5% under a candidate's minimum is a much closer
 * call than one at half their minimum.
 */
function salaryFitScore(job: MatchableJob, profile: CandidateProfile | null, category: SalaryFit): number {
  if (category === 'unknown') return SALARY_UNKNOWN_FIT
  if (category === 'within-range' || category === 'above-range') return 1

  // 'below-range': profileMin is guaranteed set whenever this category was
  // reachable above (computeSalaryFit only compares against real numbers).
  const profileMin = profile!.salaryMin ?? profile!.salaryMax!
  const jobMax = job.salaryMax ?? job.salaryMin!
  if (profileMin <= 0) return SALARY_UNKNOWN_FIT // guard against a degenerate 0 minimum

  const shortfall = (profileMin - jobMax) / profileMin
  return Math.max(SALARY_FLOOR, Math.min(1, 1 - shortfall * BELOW_RANGE_DECAY))
}

const normalizeSkillName = (s: string) => s.trim().toLowerCase()

/**
 * Fuzzy skill matching (2026-09-11) — added after a real diagnostic
 * showed exact-string matching missing obviously-equivalent skills
 * purely because a job's AI extraction and a résumé's AI extraction
 * phrased the same thing differently (e.g. a job listing "People
 * Leadership" against a résumé's "Technical leadership" — same fact,
 * zero string overlap, so a strong Engineering Manager match scored
 * one point under the surfacing threshold on skill coverage alone).
 *
 * A small, curated set of common abbreviation/full-name pairs and
 * near-synonymous leadership phrasing — not an attempt at general
 * semantic matching (that's the real embeddings-based "Tier B" this
 * file's header already flags as the deferred, more correct fix).
 * Each entry maps a normalized skill name to a canonical bucket id;
 * two skills match if they share a bucket.
 */
const SKILL_ALIASES: Record<string, string> = {
  'people leadership': 'leadership',
  'technical leadership': 'leadership',
  'team leadership': 'leadership',
  'engineering leadership': 'leadership',
  leadership: 'leadership',

  k8s: 'kubernetes',
  kubernetes: 'kubernetes',
  js: 'javascript',
  javascript: 'javascript',
  ts: 'typescript',
  typescript: 'typescript',
  ml: 'machine learning',
  'machine learning': 'machine learning',
  ai: 'artificial intelligence',
  'artificial intelligence': 'artificial intelligence',
  ui: 'user interface',
  'user interface': 'user interface',
  ux: 'user experience',
  'user experience': 'user experience',
  iac: 'infrastructure as code',
  'infrastructure as code': 'infrastructure as code',
  sre: 'site reliability engineering',
  'site reliability engineering': 'site reliability engineering',
  gcp: 'google cloud platform',
  'google cloud platform': 'google cloud platform',
  aws: 'amazon web services',
  'amazon web services': 'amazon web services',
  oop: 'object oriented programming',
  'object oriented programming': 'object oriented programming',
  'object-oriented programming': 'object oriented programming',
}

/**
 * True when two already-normalized (trim + lowercase) skill names count
 * as the same skill: exact match, one containing the other (catches
 * suffix/prefix variants like "react" / "react.js", "database" /
 * "databases" — length-gated so short strings like "ai" or "js" can't
 * false-positive-match as a substring of an unrelated word; those are
 * still caught by the alias table below), or both resolving to the
 * same alias bucket.
 */
function skillsMatch(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a))) return true
  const bucket = SKILL_ALIASES[a]
  return bucket !== undefined && bucket === SKILL_ALIASES[b]
}

interface SkillCoverageResult {
  coverage: number
  matchedSkills: string[]
  missingSkills: string[]
}

/** Fuzzy structured-list overlap — both sides are AI-extracted once elsewhere; see this file's header comment and skillsMatch() above. */
function computeSkillCoverage(jobSkills: string[], resumeSkills: string[]): SkillCoverageResult {
  if (jobSkills.length === 0) {
    // No extractable requirements → still not zero (a job's skills failing
    // to extract isn't the candidate's fault), but not a full neutral 0.5
    // either — skillCoverage is one of three multiplicative gates now
    // (see this file's header), and a flat 0.5 default previously
    // outscored jobs with genuine, verified partial skill overlap — a real
    // inversion found via 2026-09-13 calibration against the live pool
    // (several Greenhouse/Indeed postings with a failed skill extraction
    // were landing higher purely off this default, while jobs with real
    // 40-50% skill overlap scored lower). Lowered so "we don't know" can
    // never outrank "we checked and it's a real, if partial, match."
    return { coverage: 0.3, matchedSkills: [], missingSkills: [] }
  }
  const normalizedResumeSkills = resumeSkills.map(normalizeSkillName)
  const matchedSkills: string[] = []
  const missingSkills: string[] = []
  for (const skill of jobSkills) {
    const normalized = normalizeSkillName(skill)
    if (normalizedResumeSkills.some((r) => skillsMatch(normalized, r))) {
      matchedSkills.push(skill)
    } else {
      missingSkills.push(skill)
    }
  }
  return { coverage: matchedSkills.length / jobSkills.length, matchedSkills, missingSkills }
}

/**
 * Scores a candidate's master resume against a job posting. `resumeSkills`
 * (the résumé's own AI-extracted `ExtractedEntities.skills` names) feeds
 * skill coverage; `profile` feeds seniority/salary/location fit. No résumé
 * prose/description text is used at all — see this file's header for why
 * (removed 2026-09-13).
 *
 * Skills × seniority × salary are multiplied together (each 0-1) — a severe
 * mismatch on any one crushes the score regardless of the other two, which
 * is the point (see this file's header on why these three are gates, not
 * weighted-average inputs). Location is added on top as a minor, capped
 * bonus since it's the one negotiable preference.
 */
export function computeMatchScore(
  resumeSkills: string[],
  job: MatchableJob,
  profile: CandidateProfile | null
): MatchScoreResult {
  const { coverage: skillCoverage, matchedSkills, missingSkills } = computeSkillCoverage(job.skills, resumeSkills)

  const locationFit = computeLocationFit(job, profile)
  const salaryFit = computeSalaryFit(job, profile)
  const salaryFitValue = salaryFitScore(job, profile, salaryFit)
  const locationFitValue = locationFitScore(locationFit)

  const jobYearsBand = resolveJobYearsBand(job.minYearsExperience, job.maxYearsExperience, job.experienceLevel)
  const experience = computeExperienceFit(profile?.yearsOfExperience ?? null, jobYearsBand)

  const gated = skillCoverage * experience.fit * salaryFitValue
  const combined = gated * GATED_WEIGHT + locationFitValue * LOCATION_WEIGHT

  return {
    score: Math.round(combined * 100),
    rationale: {
      matchedSkills,
      missingSkills,
      locationFit,
      salaryFit,
      experienceFit: experience.label,
      skillCoverage: Math.round(skillCoverage * 1000) / 1000,
      seniorityFit: Math.round(experience.fit * 1000) / 1000,
      salaryFitScore: Math.round(salaryFitValue * 1000) / 1000,
      locationFitScore: Math.round(locationFitValue * 1000) / 1000,
      experienceGapYears: Math.round(experience.gapYears * 10) / 10,
    },
    gaps: missingSkills,
  }
}
