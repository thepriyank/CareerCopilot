import { AppDataSource } from '../../config/dataSource'
import { User } from '../../entities/User'
import { Plan } from '../../entities/enums'
import { decrypt } from '../../utils/encryption'
import { parseModelConnection } from '../ai/modelConnection'
import { resolveEffectivePlan } from './resolveEffectivePlan'
import { logger } from '../../utils/logger'

/**
 * True if this user has a working Settings -> API keys connection saved —
 * the same stored value anthropicClient.ts's resolveConnection() already
 * reads automatically on every generate()/generateJson() call for this
 * user. A connection that fails to decrypt or parse counts as absent
 * (mirrors resolveConnection()'s own fallback behavior), not as an error —
 * this function is a gate check, never the thing that actually calls the
 * connection.
 */
export async function hasCustomModelConnection(userId: string): Promise<boolean> {
  const userRepo = AppDataSource.getRepository(User)
  const user = await userRepo.findOneBy({ id: userId })
  const stored = user?.settings?.['modelConnection']
  if (typeof stored !== 'string' || !stored) return false

  try {
    parseModelConnection(decrypt(stored))
    return true
  } catch (err) {
    logger.warn('hasCustomModelConnection: stored connection could not be read', {
      userId,
      err: (err as Error).message,
    })
    return false
  }
}

/**
 * Gates job matching (services/matching/surfaceJobs.ts and the on-demand
 * POST /:id/match route) — 2026-09-22 product decision: matching is free
 * during an active PREMIUM pass (trial or paid), same as before, but stops
 * once a FREE user's pass has lapsed *unless* they've supplied their own
 * model connection (Settings -> API keys). Matching itself never actually
 * calls an LLM (see matchScore.ts's header — it's local computation over
 * already-extracted data), so a custom key isn't spent on it; its presence
 * is used here purely as the paid-tier's alternate unlock condition, per
 * that decision. Tailored résumés/cover letters are a separate gate (see
 * jobs.routes.ts's assertUnderFreeQuota) — that one *does* actually route
 * generation through the user's key, transparently, via
 * anthropicClient.ts's resolveConnection().
 */
export async function canUserMatch(user: { id: string; plan: Plan; planExpiresAt: Date | null }): Promise<boolean> {
  if (resolveEffectivePlan(user) === Plan.PREMIUM) return true
  return hasCustomModelConnection(user.id)
}
