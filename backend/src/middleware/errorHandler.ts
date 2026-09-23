import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { logger } from '../utils/logger'

export interface AppError extends Error {
  statusCode?: number
  code?: string
  /**
   * True when `message` was written for the end user (every `createError`
   * call). Anything else — library errors that happen to carry a
   * statusCode (body-parser, multer), or internal errors tagged with a code
   * for routing — never has its message sent to the client.
   */
  userFacing?: boolean // not `expose`: http-errors (body-parser) sets its own `expose: true`
}

/**
 * Builds an error whose message IS shown to the user, so write it as UI
 * copy: plain language, no provider/library names, env vars, ids or
 * internal state. For internal failures that just need a status/code, use
 * `tagError` instead.
 */
export function createError(statusCode: number, code: string, message: string): AppError {
  const err = new Error(message) as AppError
  err.statusCode = statusCode
  err.code = code
  err.userFacing = true
  return err
}

/**
 * Attaches a status + code to an internal error while keeping its technical
 * message for the logs only. The client gets the friendly copy registered
 * for `code` in FRIENDLY_BY_CODE (or the status fallback).
 */
export function tagError<E extends Error>(err: E, statusCode: number, code: string): E & AppError {
  const tagged = err as E & AppError
  tagged.statusCode = statusCode
  tagged.code = code
  tagged.userFacing = false
  return tagged
}

/** User-facing copy for internal error codes whose raw message must not leak. */
export const FRIENDLY_BY_CODE: Record<string, string> = {
  AI_UNAVAILABLE: 'Our AI assistant is busy right now. Please try again in a few minutes.',
  AI_BAD_RESPONSE: "We couldn't finish that just now. Please try again.",
  EXTRACT_FAILED_INTERNAL: "We couldn't read that profile just now. Please try again in a few minutes.",
  USER_NOT_FOUND: "Your payment went through, but we couldn't apply it to your account. Please contact support@jobmagnate.com and we'll sort it out.",
  USER_MODEL_FAILED: "Your saved model connection didn't respond. Check it in Settings → API keys, or remove it to use ours.",
}

const FRIENDLY_BY_STATUS: Record<number, string> = {
  400: "Something about that request wasn't quite right. Please check it and try again.",
  401: 'Please sign in again to continue.',
  403: "You don't have access to that.",
  404: "We couldn't find what you were looking for.",
  409: 'That conflicts with something that already exists.',
  413: 'That file or request is too large.',
  415: "That file type isn't supported.",
  422: "We couldn't process that. Please check it and try again.",
  429: "You're going a bit fast. Please wait a moment and try again.",
}
const GENERIC_MESSAGE = 'Something went wrong on our side. Please try again in a moment.'

/**
 * Last-line check on messages that were meant to be user-facing: anything
 * that reads like a stack trace, HTTP/SDK error, env var, provider name or
 * SQL gets swapped for friendly copy instead. Deliberately conservative —
 * a false positive only costs a less specific message.
 */
const TECHNICAL_PATTERN =
  /\b(status code|stack|ECONN\w*|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|LLM|providers?|openrouter|ollama|cerebras|gemini|groq|deepseek|anthropic|razorpay|redis|postgres|typeorm|sql|relation "|column "|TypeError|ReferenceError|SyntaxError|Unexpected token|undefined|[A-Z][A-Z0-9]*_[A-Z0-9_]{2,})\b|https?:\/\/|\bat \S+ \(/i

export function looksTechnical(message: string): boolean {
  return TECHNICAL_PATTERN.test(message)
}

export function friendlyMessage(statusCode: number, code: string | undefined, message: string, userFacing: boolean): string {
  if (code && FRIENDLY_BY_CODE[code]) return FRIENDLY_BY_CODE[code]
  if (userFacing && message && !looksTechnical(message)) return message
  return FRIENDLY_BY_STATUS[statusCode] ?? GENERIC_MESSAGE
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    // Field-level details used to go back to the client; they described our
    // schema, not anything the user could act on, and nothing read them.
    logger.warn('Request validation failed', { path: req.path, issues: err.errors.map((e) => e.path.join('.')) })
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: FRIENDLY_BY_STATUS[400] },
    })
    return
  }

  // statusCode only — never `.status`: SDK errors (OpenAI, Anthropic) carry the
  // *upstream* status there, and a provider's 401 must not read as "your
  // session expired" to our client.
  const statusCode = err.statusCode ?? 500
  // Only codes we set ourselves (createError / tagError) go to the client —
  // not a library's own (ECONNRESET, LIMIT_FILE_SIZE, 23505…).
  const code = err.userFacing !== undefined && err.code ? err.code : statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'
  const message = friendlyMessage(statusCode, code, err.message, err.userFacing === true)

  if (statusCode >= 500) {
    logger.error('Request failed', { path: req.path, code, message: err.message, stack: err.stack })
  } else if (message !== err.message) {
    // A 4xx whose own message was withheld — keep it for debugging.
    logger.warn('Request rejected (message withheld from client)', { path: req.path, code, message: err.message })
  }

  res.status(statusCode).json({ error: { code, message } })
}
