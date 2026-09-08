import { Router, Response, NextFunction } from 'express'
import { z } from 'zod'
import { AppDataSource } from '../config/dataSource'
import { GeneratedResumeVersion } from '../entities/GeneratedResumeVersion'
import { GeneratedCoverLetter } from '../entities/GeneratedCoverLetter'
import { ApprovalRecord } from '../entities/ApprovalRecord'
import { listJobViews } from '../services/jobs/jobView'
import { ArtifactStatus, ArtifactType } from '../entities/enums'
import { requireAuth } from '../middleware/auth'
import { createError } from '../middleware/errorHandler'
import { AuthRequest, ExtractedEntities } from '../types'

const router = Router()
router.use(requireAuth)

interface ApprovalArtifact {
  id: string
  artifactType: 'resume' | 'cover-letter'
  resumeVersionType?: 'MASTER' | 'TAILORED'
  status: ArtifactStatus
  jobId: string | null
  jobTitle: string | null
  jobCompany: string | null
  updatedAt: Date
  preview: string
}

interface CoverLetterContent {
  letter?: { opening?: string }
}

// GET /api/approvals — "everything waiting on you": every resume version
// (master or tailored) and cover letter the caller has generated that isn't
// already APPROVED, joined with job context for display.
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    const resumeRepo = AppDataSource.getRepository(GeneratedResumeVersion)
    const coverLetterRepo = AppDataSource.getRepository(GeneratedCoverLetter)

    const [allResumes, allCoverLetters, allJobs] = await Promise.all([
      resumeRepo.find({ where: { userId } }),
      coverLetterRepo.find({ where: { userId } }),
      listJobViews(userId),
    ])
    const resumes = allResumes.filter((r) => r.status !== ArtifactStatus.APPROVED)
    const coverLetters = allCoverLetters.filter((c) => c.status !== ArtifactStatus.APPROVED)
    const jobById = new Map(allJobs.map((j) => [j.id, j]))

    const artifacts: ApprovalArtifact[] = [
      ...resumes.map((r) => ({
        id: r.id,
        artifactType: 'resume' as const,
        resumeVersionType: r.type as 'MASTER' | 'TAILORED',
        status: r.status,
        jobId: r.jobId,
        jobTitle: r.jobId ? jobById.get(r.jobId)?.title ?? null : null,
        jobCompany: r.jobId ? jobById.get(r.jobId)?.company ?? null : null,
        updatedAt: r.updatedAt,
        preview: (r.content as unknown as ExtractedEntities).summary ?? '',
      })),
      ...coverLetters.map((c) => ({
        id: c.id,
        artifactType: 'cover-letter' as const,
        status: c.status,
        jobId: c.jobId,
        jobTitle: jobById.get(c.jobId)?.title ?? null,
        jobCompany: jobById.get(c.jobId)?.company ?? null,
        updatedAt: c.updatedAt,
        preview: (c.content as unknown as CoverLetterContent).letter?.opening ?? '',
      })),
    ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

    res.json({ artifacts })
  } catch (err) {
    next(err)
  }
})

const decisionSchema = z.object({
  notes: z.string().optional(),
})

async function applyDecision(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
  decision: ArtifactStatus.APPROVED | ArtifactStatus.REJECTED
): Promise<void> {
  try {
    const userId = req.userId!
    const { type, id } = req.params as { type: string; id: string }
    const { notes } = decisionSchema.parse(req.body ?? {})

    if (type === 'resume') {
      const resumeRepo = AppDataSource.getRepository(GeneratedResumeVersion)
      const resume = await resumeRepo.findOneBy({ id, userId })
      if (!resume) throw createError(404, 'NOT_FOUND', 'Resume version not found')

      resume.status = decision
      await resumeRepo.save(resume)

      const approvalRepo = AppDataSource.getRepository(ApprovalRecord)
      const record = approvalRepo.create({
        userId,
        artifactType: ArtifactType.RESUME_VERSION,
        status: decision,
        notes: notes ?? null,
        resumeVersionId: resume.id,
      })
      await approvalRepo.save(record)

      res.json({ resume, approvalRecord: record })
    } else if (type === 'cover-letter') {
      const coverLetterRepo = AppDataSource.getRepository(GeneratedCoverLetter)
      const coverLetter = await coverLetterRepo.findOneBy({ id, userId })
      if (!coverLetter) throw createError(404, 'NOT_FOUND', 'Cover letter not found')

      coverLetter.status = decision
      await coverLetterRepo.save(coverLetter)

      const approvalRepo = AppDataSource.getRepository(ApprovalRecord)
      const record = approvalRepo.create({
        userId,
        artifactType: ArtifactType.COVER_LETTER,
        status: decision,
        notes: notes ?? null,
        coverLetterId: coverLetter.id,
      })
      await approvalRepo.save(record)

      res.json({ coverLetter, approvalRecord: record })
    } else {
      throw createError(400, 'INVALID_TYPE', 'type must be "resume" or "cover-letter"')
    }
  } catch (err) {
    next(err)
  }
}

// POST /api/approvals/:type/:id/approve
router.post('/:type/:id/approve', (req: AuthRequest, res: Response, next: NextFunction) =>
  applyDecision(req, res, next, ArtifactStatus.APPROVED)
)

// POST /api/approvals/:type/:id/reject
router.post('/:type/:id/reject', (req: AuthRequest, res: Response, next: NextFunction) =>
  applyDecision(req, res, next, ArtifactStatus.REJECTED)
)

export default router
