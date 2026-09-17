import { Router, Response, NextFunction } from 'express'
import { AppDataSource } from '../config/dataSource'
import { User } from '../entities/User'
import { Plan } from '../entities/enums'
import { ResumeFile } from '../entities/ResumeFile'
import { ParsedResume } from '../entities/ParsedResume'
import { CandidateProfile } from '../entities/CandidateProfile'
import { listJobViews } from '../services/jobs/jobView'
import { MatchResult } from '../entities/MatchResult'
import { GeneratedResumeVersion } from '../entities/GeneratedResumeVersion'
import { GeneratedCoverLetter } from '../entities/GeneratedCoverLetter'
import { ApprovalRecord } from '../entities/ApprovalRecord'
import { SkillGapReport } from '../entities/SkillGapReport'
import { LinkedInReviewReport } from '../entities/LinkedInReviewReport'
import { requireAuth } from '../middleware/auth'
import { createError } from '../middleware/errorHandler'
import { deleteFile, filenameFromUrl } from '../services/storage/fileStorage'
import { publicUser } from '../services/auth/publicUser'
import { isPassEligible, PASS_DURATION_MS } from '../services/plan/resolveEffectivePlan'
import { AuthRequest } from '../types'

const router = Router()
router.use(requireAuth)

// POST /api/account/activate-pass — a pre-existing user (created before the
// pass shipped) opts into their one-month full-access pass on their own
// terms, rather than being backfilled. See "Existing users: opt in on next
// visit" in docs/monetization_plan.md.
router.post('/activate-pass', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userRepo = AppDataSource.getRepository(User)
    const user = await userRepo.findOneBy({ id: req.userId! })
    if (!user) throw createError(404, 'USER_NOT_FOUND', 'User not found')

    if (!isPassEligible(user)) {
      throw createError(409, 'NOT_ELIGIBLE', 'This account already has a pass, or is not eligible for one')
    }

    user.plan = Plan.PREMIUM
    user.planExpiresAt = new Date(Date.now() + PASS_DURATION_MS)
    await userRepo.save(user)

    res.json({ user: publicUser(user) })
  } catch (err) {
    next(err)
  }
})

// POST /api/account/dismiss-pass-banner — quiets the pass offer without
// hiding it entirely (it's a gift, not a nag — see monetization_plan.md).
// Stored in the existing settings jsonb; no migration needed.
router.post('/dismiss-pass-banner', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userRepo = AppDataSource.getRepository(User)
    const user = await userRepo.findOneBy({ id: req.userId! })
    if (!user) throw createError(404, 'USER_NOT_FOUND', 'User not found')

    user.settings = { ...user.settings, passBannerDismissed: true }
    await userRepo.save(user)

    res.json({ message: 'Dismissed' })
  } catch (err) {
    next(err)
  }
})

// GET /api/account/export — a full JSON dump of everything this account has
// generated. File *bytes* are intentionally excluded (binary, encrypted,
// not meaningful in a JSON export) — only the metadata every other feature
// already surfaces in its own pages.
router.get('/export', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!

    const [
      profile,
      resumeFiles,
      parsedResumes,
      jobs,
      matchResults,
      generatedResumes,
      generatedCoverLetters,
      approvalRecords,
      skillGapReports,
      linkedInReviews,
    ] = await Promise.all([
      AppDataSource.getRepository(CandidateProfile).findOneBy({ userId }),
      AppDataSource.getRepository(ResumeFile).find({ where: { userId } }),
      AppDataSource.getRepository(ParsedResume).find({ where: { userId } }),
      listJobViews(userId),
      AppDataSource.getRepository(MatchResult).find({ where: { userId } }),
      AppDataSource.getRepository(GeneratedResumeVersion).find({ where: { userId } }),
      AppDataSource.getRepository(GeneratedCoverLetter).find({ where: { userId } }),
      AppDataSource.getRepository(ApprovalRecord).find({ where: { userId } }),
      AppDataSource.getRepository(SkillGapReport).find({ where: { userId } }),
      AppDataSource.getRepository(LinkedInReviewReport).find({ where: { userId } }),
    ])

    res.setHeader('Content-Disposition', 'attachment; filename="career-copilot-export.json"')
    res.json({
      exportedAt: new Date().toISOString(),
      profile,
      resumeFiles: resumeFiles.map((f) => ({ id: f.id, fileName: f.fileName, fileType: f.fileType, uploadedAt: f.uploadedAt })),
      parsedResumes,
      jobs,
      matchResults,
      generatedResumeVersions: generatedResumes,
      generatedCoverLetters,
      approvalRecords,
      skillGapReports,
      linkedInReviews,
    })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/account — permanently deletes the account and everything tied
// to it. Every other entity's User relation is onDelete:'CASCADE' at the DB
// level (confirmed across entities/*.ts), so removing the User row is
// sufficient for all rows — the one thing the DB cascade can't reach is the
// encrypted files on disk, so those are cleaned up explicitly first.
router.delete('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    const resumeFileRepo = AppDataSource.getRepository(ResumeFile)
    const userRepo = AppDataSource.getRepository(User)

    const files = await resumeFileRepo.find({ where: { userId } })
    for (const file of files) {
      // deleteFile already logs and swallows its own errors — this loop
      // never aborts account deletion over a storage-layer hiccup.
      await deleteFile(filenameFromUrl(file.fileUrl))
    }

    await userRepo.delete({ id: userId })
    res.json({ message: 'Account deleted' })
  } catch (err) {
    next(err)
  }
})

export default router
