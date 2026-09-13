import { Router, Response, NextFunction } from 'express'
import { z } from 'zod'
import { AppDataSource } from '../config/dataSource'
import { User } from '../entities/User'
import { UserJob } from '../entities/UserJob'
import { ExtensionToken } from '../entities/ExtensionToken'
import { ExtensionFill } from '../entities/ExtensionFill'
import { requireAuth } from '../middleware/auth'
import { requireExtensionAuth, mintExtensionToken, hashExtensionToken } from '../middleware/extensionAuth'
import { createError } from '../middleware/errorHandler'
import { resolveEffectivePlan } from '../services/plan/resolveEffectivePlan'
import { Plan } from '../entities/enums'
import { normalizeApplicationUrl } from '../services/extension/normalizeUrl'
import { resolveJobForUrl } from '../services/extension/resolveJob'
import { resolveArtifactsForJob } from '../services/extension/resolveArtifacts'
import { buildExtensionProfileFields } from '../services/extension/profileFields'
import { FREE_MONTHLY_FILL_LIMIT, currentFillWindowStart, countFillsInWindow, findRecentFill } from '../services/extension/quota'
import { AuthRequest } from '../types'

const router = Router()

/** Credits left this window for a FREE user, or null for PREMIUM (unlimited — see resolveEffectivePlan). */
async function remainingFills(user: User): Promise<number | null> {
  if (resolveEffectivePlan(user) === Plan.PREMIUM) return null
  const windowStart = currentFillWindowStart(user.createdAt)
  const used = await countFillsInWindow(user.id, windowStart)
  return Math.max(0, FREE_MONTHLY_FILL_LIMIT - used)
}

// ─── Tokens — session-authed (Settings UI mints/lists/revokes; the ────────
// extension itself never calls these) ───────────────────────────────────

const mintTokenSchema = z.object({ label: z.string().min(1).max(100).optional() })

// POST /api/extension/tokens — mints a new extension token. Returns the
// plaintext exactly once; only its hash is ever stored.
router.post('/tokens', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { label } = mintTokenSchema.parse(req.body ?? {})
    const token = mintExtensionToken()

    const tokenRepo = AppDataSource.getRepository(ExtensionToken)
    const record = tokenRepo.create({
      userId: req.userId!,
      tokenHash: hashExtensionToken(token),
      label: label ?? 'Browser extension',
      lastUsedAt: null,
      revokedAt: null,
    })
    await tokenRepo.save(record)

    res.status(201).json({
      token,
      id: record.id,
      label: record.label,
      createdAt: record.createdAt,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/extension/tokens — for Settings' "Connected extensions" list.
// Explicitly maps to a safe subset rather than relying on a query-level
// `select` — tokenHash must never reach a response.
router.get('/tokens', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tokenRepo = AppDataSource.getRepository(ExtensionToken)
    const tokens = await tokenRepo.find({
      where: { userId: req.userId! },
      order: { createdAt: 'DESC' },
    })
    res.json({
      tokens: tokens.map((t) => ({
        id: t.id,
        label: t.label,
        createdAt: t.createdAt,
        lastUsedAt: t.lastUsedAt,
        revokedAt: t.revokedAt,
      })),
    })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/extension/tokens/:id — revoke. Idempotent: revoking an
// already-revoked token just succeeds again rather than erroring.
router.delete('/tokens/:id', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tokenRepo = AppDataSource.getRepository(ExtensionToken)
    const record = await tokenRepo.findOneBy({ id: req.params.id as string, userId: req.userId! })
    if (!record) throw createError(404, 'NOT_FOUND', 'Extension token not found')

    if (!record.revokedAt) {
      record.revokedAt = new Date()
      await tokenRepo.save(record)
    }

    res.json({ message: 'Revoked' })
  } catch (err) {
    next(err)
  }
})

// ─── Everything below is extension-token-authed ────────────────────────

// GET /api/extension/profile — profile fields + plan + remaining credits,
// for display. Consumes nothing.
router.get('/profile', requireExtensionAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userRepo = AppDataSource.getRepository(User)
    const user = await userRepo.findOneBy({ id: req.userId! })
    if (!user) throw createError(404, 'USER_NOT_FOUND', 'User not found')

    const [fields, remaining] = await Promise.all([
      buildExtensionProfileFields(user.id),
      remainingFills(user),
    ])

    res.json({
      profile: fields,
      plan: resolveEffectivePlan(user),
      remainingFills: remaining,
    })
  } catch (err) {
    next(err)
  }
})

const fillSchema = z.object({ url: z.string().min(1) })

// POST /api/extension/fills — the one that matters. Atomically consumes a
// credit and returns the fill payload in the same call: if you got a
// payload, you were charged for it; if you're out, 402 and no payload.
// Idempotent per (user, normalized URL) for 24h — a reload or a validation
// error must not burn a second credit.
router.post('/fills', requireExtensionAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { url } = fillSchema.parse(req.body)
    const userId = req.userId!
    const normalizedUrl = normalizeApplicationUrl(url)

    const userRepo = AppDataSource.getRepository(User)
    const user = await userRepo.findOneBy({ id: userId })
    if (!user) throw createError(404, 'USER_NOT_FOUND', 'User not found')

    const { job, candidates } = await resolveJobForUrl(userId, url)
    const jobId = job?.id ?? null

    const existing = await findRecentFill(userId, normalizedUrl)
    const effectivePlan = resolveEffectivePlan(user)

    if (!existing) {
      if (effectivePlan !== Plan.PREMIUM) {
        const windowStart = currentFillWindowStart(user.createdAt)
        const used = await countFillsInWindow(userId, windowStart)
        if (used >= FREE_MONTHLY_FILL_LIMIT) {
          throw createError(402, 'OUT_OF_CREDITS', `You've used all ${FREE_MONTHLY_FILL_LIMIT} autofills for this period`)
        }
      }

      const fillRepo = AppDataSource.getRepository(ExtensionFill)
      const fill = fillRepo.create({ userId, normalizedUrl, jobId })
      await fillRepo.save(fill)
    }

    const artifacts = await resolveArtifactsForJob(userId, jobId)
    const profile = await buildExtensionProfileFields(userId)
    const remaining = await remainingFills(user)

    res.json({
      profile,
      job,
      candidates: job ? [] : candidates,
      ...artifacts,
      remainingFills: remaining,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/extension/jobs/resolve?url= — job identification: the matching
// UserJob, or a shortlist of candidates for the "which job is this?" picker
// when nothing matched. Consumes nothing (unlike POST /fills).
router.get('/jobs/resolve', requireExtensionAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const url = req.query.url
    if (typeof url !== 'string' || !url) {
      throw createError(400, 'MISSING_URL', 'A url query parameter is required')
    }

    const resolution = await resolveJobForUrl(req.userId!, url)
    res.json(resolution)
  } catch (err) {
    next(err)
  }
})

// GET /api/extension/jobs/:id/artifacts — approved tailored résumé + cover
// letter for a job (APPROVED only — reuses the F6 approval check).
router.get('/jobs/:id/artifacts', requireExtensionAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    const jobId = req.params.id as string

    const userJobRepo = AppDataSource.getRepository(UserJob)
    const userJob = await userJobRepo.findOneBy({ id: jobId, userId })
    if (!userJob) throw createError(404, 'NOT_FOUND', 'Job not found')

    const artifacts = await resolveArtifactsForJob(userId, jobId)
    res.json(artifacts)
  } catch (err) {
    next(err)
  }
})

const applicationSchema = z.object({ jobId: z.string().uuid() })

// POST /api/extension/applications — logs a fill/apply event. Reuses
// UserJob.appliedAt (the same field PUT /api/jobs/:id/applied sets) rather
// than a new entity — see "Application logging" in the plan doc.
router.post('/applications', requireExtensionAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { jobId } = applicationSchema.parse(req.body)
    const userId = req.userId!

    const userJobRepo = AppDataSource.getRepository(UserJob)
    const userJob = await userJobRepo.findOneBy({ id: jobId, userId })
    if (!userJob) throw createError(404, 'NOT_FOUND', 'Job not found')

    userJob.appliedAt = new Date()
    await userJobRepo.save(userJob)

    res.json({ message: 'Marked as applied' })
  } catch (err) {
    next(err)
  }
})

export default router
