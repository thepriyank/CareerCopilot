import { Router, Response, NextFunction } from 'express'
import { z } from 'zod'
import { AppDataSource } from '../config/dataSource'
import { LinkedInReviewReport } from '../entities/LinkedInReviewReport'
import { requireAuth } from '../middleware/auth'
import { llmRateLimit } from '../middleware/rateLimit'
import { pdfUploadMiddleware } from '../middleware/upload'
import { createError } from '../middleware/errorHandler'
import { reviewLinkedInProfile } from '../services/ai/linkedinReviewer'
import { extractLinkedInProfileFromPdf } from '../services/ai/linkedinPdfExtractor'
import { AuthRequest } from '../types'

const router = Router()
router.use(requireAuth)

// POST /api/linkedin/extract-pdf — reads headline/about/experience/skills
// out of a LinkedIn "Save to PDF" export (the user's own official export
// of their own profile — never a live-page fetch; see linkedinPdfExtractor.ts
// for why). Returns the extracted text for the user to review/edit in the
// existing paste form; nothing is persisted here, and nothing is analyzed
// until they separately call POST /review on whatever they confirm.
router.post(
  '/extract-pdf',
  llmRateLimit,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    pdfUploadMiddleware(req as any, res, (err) => {
      if (err) {
        if (err.message === 'INVALID_FILE_TYPE') {
          return next(createError(400, 'INVALID_FILE_TYPE', 'Only a PDF export is accepted'))
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
      const extracted = await extractLinkedInProfileFromPdf(req.file.buffer, req.userId!)
      res.json({ extracted })
    } catch (err) {
      // The NO_FILE guard above already produced a proper AppError (a
      // statusCode/code pair via createError) — pass that through as-is.
      // Anything else here comes from extractLinkedInProfileFromPdf itself
      // (bad PDF, unreadable text, AI call failure), which only ever throws
      // plain Errors, so wrap those as a 422 with the real message rather
      // than letting them fall through to a generic 500.
      if (err && typeof err === 'object' && 'statusCode' in err) {
        next(err)
        return
      }
      next(createError(422, 'EXTRACT_FAILED', err instanceof Error ? err.message : 'Could not extract this profile'))
    }
  }
)

const reviewSchema = z
  .object({
    headline: z.string().optional(),
    about: z.string().optional(),
    experience: z.string().optional(),
    skills: z.string().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v?.trim()), {
    message: 'At least one profile section must be provided',
  })

// POST /api/linkedin/review — analyzes the caller's pasted LinkedIn sections
// (see services/ai/linkedinReviewer.ts for the no-fabrication rewrite rule)
// and persists the result.
router.post('/review', llmRateLimit, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    const input = reviewSchema.parse(req.body)

    const result = await reviewLinkedInProfile(input, userId)

    const reportRepo = AppDataSource.getRepository(LinkedInReviewReport)
    const report = reportRepo.create({
      userId,
      sections: result.sections as unknown as Record<string, unknown>,
      suggestions: { headlineRewrites: result.headlineRewrites } as unknown as Record<string, unknown>,
      overallScore: result.overallScore,
    })
    await reportRepo.save(report)

    res.status(201).json({ report })
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(createError(400, 'VALIDATION_ERROR', err.errors[0]?.message ?? 'Invalid request'))
      return
    }
    next(err)
  }
})

// GET /api/linkedin/review — latest review for the caller
router.get('/review', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    const reportRepo = AppDataSource.getRepository(LinkedInReviewReport)
    const report = await reportRepo.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    })
    res.json({ report })
  } catch (err) {
    next(err)
  }
})

export default router
