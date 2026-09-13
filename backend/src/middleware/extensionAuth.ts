import { Response, NextFunction } from 'express'
import { randomBytes, createHash } from 'crypto'
import { AppDataSource } from '../config/dataSource'
import { ExtensionToken } from '../entities/ExtensionToken'
import { createError } from './errorHandler'
import { AuthRequest } from '../types'

const TOKEN_PREFIX = 'ext_'

/** Mints a new plaintext extension token — 32 random bytes, hex-encoded, prefixed. Returned to the caller exactly once. */
export function mintExtensionToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString('hex')
}

/** SHA-256 of the full bearer value (prefix included) — the only form ever persisted. A DB leak must not yield working tokens. */
export function hashExtensionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// Authenticates `/api/extension/*` routes the extension itself calls
// (everything except token mint/list/revoke, which stay session-JWT-authed
// via requireAuth — see routes/extension.routes.ts). Distinct from the web
// app's short-lived JWT: this is a long-lived, individually revocable
// credential meant to live in chrome.storage.local. See "Authentication" in
// docs/assisted_apply_extension_plan.md.
export async function requireExtensionAuth(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ') || !authHeader.slice(7).startsWith(TOKEN_PREFIX)) {
      next(createError(401, 'UNAUTHORIZED', 'A valid extension token is required'))
      return
    }

    const token = authHeader.slice(7)
    const tokenRepo = AppDataSource.getRepository(ExtensionToken)
    const record = await tokenRepo.findOneBy({ tokenHash: hashExtensionToken(token) })

    if (!record || record.revokedAt) {
      next(createError(401, 'INVALID_TOKEN', 'This extension token is invalid or has been revoked'))
      return
    }

    req.userId = record.userId

    // Best-effort — a failed write here must never block the actual request.
    try {
      await tokenRepo.update(record.id, { lastUsedAt: new Date() })
    } catch {
      // ignore
    }

    next()
  } catch (err) {
    next(err)
  }
}
