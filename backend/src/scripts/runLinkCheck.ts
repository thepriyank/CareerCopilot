/**
 * Standalone entrypoint for the daily link-health check (Jira NM-26) — see
 * services/jobs/linkHealthCheck.ts for the rules (a bounded batch of
 * ACTIVE listings gets its URL checked, oldest/never-checked first; a
 * confirmed-dead one is marked EXPIRED, same as the age-based staleness
 * path).
 *
 * Same shape as runDiscovery.ts/runJobCleanup.ts: DB connect, do the work,
 * disconnect, exit — no migrations, no Express, runs to completion in its
 * own Cloud Run Job container. Local run: `npm run linkcheck:run`
 * (ts-node) or, against a built image, `node dist/scripts/runLinkCheck.js`.
 */

import { AppDataSource } from '../config/dataSource'
import { runLinkHealthCheck } from '../services/jobs/linkHealthCheck'
import { logger } from '../utils/logger'

async function main(): Promise<void> {
  await AppDataSource.initialize()
  logger.info('runLinkCheck: database connected')

  try {
    const summary = await runLinkHealthCheck()
    logger.info(
      `runLinkCheck: done — checked ${summary.checked}, ${summary.markedExpired} marked EXPIRED, ` +
        `${summary.stillHealthy} healthy, ${summary.ambiguousFailures} ambiguous failure(s)`
    )
  } finally {
    await AppDataSource.destroy()
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('runLinkCheck: fatal error', { err: (err as Error).message })
    process.exit(1)
  })
