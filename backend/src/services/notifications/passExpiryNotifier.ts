import { Between } from 'typeorm'
import { AppDataSource } from '../../config/dataSource'
import { User } from '../../entities/User'
import { Notification } from '../../entities/Notification'
import { Plan, NotificationType } from '../../entities/enums'
import { logger } from '../../utils/logger'

/** How far ahead of expiry to warn — see resolveEffectivePlan.ts's TRIAL_DURATION_MS comment for the trial length this counts down from. */
export const PASS_EXPIRY_WARNING_DAYS = 3

function formatExpiryDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/**
 * Creates a PASS_EXPIRING notification for every PREMIUM user whose
 * `planExpiresAt` falls within the next `PASS_EXPIRY_WARNING_DAYS` days —
 * called daily (see scripts/runPassExpiryCheck.ts). Idempotent per exact
 * expiry instant: `meta.expiresAt` is checked before creating, so a user
 * whose pass hasn't changed only ever gets warned once for it, no matter
 * how many days in a row this runs before the pass actually lapses.
 */
export async function createPassExpiryNotifications(): Promise<number> {
  const userRepo = AppDataSource.getRepository(User)
  const notificationRepo = AppDataSource.getRepository(Notification)

  const now = new Date()
  const windowEnd = new Date(now.getTime() + PASS_EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000)

  const expiringUsers = await userRepo.find({
    where: { plan: Plan.PREMIUM, planExpiresAt: Between(now, windowEnd) },
  })

  let created = 0
  for (const user of expiringUsers) {
    if (!user.planExpiresAt) continue
    const expiresAtIso = user.planExpiresAt.toISOString()

    // Idempotency check done in application code, not a jsonb query filter
    // (not reliably indexable across the Postgres versions TypeORM targets
    // here) — cheap either way, since this is one row per user, not per job.
    const mostRecent = await notificationRepo.findOne({
      where: { userId: user.id, type: NotificationType.PASS_EXPIRING },
      order: { createdAt: 'DESC' },
    })
    if (mostRecent?.meta?.['expiresAt'] === expiresAtIso) continue

    await notificationRepo.save(
      notificationRepo.create({
        userId: user.id,
        type: NotificationType.PASS_EXPIRING,
        title: `Your free pass ends on ${formatExpiryDate(user.planExpiresAt)}`,
        body:
          `After that date, job matching will pause — you won't see new matched jobs until you ` +
          `add your own API key (Settings -> API keys) or upgrade to a paid pass. Tailored résumés ` +
          `and cover letters also pause, with the same two ways to keep them working.`,
        meta: { expiresAt: expiresAtIso },
        readAt: null,
      })
    )
    created++
  }

  if (created > 0) logger.info(`createPassExpiryNotifications: created ${created} notification(s)`)
  return created
}
