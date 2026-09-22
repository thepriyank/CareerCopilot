/**
 * Seniority/experience-of-years fit (2026-09-21 matching redesign) — see
 * matchScore.ts's v4 header comment for the full rationale. This is one of
 * matching's three "non-negotiable" gates (skills, experience, salary) per
 * explicit product decision: unlike location, a candidate doesn't shrug off
 * a job that's 8 years below or above where they are, no matter how well
 * the skills line up.
 *
 * The job side of the comparison is the LLM's own judgment
 * (services/skills/extractJobSkills.ts, run once at ingestion from the full
 * JD + title + any stated years) — explicit years when the JD states them,
 * else a tier-based band. This module only does the numeric comparison
 * against the candidate's own stated `CandidateProfile.yearsOfExperience`.
 */

import { SeniorityTier, TIER_YEARS_BAND } from '../jobs/classifyTier'

export interface YearsBand {
  min: number
  max: number
}

export type ExperienceFit = 'closely-matched' | 'underqualified' | 'overqualified' | 'unknown'

export interface ExperienceFitResult {
  fit: number // 0-1, feeds the multiplicative gate
  label: ExperienceFit
  gapYears: number // 0 when closely matched or unknown; otherwise years beyond the acceptable band
}

// A gap within this many years of the job's stated/inferred band still
// counts as a close match — "closer with 1-2 years difference only" per the
// product decision, not an exact-years requirement.
const ACCEPTABLE_PAD_YEARS = 2

// Beyond the pad, fit decays linearly to FLOOR over this many additional
// years — e.g. a 10-YOE candidate against an entry-level (0-2y) role is
// ~8-10 years outside the padded band, landing at or near FLOOR.
const DECAY_RANGE_YEARS = 6

// Never a literal 0 — leaves a sliver of score so one noisy extraction
// (title/JD misjudged) can't single-handedly hide an otherwise-good match
// from a "why did this never show up" perspective, while still reliably
// pushing the overall gated score below the surfacing threshold.
const FLOOR = 0.05

// Genuinely unknown (candidate hasn't stated years yet, e.g. hasn't
// finished the redesigned onboarding) must NOT be treated as a penalty —
// same "don't fault a match for data we don't have" principle applied to
// salary below. Mildly below a full free pass since seniority is meant to
// matter once the data exists.
const UNKNOWN_FIT = 0.85

/**
 * Resolves a job's years-of-experience band: the JD's own explicit
 * min/max when stated, else an approximate band from its seniority tier.
 * Returns null only if seniorityTier itself is missing/invalid, which
 * shouldn't happen post-2026-09-21 (the extraction always returns one of
 * the eight tiers) but is handled defensively for older/legacy rows.
 */
export function resolveJobYearsBand(
  minYearsExperience: number | null,
  maxYearsExperience: number | null,
  seniorityTier: string | null
): YearsBand | null {
  if (minYearsExperience != null || maxYearsExperience != null) {
    const min = minYearsExperience ?? maxYearsExperience!
    const max = maxYearsExperience ?? minYearsExperience!
    return { min, max }
  }
  const tier = seniorityTier as SeniorityTier | null
  if (tier && tier in TIER_YEARS_BAND) return TIER_YEARS_BAND[tier]
  return null
}

/**
 * Scores how closely a candidate's stated years of experience matches a
 * job's band. Symmetric — too little experience and too much are both a
 * mismatch for job-search relevance (an intern posting is exactly as poor
 * a match for a 10-YOE candidate as a Staff posting would be for a fresh
 * graduate), which is the specific failure this redesign exists to fix.
 */
export function computeExperienceFit(candidateYears: number | null, jobBand: YearsBand | null): ExperienceFitResult {
  if (candidateYears == null || jobBand == null) {
    return { fit: UNKNOWN_FIT, label: 'unknown', gapYears: 0 }
  }

  const lower = jobBand.min - ACCEPTABLE_PAD_YEARS
  const upper = jobBand.max + ACCEPTABLE_PAD_YEARS

  if (candidateYears >= lower && candidateYears <= upper) {
    return { fit: 1, label: 'closely-matched', gapYears: 0 }
  }

  if (candidateYears < lower) {
    const gapYears = lower - candidateYears
    const fit = Math.max(FLOOR, Math.min(1, 1 - gapYears / DECAY_RANGE_YEARS))
    return { fit, label: 'underqualified', gapYears }
  }

  const gapYears = candidateYears - upper
  const fit = Math.max(FLOOR, Math.min(1, 1 - gapYears / DECAY_RANGE_YEARS))
  return { fit, label: 'overqualified', gapYears }
}
