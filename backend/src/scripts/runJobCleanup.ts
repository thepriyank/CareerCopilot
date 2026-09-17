/**
 * Standalone entrypoint for the weekly job-listing purge — see
 * services/jobs/jobCleanup.ts for the rules (a listing older than
 * STALE_AFTER_DAYS gets marked EXPIRED by the daily discovery run; this
 * script hard-deletes anything that's been EXPIRED for
 * PURGE_AFTER_EXPIRED_DAYS or more). A no-op before jobCleanup.ts's
 * CLEANUP_STARTS_AT (2026-12-01) — the Cloud Scheduler trigger runs weekly
 * from whenever it's deployed (see the `job_cleanup_schedule` module under
 * infra/terraform/environments), so the actual start date is gated in code
 * instead.
 *
 * Same shape as runDiscovery.ts: DB connect, do the work, disconnect, exit
 * — no migrations, no Express, runs to completion in its own Cloud Run Job
 * container. Local run: `npm run cleanup:run` (ts-node) or, against a built
 * image, `node dist/scripts/runJobCleanup.js`.
 */

import { AppDataSource } from '../config/dataSource'
import { purgeExpiredJobs } from '../services/jobs/jobCleanup'
import { logger } from '../utils/logger'

async function main(): Promise<void> {
  await AppDataSource.initialize()
  logger.info('runJobCleanup: database connected')

  try {
    const deleted = await purgeExpiredJobs()
    logger.info(`runJobCleanup: done — ${deleted} listing(s) purged`)
  } finally {
    await AppDataSource.destroy()
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('runJobCleanup: fatal error', { err: (err as Error).message })
    process.exit(1)
  })
