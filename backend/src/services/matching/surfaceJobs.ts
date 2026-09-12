/**
 * Turns the shared `JobListing` pool into one candidate's job board —
 * "ideally a candidate should create and fill their profile first and
 * their discovery stack should only show the jobs that are already matched
 * with their resume, profile and set of skills so they don't see
 * irrelevant data" (2026-09-06 product decision).
 *
 * No LLM call happens here — both sides were AI-extracted once elsewhere
 * (job skills at discovery time, résumé skills at parse time — see
 * matchScore.ts's header comment), so scoring the whole pool against one
 * candidate's résumé is cheap, synchronous, in-process math. That's what
 * makes doing it on every `GET /api/jobs` viable without a background job
 * queue (none exists in this codebase) or the candidate ever clicking
 * anything: the first time a listing scores well enough for a candidate,
 * this lazily creates their `UserJob` (origin=MATCHED) and persists the
 * `MatchResult`, so every existing per-job route (skill-gap/tailor/cover-
 * letter/match) works unchanged the moment they open it — nothing about
 * those routes needed to change for this.
 *
 * Scale note: this scans up to `config.matching.maxListingsToScore` of the
 * most recently-seen listings on every call. Fine at MVP pool sizes
 * (hundreds); a real-scale version would paginate/pre-filter in SQL or
 * maintain a materialized per-candidate view instead of rescanning.
 */

import { AppDataSource } from '../../config/dataSource'
import { JobListing } from '../../entities/JobListing'
import { UserJob } from '../../entities/UserJob'
import { MatchResult } from '../../entities/MatchResult'
import { CandidateProfile } from '../../entities/CandidateProfile'
import { GeneratedResumeVersion } from '../../entities/GeneratedResumeVersion'
import { JobOrigin } from '../../entities/enums'
import { config } from '../../config'
import { computeMatchScore } from './matchScore'
import { hasAvoidedRequiredTech } from './avoidedTechFilter'
import { flattenResumeText } from '../skills/resumeText'
import { ExtractedEntities } from '../../types'

/**
 * Scans the pool and lazily attaches (UserJob + MatchResult) any listing
 * that scores at/above the surfacing threshold and isn't already in this
 * candidate's list. Idempotent — safe to call on every `GET /api/jobs`;
 * a listing already attached (however it got there — matched or pasted)
 * is left alone, never re-scored or duplicated.
 */
export async function ensureMatchedJobsForCandidate(
  userId: string,
  profile: CandidateProfile | null,
  masterResume: Pick<GeneratedResumeVersion, 'content'>
): Promise<{ newlyMatched: number }> {
  const listingRepo = AppDataSource.getRepository(JobListing)
  const userJobRepo = AppDataSource.getRepository(UserJob)
  const matchRepo = AppDataSource.getRepository(MatchResult)

  const entities = masterResume.content as unknown as ExtractedEntities
  const resumeText = flattenResumeText(entities)
  const resumeSkills = (entities.skills ?? []).map((s) => s.name).filter(Boolean)

  const existingUserJobs = await userJobRepo.find({ where: { userId } })
  const attachedListingIds = new Set(existingUserJobs.map((uj) => uj.jobListingId))

  const listings = await listingRepo.find({
    order: { lastSeenAt: 'DESC' },
    take: config.matching.maxListingsToScore,
  })

  let newlyMatched = 0

  const avoidTechnologies = profile?.avoidTechnologies ?? []

  for (const listing of listings) {
    if (attachedListingIds.has(listing.id)) continue // already in their list, however it got there

    // Hard exclusion (2026-09-09), checked before scoring: a listing that
    // *requires* a technology the candidate has avoided is never surfaced
    // at all, not merely scored lower. See avoidedTechFilter.ts's header.
    if (hasAvoidedRequiredTech(listing.normalizedFields, avoidTechnologies)) continue

    const result = computeMatchScore(resumeText, resumeSkills, listing, profile)
    if (result.score < config.matching.minScoreToSurface) continue

    const userJob = await userJobRepo.save(
      userJobRepo.create({ userId, jobListingId: listing.id, origin: JobOrigin.MATCHED })
    )
    await matchRepo.save(
      matchRepo.create({
        userId,
        jobId: userJob.id,
        score: result.score,
        rationale: result.rationale as unknown as Record<string, unknown>,
        gaps: result.gaps,
      })
    )
    newlyMatched++
  }

  return { newlyMatched }
}

/**
 * Recomputes and persists a fresh MatchResult for every job already on
 * this candidate's list, against their current résumé/profile. Without
 * this, editing the résumé (e.g. adding a "missing" skill from a job's
 * Match/Skill-gap section — see jobs/[id]/page.tsx's handleAddSkillToResume)
 * only ever refreshed the one job being viewed; every other already-
 * matched job kept showing a score computed against the résumé's old
 * skill set until a candidate happened to reopen it individually. Called
 * from routes/masterResume.routes.ts's PUT handler whenever `content`
 * actually changes. No LLM call happens here (see this file's header) —
 * fine to run synchronously even across a candidate's whole list.
 */
export async function recomputeMatchesForCandidate(
  userId: string,
  profile: CandidateProfile | null,
  masterResume: Pick<GeneratedResumeVersion, 'content'>
): Promise<{ recomputed: number }> {
  const userJobRepo = AppDataSource.getRepository(UserJob)
  const matchRepo = AppDataSource.getRepository(MatchResult)

  const entities = masterResume.content as unknown as ExtractedEntities
  const resumeText = flattenResumeText(entities)
  const resumeSkills = (entities.skills ?? []).map((s) => s.name).filter(Boolean)

  const userJobs = await userJobRepo.find({ where: { userId }, relations: ['jobListing'] })

  let recomputed = 0
  for (const userJob of userJobs) {
    if (!userJob.jobListing) continue
    const result = computeMatchScore(resumeText, resumeSkills, userJob.jobListing, profile)
    await matchRepo.save(
      matchRepo.create({
        userId,
        jobId: userJob.id,
        score: result.score,
        rationale: result.rationale as unknown as Record<string, unknown>,
        gaps: result.gaps,
      })
    )
    recomputed++
  }

  return { recomputed }
}
