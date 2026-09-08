/**
 * Reassembles a `UserJob` + its `JobListing` (+ latest `MatchResult`, if
 * any) back into the same flat shape routes and consumers used when job
 * data lived in one per-user `JobPosting` row (see `docs/F4_job_search_and_
 * match_plan.md`'s Phase 0 migration, 2026-09-06). `JobView.id` is the
 * UserJob's id — routes still address a job by that id (`GET
 * /api/jobs/:id`), and every existing frontend/API contract that read a
 * flat job object keeps working unchanged.
 *
 * Read-only by design: creating/updating the underlying rows — including
 * triggering Tier A's skill extraction on a genuinely new listing
 * (`discoveryService.ts`) and deciding which pool listings a candidate
 * even has a `UserJob` for in the first place
 * (`services/matching/surfaceJobs.ts`) — is not this module's job.
 */

import { AppDataSource } from '../../config/dataSource'
import { UserJob } from '../../entities/UserJob'
import { JobListing } from '../../entities/JobListing'
import { MatchResult } from '../../entities/MatchResult'

export interface JobView {
  id: string // UserJob.id — what routes and other tables' `jobId` columns reference
  userId: string
  jobListingId: string
  source: string
  url: string | null
  title: string
  company: string | null
  location: string | null
  salary: string | null
  description: string
  normalizedFields: Record<string, unknown>
  skills: string[]
  experienceLevel: string | null
  isRemote: boolean | null
  createdAt: Date // when THIS user got this job — UserJob's own createdAt, not the listing's
  matchScore: number | null // latest computed MatchResult.score, if one exists yet
}

export function toJobView(userJob: UserJob, listing: JobListing, matchScore: number | null = null): JobView {
  return {
    id: userJob.id,
    userId: userJob.userId,
    jobListingId: listing.id,
    source: listing.source,
    url: listing.url,
    title: listing.title,
    company: listing.company,
    location: listing.location,
    salary: listing.salary,
    description: listing.description,
    normalizedFields: listing.normalizedFields,
    skills: listing.skills,
    experienceLevel: listing.experienceLevel,
    isRemote: listing.isRemote,
    createdAt: userJob.createdAt,
    matchScore,
  }
}

/** The most recent score per UserJob id, for a batch of UserJob ids belonging to one candidate. */
async function latestScoresByUserJobId(userId: string, userJobIds: string[]): Promise<Map<string, number>> {
  if (userJobIds.length === 0) return new Map()
  const matchRepo = AppDataSource.getRepository(MatchResult)
  const results = await matchRepo.find({ where: { userId } })
  const byJobId = new Map<string, MatchResult>()
  for (const r of results) {
    if (!userJobIds.includes(r.jobId)) continue
    const existing = byJobId.get(r.jobId)
    if (!existing || r.createdAt > existing.createdAt) byJobId.set(r.jobId, r)
  }
  return new Map([...byJobId.entries()].map(([jobId, r]) => [jobId, r.score]))
}

/** One user's job by their UserJob id — the `:id` every jobs.routes.ts route takes. Null if not found or not theirs. */
export async function loadJobView(userId: string, userJobId: string): Promise<JobView | null> {
  const userJobRepo = AppDataSource.getRepository(UserJob)
  const userJob = await userJobRepo.findOne({
    where: { id: userJobId, userId },
    relations: ['jobListing'],
  })
  if (!userJob || !userJob.jobListing) return null

  const scores = await latestScoresByUserJobId(userId, [userJob.id])
  return toJobView(userJob, userJob.jobListing, scores.get(userJob.id) ?? null)
}

/**
 * Every job in one user's list, best match first (a pasted job with no
 * score yet sorts after every scored one, then by most recently added).
 */
export async function listJobViews(userId: string): Promise<JobView[]> {
  const userJobRepo = AppDataSource.getRepository(UserJob)
  const userJobs = await userJobRepo.find({
    where: { userId },
    relations: ['jobListing'],
  })
  const withListing = userJobs.filter((uj) => uj.jobListing)

  const scores = await latestScoresByUserJobId(userId, withListing.map((uj) => uj.id))
  const views = withListing.map((uj) => toJobView(uj, uj.jobListing, scores.get(uj.id) ?? null))

  return views.sort((a, b) => {
    if (a.matchScore !== b.matchScore) return (b.matchScore ?? -1) - (a.matchScore ?? -1)
    return b.createdAt.getTime() - a.createdAt.getTime()
  })
}
