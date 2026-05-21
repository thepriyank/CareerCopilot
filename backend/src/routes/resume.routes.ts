import { Router, Response, NextFunction } from 'express'
import path from 'path'
import { z } from 'zod'
import { prisma } from '../config'
import { requireAuth } from '../middleware/auth'
import { uploadMiddleware } from '../middleware/upload'
import { createError } from '../middleware/errorHandler'
import { parseResume } from '../services/parsing/resumeParser'
import { getFileUrl, deleteFile, filenameFromUrl } from '../services/storage/fileStorage'
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
      const fileType = file.mimetype === 'application/pdf' ? 'PDF' : 'DOCX'
      const fileUrl = getFileUrl(file.filename)

      // Create ResumeFile record
      const resumeFile = await prisma.resumeFile.create({
        data: {
          userId,
          fileUrl,
          fileType,
          fileName: file.originalname,
          fileSize: file.size,
        },
      })

      // Create initial ParsedResume with PROCESSING status
      const parsedResume = await prisma.parsedResume.create({
        data: {
          userId,
          sourceFileId: resumeFile.id,
          status: 'PROCESSING',
        },
      })

      // Parse the resume (synchronous for MVP)
      try {
        const parsed = await parseResume(
          path.resolve(process.cwd(), file.path),
          fileType,
          { userId }
        )

        const finalStatus =
          parsed.confidenceScores.overall === 0 ? 'REVIEW_NEEDED' : 'COMPLETED'

        const updated = await prisma.parsedResume.update({
          where: { id: parsedResume.id },
          data: {
            sections: JSON.stringify(parsed.sections),
            extractedEntities: JSON.stringify(parsed.extractedEntities),
            confidenceScores: JSON.stringify(parsed.confidenceScores),
            rawText: parsed.rawText.slice(0, 100_000), // cap stored text
            status: finalStatus,
          },
        })

        res.status(201).json({ resumeFile, parsedResume: updated })
      } catch (parseErr) {
        logger.error('Parse failed after upload', { err: (parseErr as Error).message })
        await prisma.parsedResume.update({
          where: { id: parsedResume.id },
          data: { status: 'FAILED' },
        })
        res.status(201).json({
          resumeFile,
          parsedResume: { ...parsedResume, status: 'FAILED' },
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
    const files = await prisma.resumeFile.findMany({
      where: { userId: req.userId! },
      include: { parsedResume: true },
      orderBy: { uploadedAt: 'desc' },
    })
    res.json({ resumes: files })
  } catch (err) {
    next(err)
  }
})

// GET /api/resumes/:fileId
router.get('/:fileId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const file = await prisma.resumeFile.findFirst({
      where: { id: req.params.fileId, userId: req.userId! },
      include: { parsedResume: true },
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

    const existing = await prisma.parsedResume.findFirst({
      where: { id: req.params.parsedId, userId: req.userId! },
    })
    if (!existing) throw createError(404, 'NOT_FOUND', 'Parsed resume not found')

    const updated = await prisma.parsedResume.update({
      where: { id: req.params.parsedId },
      data: {
        ...(body.sections !== undefined && { sections: JSON.stringify(body.sections) }),
        ...(body.extractedEntities !== undefined && {
          extractedEntities: JSON.stringify(body.extractedEntities),
        }),
        status: 'COMPLETED',
      },
    })
    res.json({ parsedResume: updated })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/resumes/:fileId
router.delete('/:fileId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const file = await prisma.resumeFile.findFirst({
      where: { id: req.params.fileId, userId: req.userId! },
    })
    if (!file) throw createError(404, 'NOT_FOUND', 'Resume not found')

    // Delete file from disk
    deleteFile(filenameFromUrl(file.fileUrl))

    // Cascade deletes parsedResume via Prisma
    await prisma.resumeFile.delete({ where: { id: file.id } })
    res.json({ message: 'Resume deleted' })
  } catch (err) {
    next(err)
  }
})

export default router
