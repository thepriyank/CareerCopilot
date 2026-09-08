import { Router, Response, NextFunction } from 'express'
import { AppDataSource } from '../config/dataSource'
import { User } from '../entities/User'
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
import { deleteFile, filenameFromUrl } from '../services/storage/fileStorage'
import { AuthRequest } from '../types'

const router = Router()
router.use(requireAuth)

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
