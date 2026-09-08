/**
 * Aggregates the caller's per-job SkillGapReport rows (from jdSkillGap.ts,
 * computed per job in POST /api/jobs/:id/skill-gap) into one ranked list
 * across their whole job search — "what's the one thing worth learning
 * first, given everywhere it's blocking me."
 *
 * Weighting: a missing skill counts for more when it belongs to a job the
 * candidate is matching poorly on (a bad match score means the gap is more
 * likely the reason), and when it recurs across multiple jobs. Both are
 * real signals already sitting in the database — no new LLM call needed.
 */

export interface SkillGapReportInput {
  jobId: string | null
  missingSkills: unknown[]
}

export interface AggregatedGap {
  skill: string
  weight: number // 0-100, higher = more worth learning next
  frequency: number // number of distinct jobs where this skill was missing
  tier: 'critical' | 'high' | 'medium' | 'low'
}

const DEFAULT_WEIGHT_NO_MATCH_YET = 50 // a job never scored yet — treat as moderately important

function tierFor(weight: number): AggregatedGap['tier'] {
  if (weight >= 75) return 'critical'
  if (weight >= 55) return 'high'
  if (weight >= 35) return 'medium'
  return 'low'
}

export function aggregateSkillGaps(
  reports: SkillGapReportInput[],
  matchScoreByJobId: Map<string, number>
): AggregatedGap[] {
  const totals = new Map<string, { totalWeight: number; frequency: number }>()

  for (const report of reports) {
    const matchScore = report.jobId ? matchScoreByJobId.get(report.jobId) : undefined
    const jobWeight = matchScore === undefined ? DEFAULT_WEIGHT_NO_MATCH_YET : 100 - matchScore

    for (const raw of report.missingSkills) {
      const skill = String(raw)
      const existing = totals.get(skill) ?? { totalWeight: 0, frequency: 0 }
      existing.totalWeight += jobWeight
      existing.frequency += 1
      totals.set(skill, existing)
    }
  }

  return [...totals.entries()]
    .map(([skill, { totalWeight, frequency }]) => {
      const weight = Math.round(totalWeight / frequency)
      return { skill, weight, frequency, tier: tierFor(weight) }
    })
    .sort((a, b) => b.weight - a.weight || b.frequency - a.frequency)
}
