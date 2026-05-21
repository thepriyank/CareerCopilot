import { Router, Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../config'
import { signToken, requireAuth } from '../middleware/auth'
import { createError } from '../middleware/errorHandler'
import { AuthRequest } from '../types'

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

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body)

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      throw createError(409, 'EMAIL_TAKEN', 'An account with this email already exists')
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { email, passwordHash, name },
      select: { id: true, email: true, name: true, plan: true, createdAt: true },
    })

    const token = signToken(user.id, user.plan)
    res.status(201).json({ user, token })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body)

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      throw createError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      throw createError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
    }

    const token = signToken(user.id, user.plan)
    res.json({
      user: { id: user.id, email: user.email, name: user.name, plan: user.plan },
      token,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { id: true, email: true, name: true, plan: true, region: true, createdAt: true },
    })
    if (!user) throw createError(404, 'USER_NOT_FOUND', 'User not found')
    res.json({ user })
  } catch (err) {
    next(err)
  }
})

export default router
