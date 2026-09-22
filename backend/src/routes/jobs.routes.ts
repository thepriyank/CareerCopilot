import { Router, Response, NextFunction } from 'express'
import { z } from 'zod'
import { AppDataSource } from '../config/dataSource'
import { User } from '../entities/User'
import { UserJob } from '../entities/UserJob'
import { GeneratedResumeVersion } from '../entities/GeneratedResumeVersion'
import { GeneratedCoverLetter } from '../entities/GeneratedCoverLetter'
import { SkillGapReport } from '../entities/SkillGapReport'
import { MatchResult } from '../entities/MatchResult'
import { CandidateProfile } from '../entities/CandidateProfile'
import { ResumeVersionType, JobOrigin, NotInterestedReason } from '../entities/enums'
import { requireAuth } from '../middleware/auth'
import { llmRateLimit } from '../middleware/rateLimit'
import { createError } from '../middleware/errorHandler'
import { canUseAiJobFeatures } from '../services/plan/matchingAccess'
import { classifySkillGaps } from '../services/skills/jdSkillGap'
import { flattenResumeText } from '../services/skills/resumeText'
import { ensureUserHasJob } from '../services/jobs/discoveryService'
import { ensureMatchedJobsForCandidate } from '../services/matching/surfaceJobs'
import { loadJobView, listJobViews, JobView } from '../services/jobs/jobView'
import { generateCoverLetter } from '../services/ai/coverLetterGenerator'
import { tailorResume } from '../services/ai/resumeTailorer'
import { buildCoverLetterHtml } from '../services/documents/coverLetterTemplate'
import { buildResumeHtml } from '../services/documents/resumeTemplate'
import { renderHtmlToPdf } from '../services/documents/renderPdf'
import { computeMatchScore } from '../services/matching/matchScore'
import { AuthRequest, ExtractedEntities } from '../types'

const router = Router()
router.use(requireAuth)

const createJobSchema = z.object({
  title: z.string().min(1),
  company: z.string().optional(),
  location: z.string().optional(),
  url: z.string().url().optional(),
  salary: z.string().optional(),
  description: z.string().min(1),
  isRemote: z.boolean().optional(),
  source: z.string().optional(),
})

function jobNotFoundError() {
  return createError(404, 'NOT_FOUND', 'Job posting not found')
}

/** Throws the standard 402 for any AI-assisted job action a locked user attempts directly (defense in depth — the UI disables these first). */
function aiFeatureLockedError() {
  return createError(
    402,
    'AI_FEATURE_LOCKED',
    "This isn't available on the free tier. Add your own API key in Settings, or upgrade to unlock it."
  )
}

/** Strips the score from job views a locked caller shouldn't see — surfacing still runs, the score just isn't shown. */
function withScoresHiddenIfLocked<T extends { matchScore: number | null }>(views: T[], locked: boolean): T[] {
  return locked ? views.map((v) => ({ ...v, matchScore: null })) : views
}

// POST /api/jobs — add a job posting (pasted JD). Upserts into the shared
// JobListing pool the same way discovery does (see discoveryService.ts) —
// pasting a URL that's already a known listing (yours or another user's)
// attaches you to that listing instead of creating a duplicate; pasting with
// no URL always creates a fresh listing (nothing to dedupe on).
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createJobSchema.parse(req.body)
    const userId = req.userId!

    const { jobView } = await ensureUserHasJob(
      userId,
      {
        title: data.title,
        company: data.company ?? null,
        location: data.location ?? null,
        url: data.url ?? null,
        salary: data.salary ?? null,
        description: data.description,
        isRemote: data.isRemote ?? null,
        postedAt: null,
        source: data.source ?? 'pasted',
      },
      JobOrigin.PASTED
    )

    res.status(201).json({ job: jobView })
  } catch (err) {
    next(err)
  }
})

// GET /api/jobs — the caller's job board: every job they've manually pasted,
// plus every shared-pool job that scores well enough against their master
// résumé to be worth showing (see services/matching/surfaceJobs.ts) — never
// the raw, unfiltered pool. A candidate with no master résumé yet sees only
// whatever they've pasted (if anything) and `needsMasterResume: true`,
// since there's nothing meaningful to match against yet. Excludes jobs the
// candidate has marked "not interested" unless `?includeNotInterested=true`
// is passed (see PUT/DELETE /:id/not-interested below).
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    const userRepo = AppDataSource.getRepository(User)
    const resumeRepo = AppDataSource.getRepository(GeneratedResumeVersion)
    const profileRepo = AppDataSource.getRepository(CandidateProfile)

    const masterResume = await resumeRepo.findOne({
      where: { userId, type: ResumeVersionType.MASTER },
      order: { createdAt: 'DESC' },
    })

    // Surfacing runs for every user regardless of plan — a FREE user (no
    // active pass, no custom key) still gets new pool jobs matched onto
    // their board by skill match, same threshold as everyone else. What's
    // locked for them is the score itself (stripped below) and every
    // explicit AI action (recompute match, skill gap, tailor, cover
    // letter — see aiFeatureLockedError() and its call sites). See
    // services/plan/matchingAccess.ts's canUseAiJobFeatures() comment.
    const user = await userRepo.findOneBy({ id: userId })
    const locked = user ? !(await canUseAiJobFeatures(user)) : true

    if (masterResume) {
      const profile = await profileRepo.findOneBy({ userId })
      await ensureMatchedJobsForCandidate(userId, profile, masterResume)
    }

    const includeNotInterested = req.query.includeNotInterested === 'true'
    const jobs = await listJobViews(userId, { includeNotInterested })
    res.json({ jobs: withScoresHiddenIfLocked(jobs, locked), needsMasterResume: !masterResume, aiFeaturesLocked: locked })
  } catch (err) {
    next(err)
  }
})

// GET /api/jobs/:id
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    const userRepo = AppDataSource.getRepository(User)
    const user = await userRepo.findOneBy({ id: userId })
    const locked = user ? !(await canUseAiJobFeatures(user)) : true

    const job = await loadJobView(userId, req.params.id as string)
    if (!job) throw jobNotFoundError()
    if (locked) job.matchScore = null
    res.json({ job, aiFeaturesLocked: locked })
  } catch (err) {
    next(err)
  }
})

const setAppliedSchema = z.object({ applied: z.boolean() })

// PUT /api/jobs/:id/applied — marks or unmarks this job as applied
// (UserJob.appliedAt). A deliberate, separate action from opening the
// original posting — nothing else in this file ever sets this.
router.put('/:id/applied', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    const { applied } = setAppliedSchema.parse(req.body)

    const userJobRepo = AppDataSource.getRepository(UserJob)
    const userJob = await userJobRepo.findOneBy({ id: req.params.id as string, userId })
    if (!userJob) throw jobNotFoundError()

    userJob.appliedAt = applied ? new Date() : null
    await userJobRepo.save(userJob)

    const job = await loadJobView(userId, userJob.id)
    res.json({ job })
  } catch (err) {
    next(err)
  }
})

const setNotInterestedSchema = z.object({
  reason: z.nativeEnum(NotInterestedReason),
  note: z.string().max(2000).optional(),
})

// PUT /api/jobs/:id/not-interested — hides this job from the caller's board
// (see services/jobs/jobView.ts's listJobViews) and records why, as a
// structured category plus an optional free-text note. Capturing *why* is
// the whole point — this is meant to become a real preference signal for
// the matching algorithm later (see UserJob.ts's comment / Jira NM-27), not
// consumed by scoring yet, just recorded.
router.put('/:id/not-interested', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    const { reason, note } = setNotInterestedSchema.parse(req.body)

    const userJobRepo = AppDataSource.getRepository(UserJob)
    const userJob = await userJobRepo.findOneBy({ id: req.params.id as string, userId })
    if (!userJob) throw jobNotFoundError()

    userJob.notInterestedAt = new Date()
    userJob.notInterestedReason = reason
    userJob.notInterestedNote = note ?? null
    await userJobRepo.save(userJob)

    const job = await loadJobView(userId, userJob.id)
    res.json({ job })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/jobs/:id/not-interested — undo: clears the dismissal so the
// job reappears on the board.
router.delete('/:id/not-interested', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!

    const userJobRepo = AppDataSource.getRepository(UserJob)
    const userJob = await userJobRepo.findOneBy({ id: req.params.id as string, userId })
    if (!userJob) throw jobNotFoundError()

    userJob.notInterestedAt = null
    userJob.notInterestedReason = null
    userJob.notInterestedNote = null
    await userJobRepo.save(userJob)

    const job = await loadJobView(userId, userJob.id)
    res.json({ job })
  } catch (err) {
    next(err)
  }
})

// POST /api/jobs/:id/skill-gap — classifies this job's AI-extracted skills
// (JobListing.skills — see services/skills/extractJobSkills.ts) against the
// caller's master resume (existing / supported-by-resume prose / real gap),
// persisted as a SkillGapReport.
router.post('/:id/skill-gap', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    const userRepo = AppDataSource.getRepository(User)
    const resumeRepo = AppDataSource.getRepository(GeneratedResumeVersion)
    const skillGapRepo = AppDataSource.getRepository(SkillGapReport)

    const user = await userRepo.findOneBy({ id: userId })
    if (!user || !(await canUseAiJobFeatures(user))) throw aiFeatureLockedError()

    const job = await loadJobView(userId, req.params.id as string)
    if (!job) throw jobNotFoundError()

    const masterResume = await resumeRepo.findOne({
      where: { userId, type: ResumeVersionType.MASTER },
      order: { createdAt: 'DESC' },
    })
    if (!masterResume) {
      throw createError(400, 'NO_MASTER_RESUME', 'Generate a master resume first')
    }

    const resumeText = flattenResumeText(masterResume.content as unknown as ExtractedEntities)
    const classification = classifySkillGaps(job.skills, resumeText)

    const skillGapEntity = skillGapRepo.create({
      userId,
      jobId: job.id,
      roleContext: job.title,
      missingSkills: classification.gap,
      existingSkills: classification.existing,
      supportedByResumeSkills: classification.supportedByResume,
      priorityRanking: [],
    })
    const skillGapReport = await skillGapRepo.save(skillGapEntity)

    res.status(201).json({
      skillGapReport,
      existing: classification.existing,
      supportedByResume: classification.supportedByResume,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/jobs/:id/skill-gap — latest skill-gap classification for this
// job. Hidden (not just blocked from computing new) for a locked user —
// see matchingAccess.ts's canUseAiJobFeatures() comment.
router.get('/:id/skill-gap', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    const userRepo = AppDataSource.getRepository(User)
    const user = await userRepo.findOneBy({ id: userId })
    if (user && !(await canUseAiJobFeatures(user))) {
      res.json({ skillGapReport: null, existing: [], supportedByResume: [] })
      return
    }

    const skillGapRepo = AppDataSource.getRepository(SkillGapReport)
    const skillGapReport = await skillGapRepo.findOne({
      where: { userId, jobId: req.params.id as string },
      order: { createdAt: 'DESC' },
    })
    if (!skillGapReport) {
      res.json({ skillGapReport: null, existing: [], supportedByResume: [] })
      return
    }
    res.json({
      skillGapReport,
      existing: skillGapReport.existingSkills,
      supportedByResume: skillGapReport.supportedByResumeSkills,
    })
  } catch (err) {
    next(err)
  }
})

/** Loads a job + the caller's latest master resume, or throws the same errors the skill-gap route already uses. */
async function loadJobAndMasterResume(userId: string, jobId: string): Promise<{ job: JobView; masterResume: GeneratedResumeVersion }> {
  const resumeRepo = AppDataSource.getRepository(GeneratedResumeVersion)

  const job = await loadJobView(userId, jobId)
  if (!job) throw jobNotFoundError()

  const masterResume = await resumeRepo.findOne({
    where: { userId, type: ResumeVersionType.MASTER },
    order: { createdAt: 'DESC' },
  })
  if (!masterResume) throw createError(400, 'NO_MASTER_RESUME', 'Generate a master resume first')

  return { job, masterResume }
}

/**
 * Throws the standard 402 unless this user is on an active PREMIUM pass
 * (trial or paid) or has their own model connection configured
 * (2026-09-22 — see services/plan/matchingAccess.ts). Tailoring/cover-
 * letter generation genuinely calls an LLM, and anthropicClient.ts's
 * resolveConnection() already transparently routes that call through the
 * user's own key when one's saved, so their usage costs the platform
 * nothing once unlocked this way.
 */
async function assertAiFeatureUnlocked(userId: string): Promise<void> {
  const userRepo = AppDataSource.getRepository(User)
  const user = await userRepo.findOneBy({ id: userId })
  if (!user) throw createError(404, 'USER_NOT_FOUND', 'User not found')
  if (!(await canUseAiJobFeatures(user))) throw aiFeatureLockedError()
}

// POST /api/jobs/:id/cover-letter — generates a job-specific cover letter
// from the caller's master resume + profile (see services/ai/coverLetterGenerator.ts
// for the truthfulness guardrails) and persists it.
router.post('/:id/cover-letter', llmRateLimit, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    await assertAiFeatureUnlocked(userId)
    const { job, masterResume } = await loadJobAndMasterResume(userId, req.params.id as string)

    const profileRepo = AppDataSource.getRepository(CandidateProfile)
    const profile = await profileRepo.findOneBy({ userId })

    const entities = masterResume.content as unknown as ExtractedEntities
    const payload = await generateCoverLetter(job, entities, profile, userId)

    const coverLetterRepo = AppDataSource.getRepository(GeneratedCoverLetter)
    const coverLetter = coverLetterRepo.create({
      userId,
      jobId: job.id,
      content: payload as unknown as Record<string, unknown>,
      provenance: { sourceResumeId: masterResume.id },
    })
    await coverLetterRepo.save(coverLetter)

    res.status(201).json({ coverLetter })
  } catch (err) {
    next(err)
  }
})

// GET /api/jobs/:id/cover-letter — latest cover letter for this job
router.get('/:id/cover-letter', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    const coverLetterRepo = AppDataSource.getRepository(GeneratedCoverLetter)
    const coverLetter = await coverLetterRepo.findOne({
      where: { userId, jobId: req.params.id as string },
      order: { createdAt: 'DESC' },
    })
    res.json({ coverLetter })
  } catch (err) {
    next(err)
  }
})

// GET /api/jobs/:id/cover-letter/pdf
router.get('/:id/cover-letter/pdf', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    const coverLetterRepo = AppDataSource.getRepository(GeneratedCoverLetter)
    const coverLetter = await coverLetterRepo.findOne({
      where: { userId, jobId: req.params.id as string },
      order: { createdAt: 'DESC' },
    })
    if (!coverLetter) throw createError(404, 'NOT_FOUND', 'No cover letter generated for this job yet')

    const html = buildCoverLetterHtml(coverLetter.content as any)
    const pdfBuffer = await renderHtmlToPdf(html, { format: 'a4' })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="cover-letter.pdf"')
    res.send(pdfBuffer)
  } catch (err) {
    next(err)
  }
})

// POST /api/jobs/:id/match — scores the caller's master resume against this
// job (skills/seniority/salary gates + a minor location nudge — see
// services/matching/matchScore.ts's v4 header) and persists a MatchResult.
router.post('/:id/match', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    await assertAiFeatureUnlocked(userId)

    const { job, masterResume } = await loadJobAndMasterResume(userId, req.params.id as string)

    const profileRepo = AppDataSource.getRepository(CandidateProfile)
    const profile = await profileRepo.findOneBy({ userId })

    const entities = masterResume.content as unknown as ExtractedEntities
    const resumeSkills = (entities.skills ?? []).map((s) => s.name).filter(Boolean)
    const result = computeMatchScore(resumeSkills, job, profile)

    const matchRepo = AppDataSource.getRepository(MatchResult)
    const matchResult = matchRepo.create({
      userId,
      jobId: job.id,
      score: result.score,
      rationale: result.rationale as unknown as Record<string, unknown>,
      gaps: result.gaps,
    })
    await matchRepo.save(matchResult)

    res.status(201).json({ matchResult })
  } catch (err) {
    next(err)
  }
})

// GET /api/jobs/:id/match — latest match result for this job. Hidden for
// a locked user, same reasoning as GET /:id/skill-gap above.
router.get('/:id/match', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    const userRepo = AppDataSource.getRepository(User)
    const user = await userRepo.findOneBy({ id: userId })
    if (user && !(await canUseAiJobFeatures(user))) {
      res.json({ matchResult: null })
      return
    }

    const matchRepo = AppDataSource.getRepository(MatchResult)
    const matchResult = await matchRepo.findOne({
      where: { userId, jobId: req.params.id as string },
      order: { createdAt: 'DESC' },
    })
    res.json({ matchResult })
  } catch (err) {
    next(err)
  }
})

// POST /api/jobs/:id/tailor — re-emphasizes the caller's master resume for
// this specific job (see services/ai/resumeTailorer.ts for the no-fabrication
// rules) and persists it as a TAILORED GeneratedResumeVersion.
router.post('/:id/tailor', llmRateLimit, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    await assertAiFeatureUnlocked(userId)
    const { job, masterResume } = await loadJobAndMasterResume(userId, req.params.id as string)

    const entities = masterResume.content as unknown as ExtractedEntities
    const resumeText = flattenResumeText(entities)
    const skillGap = classifySkillGaps(job.skills, resumeText)

    const tailored = await tailorResume(entities, job, skillGap, userId)

    const resumeRepo = AppDataSource.getRepository(GeneratedResumeVersion)
    let tailoredResume = resumeRepo.create({
      userId,
      jobId: job.id,
      sourceResumeId: masterResume.sourceResumeId,
      type: ResumeVersionType.TAILORED,
      content: tailored as unknown as Record<string, unknown>,
      provenance: { sourceMasterResumeId: masterResume.id },
    })
    tailoredResume = await resumeRepo.save(tailoredResume)

    res.status(201).json({ tailoredResume })
  } catch (err) {
    next(err)
  }
})

// GET /api/jobs/:id/tailor — latest tailored resume for this job
router.get('/:id/tailor', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    const resumeRepo = AppDataSource.getRepository(GeneratedResumeVersion)
    const tailoredResume = await resumeRepo.findOne({
      where: { userId, jobId: req.params.id as string, type: ResumeVersionType.TAILORED },
      order: { createdAt: 'DESC' },
    })
    res.json({ tailoredResume })
  } catch (err) {
    next(err)
  }
})

// GET /api/jobs/:id/tailor/pdf
router.get('/:id/tailor/pdf', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    const resumeRepo = AppDataSource.getRepository(GeneratedResumeVersion)
    const tailoredResume = await resumeRepo.findOne({
      where: { userId, jobId: req.params.id as string, type: ResumeVersionType.TAILORED },
      order: { createdAt: 'DESC' },
    })
    if (!tailoredResume) throw createError(404, 'NOT_FOUND', 'No tailored resume generated for this job yet')

    const html = buildResumeHtml(tailoredResume.content as unknown as ExtractedEntities)
    const pdfBuffer = await renderHtmlToPdf(html, { format: 'a4' })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="tailored-resume.pdf"')
    res.send(pdfBuffer)
  } catch (err) {
    next(err)
  }
})

export default router
