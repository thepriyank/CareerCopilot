import { Router, Response, NextFunction } from 'express'
import { z } from 'zod'
import { AppDataSource } from '../config/dataSource'
import { GeneratedResumeVersion } from '../entities/GeneratedResumeVersion'
import { ParsedResume } from '../entities/ParsedResume'
import { CandidateProfile } from '../entities/CandidateProfile'
import { ParseStatus, ResumeVersionType, ArtifactStatus } from '../entities/enums'
import { requireAuth } from '../middleware/auth'
import { llmRateLimit } from '../middleware/rateLimit'
import { createError } from '../middleware/errorHandler'
import { enhanceResume } from '../services/ai/resumeEnhancer'
import { recomputeMatchesForCandidate } from '../services/matching/surfaceJobs'
import { buildResumeHtml } from '../services/documents/resumeTemplate'
import { renderHtmlToPdf } from '../services/documents/renderPdf'
import { AuthRequest } from '../types'
import { ExtractedEntities } from '../types'

const router = Router()
router.use(requireAuth)

// POST /api/resume/master/generate
router.post('/generate', llmRateLimit, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!

    const parsedResumeRepo = AppDataSource.getRepository(ParsedResume)
    const profileRepo = AppDataSource.getRepository(CandidateProfile)
    const generatedResumeRepo = AppDataSource.getRepository(GeneratedResumeVersion)

    // Get the most recent COMPLETED parsed resume
    const parsedResume = await parsedResumeRepo.findOne({
      where: { userId, status: ParseStatus.COMPLETED },
      order: { createdAt: 'DESC' }
    })

    if (!parsedResume) {
      throw createError(400, 'NO_PARSED_RESUME', 'Please upload and parse a resume first')
    }

    // Get candidate profile
    const profile = await profileRepo.findOneBy({ userId })

    if (!profile) {
      throw createError(400, 'NO_PROFILE', 'Please complete the onboarding profile first')
    }

    const entities = typeof parsedResume.extractedEntities === 'string' 
      ? JSON.parse(parsedResume.extractedEntities) 
      : parsedResume.extractedEntities;
      
    const enhancedContent = await enhanceResume(entities as ExtractedEntities, profile, userId)

    let masterResume = generatedResumeRepo.create({
      userId,
      sourceResumeId: parsedResume.id,
      type: ResumeVersionType.MASTER,
      status: ArtifactStatus.DRAFT,
      content: enhancedContent as unknown as Record<string, unknown>,
    })
    
    masterResume = await generatedResumeRepo.save(masterResume)
    
    // Reload with relations for the frontend
    const fullMasterResume = await generatedResumeRepo.findOne({
      where: { id: masterResume.id },
      relations: ['source']
    })

    res.json({ masterResume: fullMasterResume })
  } catch (err) {
    next(err)
  }
})

// GET /api/resume/master
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    
    const generatedResumeRepo = AppDataSource.getRepository(GeneratedResumeVersion)

    // Get the most recent master resume
    const masterResume = await generatedResumeRepo.findOne({
      where: { userId, type: ResumeVersionType.MASTER },
      order: { createdAt: 'DESC' },
      relations: ['source']
    })

    res.json({ masterResume })
  } catch (err) {
    next(err)
  }
})

const updateMasterResumeSchema = z.object({
  content: z.any().optional(),
  status: z.enum(['DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED']).optional()
})

// PUT /api/resume/master/:id
router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    const { id } = req.params
    const data = updateMasterResumeSchema.parse(req.body)

    const generatedResumeRepo = AppDataSource.getRepository(GeneratedResumeVersion)

    const existing = await generatedResumeRepo.findOneBy({
      id: id as string, userId, type: ResumeVersionType.MASTER
    })

    if (!existing) {
      throw createError(404, 'NOT_FOUND', 'Master resume not found')
    }

    const contentChanged = data.content !== undefined
    if (contentChanged) existing.content = data.content as Record<string, unknown>
    if (data.status !== undefined) existing.status = data.status as ArtifactStatus

    await generatedResumeRepo.save(existing)

    // Skills (or anything else scored) may have just changed — refresh
    // every already-matched job's score, not just whichever one the
    // candidate happens to be viewing (see recomputeMatchesForCandidate's
    // header for why this used to silently go stale).
    if (contentChanged) {
      const profileRepo = AppDataSource.getRepository(CandidateProfile)
      const profile = await profileRepo.findOneBy({ userId })
      await recomputeMatchesForCandidate(userId, profile, existing)
    }

    // Reload with the source relation — the editor diffs enhanced content
    // against the original parsed resume, and dropping `source` here (as a
    // bare `save()` result does) blanks that comparison for every bullet.
    const masterResume = await generatedResumeRepo.findOne({
      where: { id: existing.id },
      relations: ['source'],
    })

    res.json({ masterResume })
  } catch (err) {
    next(err)
  }
})

const regenerateSchema = z.object({
  originalText: z.string(),
  currentText: z.string(),
  instruction: z.string().min(1),
})

// POST /api/resume/master/:id/regenerate
router.post('/:id/regenerate', llmRateLimit, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    const { id } = req.params
    const { originalText, currentText, instruction } = regenerateSchema.parse(req.body)

    const generatedResumeRepo = AppDataSource.getRepository(GeneratedResumeVersion)
    const existing = await generatedResumeRepo.findOneBy({
      id: id as string, userId, type: ResumeVersionType.MASTER
    })

    if (!existing) {
      throw createError(404, 'NOT_FOUND', 'Master resume not found')
    }

    const { regenerateSection } = await import('../services/ai/resumeEnhancer')
    const enhancedText = await regenerateSection(originalText, currentText, instruction, userId)

    res.json({ enhancedText })
  } catch (err) {
    next(err)
  }
})

// GET /api/resume/master/:id/pdf — ATS-safe PDF export
router.get('/:id/pdf', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const generatedResumeRepo = AppDataSource.getRepository(GeneratedResumeVersion)
    const masterResume = await generatedResumeRepo.findOneBy({
      id: id as string, userId, type: ResumeVersionType.MASTER,
    })
    if (!masterResume) {
      throw createError(404, 'NOT_FOUND', 'Master resume not found')
    }

    const html = buildResumeHtml(masterResume.content as unknown as ExtractedEntities)
    const pdfBuffer = await renderHtmlToPdf(html, { format: 'a4' })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="master-resume.pdf"')
    res.send(pdfBuffer)
  } catch (err) {
    next(err)
  }
})

export default router
