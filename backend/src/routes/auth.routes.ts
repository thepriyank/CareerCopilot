import { Router, Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { AppDataSource } from '../config/dataSource'
import { User } from '../entities/User'
import { AuthProvider, Plan, PlanTier } from '../entities/enums'
import { signToken, requireAuth } from '../middleware/auth'
import { createError } from '../middleware/errorHandler'
import { verifyFirebaseIdToken } from '../services/auth/firebaseAdmin'
import { publicUser } from '../services/auth/publicUser'
import { resolveEffectivePlan, TRIAL_DURATION_MS } from '../services/plan/resolveEffectivePlan'
import { AuthRequest } from '../types'
import { logger } from '../utils/logger'

const router = Router()

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const googleAuthSchema = z.object({
  idToken: z.string().min(1),
})

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body)

    const userRepo = AppDataSource.getRepository(User)

    const existing = await userRepo.findOneBy({ email })
    if (existing) {
      throw createError(409, 'EMAIL_TAKEN', 'An account with this email already exists')
    }

    const passwordHash = await bcrypt.hash(password, 12)
    // Every new signup gets the 15-day free trial automatically — see "The
    // one-month full-access pass" (now 15 days) in docs/monetization_plan.md.
    const user = userRepo.create({
      email,
      passwordHash,
      name: name ?? null,
      authProvider: AuthProvider.PASSWORD,
      plan: Plan.PREMIUM,
      activePlanTier: PlanTier.TRIAL,
      planExpiresAt: new Date(Date.now() + TRIAL_DURATION_MS),
    })
    await userRepo.save(user)

    const token = signToken(user.id, resolveEffectivePlan(user))
    res.status(201).json({ user: publicUser(user), token })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body)

    const userRepo = AppDataSource.getRepository(User)
    const user = await userRepo.findOneBy({ email })
    // A Google-only account has no passwordHash to check — treat it the
    // same as "wrong credentials" rather than let bcrypt.compare throw on
    // a null hash. Same generic message either way: this endpoint must not
    // reveal whether an email exists, let alone how its account was created.
    if (!user || !user.passwordHash) {
      throw createError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      throw createError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
    }

    const token = signToken(user.id, resolveEffectivePlan(user))
    res.json({ user: publicUser(user), token })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/google — sign-in AND sign-up in one flow, exactly how
// Google OAuth conventionally works (there's no separate "register with
// Google"). The client authenticates with Firebase first (Google popup/
// redirect via the Firebase JS SDK) and sends us the resulting ID token;
// we verify it server-side and never trust anything the client asserts
// about its own identity.
//
// Linking behavior: a Google sign-in whose email matches an existing
// password-based account attaches to that SAME account (`firebaseUid`
// backfilled onto it) rather than creating a second, disconnected one —
// one person's résumés/profile/matches must never fork across two rows
// just because they signed in a different way.
router.post('/google', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { idToken } = googleAuthSchema.parse(req.body)

    let decoded
    try {
      decoded = await verifyFirebaseIdToken(idToken)
    } catch (err) {
      logger.warn('Google sign-in failed to verify', { err: (err as Error).message })
      throw createError(401, 'INVALID_GOOGLE_TOKEN', 'Could not verify Google sign-in')
    }

    if (!decoded.email) {
      throw createError(400, 'NO_EMAIL', 'Your Google account has no email address to sign in with')
    }

    const userRepo = AppDataSource.getRepository(User)

    let user = await userRepo.findOneBy({ firebaseUid: decoded.uid })
    let isNewUser = false

    if (!user) {
      // Not linked yet — an existing password account with the same email
      // gets linked instead of duplicated; otherwise this is a real signup.
      user = await userRepo.findOneBy({ email: decoded.email })
      if (user) {
        user.firebaseUid = decoded.uid
        await userRepo.save(user)
      } else {
        isNewUser = true
        const created = userRepo.create({
          email: decoded.email,
          passwordHash: null,
          name: decoded.name ?? null,
          firebaseUid: decoded.uid,
          authProvider: AuthProvider.GOOGLE,
          // Same free trial a password signup gets — see POST /register.
          plan: Plan.PREMIUM,
          activePlanTier: PlanTier.TRIAL,
          planExpiresAt: new Date(Date.now() + TRIAL_DURATION_MS),
        })
        user = await userRepo.save(created)
      }
    }

    const token = signToken(user.id, resolveEffectivePlan(user))
    res.json({ user: publicUser(user), token, isNewUser })
  } catch (err) {
    next(err)
  }
})

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userRepo = AppDataSource.getRepository(User)
    const user = await userRepo.findOne({
      where: { id: req.userId! },
      select: ['id', 'email', 'name', 'plan', 'planExpiresAt', 'activePlanTier', 'settings', 'region', 'createdAt'],
    })
    if (!user) throw createError(404, 'USER_NOT_FOUND', 'User not found')
    res.json({ user: publicUser(user) })
  } catch (err) {
    next(err)
  }
})

export default router
