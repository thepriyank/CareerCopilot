import { MoreThanOrEqual } from 'typeorm'
import { AppDataSource } from '../../config/dataSource'
import { ExtensionFill } from '../../entities/ExtensionFill'

// "The period: 5 per month (decided 2026-09-13)" in the plan doc — not a
// lifetime allowance (a lifetime cap kills the reason to keep the
// extension installed) and not a calendar-month reset (a user who signs up
// on the 28th shouldn't get a fresh allowance three days later).
export const FREE_MONTHLY_FILL_LIMIT = 5

// "Idempotent per (user, job or form URL) for 24 hours" — a page reload or
// a validation error must not burn a second credit.
export const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * The start of the user's current rolling monthly window — the most recent
 * monthly anniversary of `createdAt` that has already passed. Walking
 * forward one month at a time from the signup anchor (rather than computing
 * elapsed months directly) keeps the day-of-month anchored to signup day
 * even across months of different lengths; a signup on the 31st can still
 * drift in a 30-day month (a `setUTCMonth` quirk), which is an acceptable
 * MVP edge case for a ±5-credit allowance.
 */
export function currentFillWindowStart(createdAt: Date, now: Date = new Date()): Date {
  let start = new Date(createdAt)
  for (;;) {
    const next = new Date(start)
    next.setUTCMonth(next.getUTCMonth() + 1)
    if (next.getTime() > now.getTime()) return start
    start = next
  }
}

/** How many fills this user has been charged for in their current rolling monthly window. */
export async function countFillsInWindow(userId: string, windowStart: Date): Promise<number> {
  const fillRepo = AppDataSource.getRepository(ExtensionFill)
  return fillRepo.count({ where: { userId, createdAt: MoreThanOrEqual(windowStart) } })
}

/** An existing charge for this exact (user, normalized URL) within the idempotency window, if any. */
export async function findRecentFill(userId: string, normalizedUrl: string): Promise<ExtensionFill | null> {
  const fillRepo = AppDataSource.getRepository(ExtensionFill)
  const cutoff = new Date(Date.now() - IDEMPOTENCY_WINDOW_MS)
  return fillRepo.findOne({
    where: { userId, normalizedUrl, createdAt: MoreThanOrEqual(cutoff) },
    order: { createdAt: 'DESC' },
  })
}
