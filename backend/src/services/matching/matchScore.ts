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

interface SkillCoverageResult {
  coverage: number
  matchedSkills: string[]
  missingSkills: string[]
}

/** Direct structured-list overlap — both sides are AI-extracted once elsewhere; see this file's header comment. */
function computeSkillCoverage(jobSkills: string[], resumeSkills: string[]): SkillCoverageResult {
  if (jobSkills.length === 0) {
    // No extractable requirements → neutral, not zero (same rule as before the rewrite).
    return { coverage: 0.5, matchedSkills: [], missingSkills: [] }
  }
  const resumeSkillSet = new Set(resumeSkills.map(normalizeSkillName))
  const matchedSkills = jobSkills.filter((s) => resumeSkillSet.has(normalizeSkillName(s)))
  const missingSkills = jobSkills.filter((s) => !resumeSkillSet.has(normalizeSkillName(s)))
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
