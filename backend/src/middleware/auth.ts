import { Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { createError } from './errorHandler'
import { AuthRequest } from '../types'

interface JwtPayload {
  userId: string
  plan: string
}

export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return next(createError(401, 'UNAUTHORIZED', 'Authentication required'))
  }

  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload
    req.userId = payload.userId
    req.userPlan = payload.plan
    next()
  } catch {
    next(createError(401, 'INVALID_TOKEN', 'Invalid or expired token'))
  }
}

export function signToken(userId: string, plan: string): string {
  return jwt.sign({ userId, plan }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions)
}
