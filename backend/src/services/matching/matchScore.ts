/**
 * Match scoring (F4) — v2, Tier A of the 2026-09-06 matching redesign.
 *
 * Skill coverage used to be computed by re-running a regex extractor over
 * the job's raw description on every single match/skill-gap/tailor request,
 * then regex-matching the result against the résumé flattened back into
 * plain text (see git history / the matching-redesign memo this replaced).
 * Both sides are now AI-extracted exactly once — the job's skills at
 * discovery time (`services/skills/extractJobSkills.ts`, persisted on
 * `JobListing.skills`), the résumé's at parse time
 * (`services/parsing/entityExtractor.ts`, persisted on
 * `ExtractedEntities.skills`) — so this function just compares two already-
 * clean structured lists. No LLM call happens here; the cost of extraction
 * was already paid once, elsewhere.
 *
 * PRD.md §5/§8 describes "embeddings-based similarity" for the lexical/
 * semantic half of the score. That's `computeSemanticSimilarity()`
 * (services/matching/semanticSimilarity.ts) — deliberately named and kept as
 * its own module so swapping its TF-cosine implementation for a real
 * embedding model (Tier B, deferred post-MVP) never touches this file.
 */

import { computeSemanticSimilarity } from './semanticSimilarity'
import { CandidateProfile } from '../../entities/CandidateProfile'
import { RemotePreference } from '../../entities/enums'

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
}

export type LocationFit = 'remote-ok' | 'location-match' | 'location-mismatch' | 'unknown'
export type SalaryFit = 'within-range' | 'below-range' | 'above-range' | 'unknown'

export interface MatchScoreRationale {
  lexicalSimilarity: number // 0-1, raw, for transparency — sourced from computeSemanticSimilarity()
  matchedSkills: string[]
  missingSkills: string[]
  locationFit: LocationFit
  salaryFit: SalaryFit
}

export interface MatchScoreResult {
  score: number // 0-100
  rationale: MatchScoreRationale
  gaps: string[]
}

const WEIGHTS = { lexical: 0.55, skillCoverage: 0.3, preferenceFit: 0.15 }

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

/**
 * Best-effort only — `JobListing.salary` is free text with no currency
 * field, so this assumes the job's figure and the profile's
 * `salaryCurrency` are the same currency. A clearly wrong comparison
 * (e.g. a USD remote-role figure against an INR profile range) is a known
 * limitation, not something this function can detect from the data it has.
 */
function computeSalaryFit(job: MatchableJob, profile: CandidateProfile | null): SalaryFit {
  if (!job.salary || !profile || (profile.salaryMin == null && profile.salaryMax == null)) return 'unknown'
  const jobRange = parseSalaryRange(job.salary)
  if (!jobRange) return 'unknown'

  const profileMin = profile.salaryMin ?? 0
  const profileMax = profile.salaryMax ?? Number.POSITIVE_INFINITY

  const overlaps = jobRange.max >= profileMin && jobRange.min <= profileMax
  if (overlaps) return 'within-range'
  return jobRange.max < profileMin ? 'below-range' : 'above-range'
}

function preferenceFitScore(locationFit: LocationFit, salaryFit: SalaryFit): number {
  const locationScore = { 'remote-ok': 1, 'location-match': 1, unknown: 0.5, 'location-mismatch': 0 }[locationFit]
  const salaryScore = { 'within-range': 1, unknown: 0.5, 'below-range': 0, 'above-range': 0.5 }[salaryFit]
  return (locationScore + salaryScore) / 2
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
    // No extractable requirements → neutral, not zero (same rule as before the rewrite).
    return { coverage: 0.5, matchedSkills: [], missingSkills: [] }
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
 * Scores a candidate's master resume against a job posting.
 * `resumeText` (flattened prose — see `flattenResumeText`) feeds the
 * semantic-similarity signal; `resumeSkills` (the résumé's own AI-extracted
 * `ExtractedEntities.skills` names) feeds skill coverage directly, no
 * flattening/regex round-trip needed for that half of the score.
 */
export function computeMatchScore(
  resumeText: string,
  resumeSkills: string[],
  job: MatchableJob,
  profile: CandidateProfile | null
): MatchScoreResult {
  const lexicalSimilarity = computeSemanticSimilarity(resumeText, job.description)

  const { coverage: skillCoverage, matchedSkills, missingSkills } = computeSkillCoverage(job.skills, resumeSkills)

  const locationFit = computeLocationFit(job, profile)
  const salaryFit = computeSalaryFit(job, profile)
  const preferenceFit = preferenceFitScore(locationFit, salaryFit)

  const combined =
    lexicalSimilarity * WEIGHTS.lexical + skillCoverage * WEIGHTS.skillCoverage + preferenceFit * WEIGHTS.preferenceFit

  return {
    score: Math.round(combined * 100),
    rationale: {
      lexicalSimilarity: Math.round(lexicalSimilarity * 1000) / 1000,
      matchedSkills,
      missingSkills,
      locationFit,
      salaryFit,
    },
    gaps: missingSkills,
  }
}
