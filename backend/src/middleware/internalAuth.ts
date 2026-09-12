import { Request, Response, NextFunction } from 'express'
import { config } from '../config'
import { createError } from './errorHandler'

/**
 * Shared-secret auth for server-to-server internal routes (currently just
 * POST /api/internal/jobs/ingest — see routes/internalIngest.routes.ts).
 * Not JWT/user auth: there's no user on the other end, just the local
 * JobSpy ingest script (or a future equivalent) authenticated by a bearer
 * token both sides configure out of band.
 */
export function requireInternalAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!config.internalIngest.token) {
    return next(createError(503, 'INTERNAL_INGEST_NOT_CONFIGURED', 'INTERNAL_INGEST_TOKEN is not set'))
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ') || authHeader.slice(7) !== config.internalIngest.token) {
    return next(createError(401, 'UNAUTHORIZED', 'Invalid or missing internal token'))
  }

  next()
}
