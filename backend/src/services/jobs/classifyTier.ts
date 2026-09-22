/**
 * Seniority-tier classifier for job titles.
 *
 * Originally ported from santifer/career-ops (`classify-tier.mjs`, MIT
 * License, Copyright (c) 2026 Santiago Fernández de Valderrama) with 4
 * tiers (intern/entry/mid/senior). Expanded 2026-09-21 to split the old
 * catch-all 'senior' bucket into senior/staff/principal/director/manager —
 * needed once matching started actually comparing seniority (see
 * matchScore.ts's v4 header): collapsing "Senior Engineer", "Staff
 * Engineer", "Director of Engineering", and "VP Engineering" into one tier
 * made it impossible to tell a Staff-level candidate's target roles apart
 * from a plain Senior IC role.
 *
 * Title-keyword matching only — this is now the ingestion-time FALLBACK for
 * when the LLM-based extraction (services/skills/extractJobSkills.ts, which
 * judges tier from the full JD + title + stated years, not just title
 * keywords) is unavailable, plus a couple of places that display a tier
 * without wanting an LLM call (see JobListing.experienceLevel's comment).
 * Still worth keeping reasonably accurate on its own for that reason.
 */

export type SeniorityTier =
  | 'intern'
  | 'entry'
  | 'mid'
  | 'senior'
  | 'staff'
  | 'principal'
  | 'director'
  | 'manager'

interface Matcher {
  pattern: RegExp | { test: (t: string) => boolean }
  tier: SeniorityTier
  weight: number
}

const matchers: Matcher[] = [
  // Director+ tier (weight 7) — checked above VP/chief-adjacent titles that
  // used to share a bucket with plain "Senior".
  { pattern: /\bchief\b/i, tier: 'director', weight: 7 },
  { pattern: /\bvp\b/i, tier: 'director', weight: 7 },
  { pattern: /\bvice\s+president\b/i, tier: 'director', weight: 7 },
  { pattern: /\bdirector\b/i, tier: 'director', weight: 7 },
  { pattern: /\bhead\s+of\b/i, tier: 'director', weight: 7 },

  // Manager tier (weight 6) — people-management track, distinct from the IC
  // ladder (staff/principal) even at similar seniority.
  { pattern: /\bengineering\s+manager\b/i, tier: 'manager', weight: 6 },
  { pattern: /\bmanager\s*,?\s*engineering\b/i, tier: 'manager', weight: 6 },
  { pattern: /\b(people|team)\s+manager\b/i, tier: 'manager', weight: 6 },
  { pattern: /\bmanager\b/i, tier: 'manager', weight: 6 },

  // Principal tier (weight 5)
  { pattern: /\bprincipal\b/i, tier: 'principal', weight: 5 },
  { pattern: /\b[a-z]{2,}[\s-](v)\b/i, tier: 'principal', weight: 5 },
  { pattern: /\b(l7|l8)\b/i, tier: 'principal', weight: 5 },

  // Staff tier (weight 4.5, between principal and senior)
  { pattern: /\bstaff\b/i, tier: 'staff', weight: 4.5 },
  { pattern: /\b(l6)\b/i, tier: 'staff', weight: 4.5 },

  // Senior tier (weight 4)
  { pattern: /\blead\b/i, tier: 'senior', weight: 4 },
  { pattern: /\bsenior\b/i, tier: 'senior', weight: 4 },
  { pattern: /\bsr\b/i, tier: 'senior', weight: 4 },
  { pattern: /\bsr\./i, tier: 'senior', weight: 4 },
  { pattern: /\b[a-z]{2,}[\s-](iii|iv)\b/i, tier: 'senior', weight: 4 },

  // Mid Tier (weight 3)
  { pattern: /\bmid-level\b/i, tier: 'mid', weight: 3 },
  { pattern: /\bmid\b/i, tier: 'mid', weight: 3 },
  { pattern: /\b[a-z]{2,}[\s-](ii)\b/i, tier: 'mid', weight: 3 },
  { pattern: /\b(l4|l5)\b/i, tier: 'mid', weight: 3 },

  // Entry Tier (weight 2)
  { pattern: /\bentry-level\b/i, tier: 'entry', weight: 2 },
  { pattern: /\bentry\b/i, tier: 'entry', weight: 2 },
  { pattern: /\bassociate\b/i, tier: 'entry', weight: 2 },
  { pattern: /\bjunior\b/i, tier: 'entry', weight: 2 },
  { pattern: /\b[a-z]{2,}[\s-](i)\b/i, tier: 'entry', weight: 2 },
  { pattern: /\b(l1|l2)\b/i, tier: 'entry', weight: 2 },

  // Intern Tier (weight 1)
  { pattern: /\binternship\b/i, tier: 'intern', weight: 1 },
  { pattern: /\bintern\b/i, tier: 'intern', weight: 1 },
  { pattern: /\btrainee\b/i, tier: 'intern', weight: 1 },
  { pattern: /\bco-op\b/i, tier: 'intern', weight: 1 },
  {
    pattern: {
      test: (t: string) => /\bgraduate\b/i.test(t) && /\b(program|scheme)\b/i.test(t),
    },
    tier: 'intern',
    weight: 1,
  },
]

/**
 * Classifies a job title into exactly one seniority tier.
 *
 * Unrecognized or plain titles (e.g. "Software Engineer" with no explicit
 * level indicators) fall back to 'mid' as the default/unknown bucket.
 */
export function classifyTier(title: string): SeniorityTier {
  if (typeof title !== 'string') {
    return 'mid'
  }

  // Preprocess title to avoid false positives with common acronyms
  const cleanTitle = title
    .replace(/\bA\.I\./gi, 'AI')
    .replace(/\bA\.I\b/gi, 'AI')
    .replace(/\bA\.\s+I\b/gi, 'AI')
    .replace(/\bI\.T\./gi, 'IT')
    .replace(/\bI\.T\b/gi, 'IT')
    .replace(/\bI\.\s+T\b/gi, 'IT')
    .replace(/\bi\/o\b/gi, 'IO')

  let bestMatch: Matcher | null = null

  for (const matcher of matchers) {
    if (matcher.pattern.test(cleanTitle)) {
      if (!bestMatch || matcher.weight > bestMatch.weight) {
        bestMatch = matcher
      }
    }
  }

  return bestMatch ? bestMatch.tier : 'mid'
}

/**
 * Approximate years-of-experience band per tier — used by
 * services/matching/experienceFit.ts as the fallback signal when a JD
 * doesn't state an explicit years range (JobListing.minYearsExperience /
 * maxYearsExperience are both null). Deliberately approximate and wide
 * (real hiring bars vary a lot by company) — this only matters for jobs
 * where nothing more precise was extractable.
 */
export const TIER_YEARS_BAND: Record<SeniorityTier, { min: number; max: number }> = {
  intern: { min: 0, max: 0 },
  entry: { min: 0, max: 2 },
  mid: { min: 2, max: 5 },
  senior: { min: 5, max: 8 },
  staff: { min: 8, max: 12 },
  principal: { min: 12, max: 16 },
  manager: { min: 6, max: 14 },
  director: { min: 15, max: 25 },
}

export default classifyTier
