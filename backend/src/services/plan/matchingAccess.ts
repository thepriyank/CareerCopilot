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
 * Gates every AI-assisted per-job action — match score/recompute, skill
 * gap, tailored résumé, cover letter (jobs.routes.ts) — plus whether a
 * score/skill-gap is shown at all. 2026-09-22 product decision, revised
 * same day after initial feedback: a FREE user (trial/pass lapsed, or
 * never had one) still sees their job board — surfacing keeps running,
 * skill-match based, same as always — but sees no match score, no skill
 * gap, and can't trigger any of the four actions above. All of it unlocks
 * the moment they're on an active PREMIUM pass (trial or paid) *or* have
 * supplied their own model connection (Settings -> API keys).
 *
 * Match/skill-gap never actually call an LLM at request time (see
 * matchScore.ts's and jdSkillGap.ts's headers — both are local computation
 * over already-extracted data), so a custom key isn't spent on either;
 * its presence is purely the alternate unlock condition. Tailored résumés
 * and cover letters are the one pair that *do* route generation through
 * the key, transparently, via anthropicClient.ts's resolveConnection() —
 * this gate still applies to them the same way, just for a different
 * underlying reason (there, it's real generation cost the user is opting
 * to cover themselves).
 */
export async function canUseAiJobFeatures(user: { id: string; plan: Plan; planExpiresAt: Date | null }): Promise<boolean> {
  if (resolveEffectivePlan(user) === Plan.PREMIUM) return true
  return hasCustomModelConnection(user.id)
}
