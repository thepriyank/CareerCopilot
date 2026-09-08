import { Router, Response, NextFunction } from 'express'
import { z } from 'zod'
import { AppDataSource } from '../config/dataSource'
import { LinkedInReviewReport } from '../entities/LinkedInReviewReport'
import { requireAuth } from '../middleware/auth'
import { llmRateLimit } from '../middleware/rateLimit'
import { createError } from '../middleware/errorHandler'
import { reviewLinkedInProfile } from '../services/ai/linkedinReviewer'
import { AuthRequest } from '../types'

const router = Router()
router.use(requireAuth)

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
