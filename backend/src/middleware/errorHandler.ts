import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { logger } from '../utils/logger'

export interface AppError extends Error {
  statusCode?: number
  code?: string
}

export function createError(statusCode: number, code: string, message: string): AppError {
  const err = new Error(message) as AppError
  err.statusCode = statusCode
  err.code = code
  return err
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.errors,
      },
    })
    return
  }

  const statusCode = err.statusCode ?? 500
  const code = err.code ?? 'INTERNAL_ERROR'
  const message = statusCode === 500 ? 'An unexpected error occurred' : err.message

  if (statusCode === 500) {
    logger.error('Unhandled error', { message: err.message, stack: err.stack })
  }

  res.status(statusCode).json({ error: { code, message } })
}
