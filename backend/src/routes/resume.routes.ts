import { Router, Response, NextFunction } from 'express'
import { z } from 'zod'
import { AppDataSource } from '../config/dataSource'
import { ResumeFile } from '../entities/ResumeFile'
import { ParsedResume } from '../entities/ParsedResume'
import { GeneratedResumeVersion } from '../entities/GeneratedResumeVersion'
import { FileType, ParseStatus } from '../entities/enums'
import { requireAuth } from '../middleware/auth'
import { uploadMiddleware } from '../middleware/upload'
import { createError } from '../middleware/errorHandler'
import { parseResume } from '../services/parsing/resumeParser'
import {
  getFileUrl,
  deleteFile,
  filenameFromUrl,
  saveEncryptedFile,
  readDecryptedFile,
} from '../services/storage/fileStorage'
import { AuthRequest } from '../types'
import { logger } from '../utils/logger'

const router = Router()

// All resume routes require auth
router.use(requireAuth)

// POST /api/resumes/upload
router.post(
  '/upload',
  (req: AuthRequest, res: Response, next: NextFunction) => {
    uploadMiddleware(req as any, res, (err) => {
      if (err) {
        if (err.message === 'INVALID_FILE_TYPE') {
          return next(
            createError(400, 'INVALID_FILE_TYPE', 'Only PDF and DOCX files are accepted')
          )
        }
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(createError(400, 'FILE_TOO_LARGE', 'File must be under 10 MB'))
        }
        return next(err)
      }
      next()
    })
  },
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw createError(400, 'NO_FILE', 'No file was uploaded')
      }

      const userId = req.userId!
      const file = req.file
      const fileType = file.mimetype === 'application/pdf' ? FileType.PDF : FileType.DOCX
      const ext = fileType === FileType.PDF ? '.pdf' : '.docx'
      const storedFilename = await saveEncryptedFile(file.buffer, ext, userId)
      const fileUrl = getFileUrl(storedFilename)

      const resumeFileRepo = AppDataSource.getRepository(ResumeFile)
      const parsedResumeRepo = AppDataSource.getRepository(ParsedResume)

      // Create ResumeFile record
      const resumeFile = resumeFileRepo.create({
        userId,
        fileUrl,
        fileType,
        fileName: file.originalname,
        fileSize: file.size,
      })
      await resumeFileRepo.save(resumeFile)

      // Create initial ParsedResume with PROCESSING status
      const parsedResume = parsedResumeRepo.create({
        userId,
        sourceFileId: resumeFile.id,
        status: ParseStatus.PROCESSING,
        sections: [],
        extractedEntities: {},
        confidenceScores: {},
      })
      await parsedResumeRepo.save(parsedResume)

      // Parse the resume (synchronous for MVP) — uses the plaintext buffer
      // still in memory from the upload; the on-disk copy is encrypted and
      // never read back in plaintext except via the authenticated download route.
      try {
        const parsed = await parseResume(file.buffer, fileType, { userId })

        const finalStatus =
          parsed.confidenceScores.overall === 0 ? ParseStatus.REVIEW_NEEDED : ParseStatus.COMPLETED

        parsedResume.sections = parsed.sections as unknown[]
        parsedResume.extractedEntities = parsed.extractedEntities as unknown as Record<string, unknown>
        parsedResume.confidenceScores = parsed.confidenceScores as unknown as Record<string, unknown>
        parsedResume.rawText = parsed.rawText.slice(0, 100_000)
        parsedResume.status = finalStatus
        await parsedResumeRepo.save(parsedResume)

        res.status(201).json({ resumeFile, parsedResume })
      } catch (parseErr) {
        logger.error('Parse failed after upload', { err: (parseErr as Error).message })
        parsedResume.status = ParseStatus.FAILED
        await parsedResumeRepo.save(parsedResume)
        res.status(201).json({
          resumeFile,
          parsedResume,
          warning: 'File uploaded but parsing failed. You can retry parsing.',
        })
      }
    } catch (err) {
      next(err)
    }
  }
)

// GET /api/resumes
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const resumeFileRepo = AppDataSource.getRepository(ResumeFile)
    const files = await resumeFileRepo.find({
      where: { userId: req.userId! },
      relations: ['parsedResume'],
      order: { uploadedAt: 'DESC' },
    })
    res.json({ resumes: files })
  } catch (err) {
    next(err)
  }
})

// GET /api/resumes/file/:fileId — authenticated download of the original
// upload. Placed before the generic /:fileId route so it isn't shadowed.
router.get('/file/:fileId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const resumeFileRepo = AppDataSource.getRepository(ResumeFile)
    const file = await resumeFileRepo.findOne({
      where: { id: req.params.fileId as string, userId: req.userId! },
    })
    if (!file) throw createError(404, 'NOT_FOUND', 'Resume not found')

    const buffer = await readDecryptedFile(filenameFromUrl(file.fileUrl))
    const contentType =
      file.fileType === FileType.PDF
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`)
    res.send(buffer)
  } catch (err) {
    next(err)
  }
})

// GET /api/resumes/:fileId
router.get('/:fileId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const resumeFileRepo = AppDataSource.getRepository(ResumeFile)
    const file = await resumeFileRepo.findOne({
      where: { id: req.params.fileId as string, userId: req.userId! },
      relations: ['parsedResume'],
    })
    if (!file) throw createError(404, 'NOT_FOUND', 'Resume not found')
    res.json({ resumeFile: file, parsedResume: file.parsedResume })
  } catch (err) {
    next(err)
  }
})

const updateParsedSchema = z.object({
  sections: z.any().optional(),
  extractedEntities: z.any().optional(),
  notes: z.string().optional(),
})

// PUT /api/resumes/parsed/:parsedId
router.put('/parsed/:parsedId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = updateParsedSchema.parse(req.body)

    const parsedResumeRepo = AppDataSource.getRepository(ParsedResume)
    const existing = await parsedResumeRepo.findOneBy({
      id: req.params.parsedId as string, userId: req.userId!
    })
    if (!existing) throw createError(404, 'NOT_FOUND', 'Parsed resume not found')

    if (body.sections !== undefined) existing.sections = body.sections as unknown[]
    if (body.extractedEntities !== undefined) existing.extractedEntities = body.extractedEntities as Record<string, unknown>
    existing.status = ParseStatus.COMPLETED

    await parsedResumeRepo.save(existing)
    res.json({ parsedResume: existing })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/resumes/:fileId
//
// Fixed 2026-09-07 (found live while verifying the GCS storage migration):
// this 500'd with a Postgres FK violation (23503) on any resume that had
// already been parsed. Neither ParsedResume.sourceFileId -> ResumeFile nor
// GeneratedResumeVersion.sourceResumeId -> ParsedResume has an onDelete
// cascade, so deleting a ResumeFile that still has a ParsedResume (or a
// ParsedResume a master/tailored resume was generated from) violated the FK
// with no cascade to fall back on. Fixed at the application level, not with
// a migration: a GeneratedResumeVersion's `content` is already a full,
// independent snapshot (see resumeEnhancer.ts) — `sourceResumeId` is only a
// provenance breadcrumb, so it's safe to null out before the ParsedResume
// it pointed to is removed.
router.delete('/:fileId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const resumeFileRepo = AppDataSource.getRepository(ResumeFile)
    const parsedResumeRepo = AppDataSource.getRepository(ParsedResume)
    const generatedResumeRepo = AppDataSource.getRepository(GeneratedResumeVersion)

    const file = await resumeFileRepo.findOneBy({
      id: req.params.fileId as string, userId: req.userId!
    })
    if (!file) throw createError(404, 'NOT_FOUND', 'Resume not found')

    // Delete the underlying stored file (local disk or GCS, whichever is active)
    await deleteFile(filenameFromUrl(file.fileUrl))

    const parsedResumes = await parsedResumeRepo.find({ where: { sourceFileId: file.id } })
    if (parsedResumes.length > 0) {
      const parsedResumeIds = parsedResumes.map((pr) => pr.id)
      await generatedResumeRepo
        .createQueryBuilder()
        .update()
        .set({ sourceResumeId: null })
        .where('sourceResumeId IN (:...ids)', { ids: parsedResumeIds })
        .execute()
      await parsedResumeRepo.delete({ sourceFileId: file.id })
    }

    await resumeFileRepo.delete({ id: file.id })

    res.json({ message: 'Resume deleted' })
  } catch (err) {
    next(err)
  }
})

export default router
