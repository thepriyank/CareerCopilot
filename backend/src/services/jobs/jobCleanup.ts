import { LessThanOrEqual } from 'typeorm'
import { AppDataSource } from '../../config/dataSource'
import { JobListing } from '../../entities/JobListing'
import { JobListingStatus } from '../../entities/enums'
import { logger } from '../../utils/logger'

/** A listing this many days past `firstSeenAt` flips ACTIVE -> EXPIRED. */
export const STALE_AFTER_DAYS = 60

/** An EXPIRED listing this many days past `expiredAt` gets hard-deleted. */
export const PURGE_AFTER_EXPIRED_DAYS = 15

/**
 * Product decision (2026-09-17): the weekly purge only starts actually
 * deleting from this date on — see scripts/runJobCleanup.ts, which is what
 * applies this gate. The Cloud Scheduler trigger itself runs weekly from
 * whenever it's deployed (Cloud Scheduler has no native "start date"), so
 * the gate lives here instead: every tick before this date is a deliberate
 * no-op, logged as such, so the very first real purge lands on 2026-12-01
 * without anyone needing to touch Terraform again in December.
 */
export const CLEANUP_STARTS_AT = new Date('2026-12-01T00:00:00Z')

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

/**
 * Marks every ACTIVE listing whose `firstSeenAt` is >= STALE_AFTER_DAYS old
 * as EXPIRED, stamping `expiredAt` so the purge step (below) knows when the
 * clock on PURGE_AFTER_EXPIRED_DAYS started. Deliberately keyed off
 * `firstSeenAt`, not `lastSeenAt` — a listing discovery keeps re-confirming
 * present is still exactly as old as when it was first posted/found;
 * re-seeing it doesn't make the posting itself any fresher. Called from the
 * daily discovery run (see discoveryCron.ts) so a listing is marked within
 * about a day of crossing the threshold, not just once a week.
 */
export async function expireStaleJobs(): Promise<number> {
  const repo = AppDataSource.getRepository(JobListing)
  const result = await repo.update(
    { status: JobListingStatus.ACTIVE, firstSeenAt: LessThanOrEqual(daysAgo(STALE_AFTER_DAYS)) },
    { status: JobListingStatus.EXPIRED, expiredAt: new Date() }
  )

  const marked = result.affected ?? 0
  if (marked > 0) logger.info(`expireStaleJobs: marked ${marked} listing(s) EXPIRED (>= ${STALE_AFTER_DAYS} days old)`)
  return marked
}

/**
 * Hard-deletes every EXPIRED listing whose `expiredAt` is >=
 * PURGE_AFTER_EXPIRED_DAYS old. FK constraints on UserJob (and everything
 * that hangs off it — MatchResult, GeneratedResumeVersion,
 * GeneratedCoverLetter, ApprovalRecord) cascade at the database level — see
 * the 2026-09-17 migration and each entity's comment — so this one delete
 * is enough; nothing here needs to walk the dependency graph by hand.
 * `extension_fills` rows referencing a purged job have their `jobId` set to
 * null instead of being deleted (they're a quota ledger, not job-specific
 * data — see ExtensionFill.ts).
 *
 * A no-op before CLEANUP_STARTS_AT — see that constant's comment.
 */
export async function purgeExpiredJobs(): Promise<number> {
  if (Date.now() < CLEANUP_STARTS_AT.getTime()) {
    logger.info(`purgeExpiredJobs: skipped — starts ${CLEANUP_STARTS_AT.toISOString()}`)
    return 0
  }

  const repo = AppDataSource.getRepository(JobListing)
  const result = await repo.delete({
    status: JobListingStatus.EXPIRED,
    expiredAt: LessThanOrEqual(daysAgo(PURGE_AFTER_EXPIRED_DAYS)),
  })

  const deleted = result.affected ?? 0
  if (deleted > 0) logger.info(`purgeExpiredJobs: deleted ${deleted} listing(s) (EXPIRED >= ${PURGE_AFTER_EXPIRED_DAYS} days)`)
  return deleted
}
