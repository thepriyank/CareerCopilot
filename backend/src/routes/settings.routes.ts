import { Router, Response, NextFunction } from 'express'
import { z } from 'zod'
import { AppDataSource } from '../config/dataSource'
import { User } from '../entities/User'
import { requireAuth } from '../middleware/auth'
import { createError } from '../middleware/errorHandler'
import { encrypt, decrypt, isEncryptionConfigured } from '../utils/encryption'
import { parseModelConnection, ModelConnection } from '../services/ai/modelConnection'
import { logger } from '../utils/logger'
import { AuthRequest } from '../types'

const router = Router()
router.use(requireAuth)

const SETTINGS_KEY = 'modelConnection'

function buildPreview(connection: ModelConnection): string {
  if (connection.kind === 'local') {
    return `${connection.baseUrl}#model=${connection.model}`
  }
  const key = connection.apiKey
  return key.length > 10 ? `${key.slice(0, 6)}…${key.slice(-4)}` : '•'.repeat(Math.max(key.length, 4))
}

/** Best-effort, short-timeout connectivity check — never blocks saving on it. */
async function pingLocalEndpoint(baseUrl: string): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3000)
  try {
    const res = await fetch(`${baseUrl}/models`, { signal: controller.signal })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

// GET /api/settings/model-connection
router.get('/model-connection', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userRepo = AppDataSource.getRepository(User)
    const user = await userRepo.findOneBy({ id: req.userId! })
    const stored = user?.settings?.[SETTINGS_KEY]

    if (typeof stored !== 'string' || !stored) {
      res.json({ configured: false, kind: null, preview: null })
      return
    }

    try {
      const connection = parseModelConnection(decrypt(stored))
      res.json({ configured: true, kind: connection.kind, preview: buildPreview(connection) })
    } catch (err) {
      logger.warn('Stored model connection could not be read back', { userId: req.userId, err: (err as Error).message })
      res.json({ configured: false, kind: null, preview: null })
    }
  } catch (err) {
    next(err)
  }
})

const putSchema = z.object({ raw: z.string().min(1) })

// PUT /api/settings/model-connection — the one field: a cloud API key or a
// local/self-hosted OpenAI-compatible URL with a #model= fragment.
router.put('/model-connection', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!isEncryptionConfigured()) {
      throw createError(
        503,
        'ENCRYPTION_NOT_CONFIGURED',
        'The server is not set up to store this yet (SETTINGS_ENCRYPTION_KEY is missing)'
      )
    }

    const { raw } = putSchema.parse(req.body)

    let connection: ModelConnection
    try {
      connection = parseModelConnection(raw)
    } catch (err) {
      throw createError(400, 'INVALID_CONNECTION', (err as Error).message)
    }

    let warning: string | undefined
    if (connection.kind === 'local') {
      const reachable = await pingLocalEndpoint(connection.baseUrl)
      if (!reachable) {
        warning = `Saved, but couldn't reach ${connection.baseUrl} just now — make sure it's running.`
      }
    }

    const userRepo = AppDataSource.getRepository(User)
    const user = await userRepo.findOneBy({ id: req.userId! })
    if (!user) throw createError(404, 'NOT_FOUND', 'User not found')

    user.settings = { ...user.settings, [SETTINGS_KEY]: encrypt(raw) }
    await userRepo.save(user)

    res.json({ configured: true, kind: connection.kind, preview: buildPreview(connection), warning })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/settings/model-connection — revert to the platform default.
router.delete('/model-connection', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userRepo = AppDataSource.getRepository(User)
    const user = await userRepo.findOneBy({ id: req.userId! })
    if (!user) throw createError(404, 'NOT_FOUND', 'User not found')

    const settings = { ...user.settings }
    delete settings[SETTINGS_KEY]
    user.settings = settings
    await userRepo.save(user)

    res.json({ configured: false, kind: null, preview: null })
  } catch (err) {
    next(err)
  }
})

export default router
