/**
 * Standalone entrypoint for the daily pass-expiry notification check — see
 * services/notifications/passExpiryNotifier.ts for the rule (warn a
 * PREMIUM user once, PASS_EXPIRY_WARNING_DAYS before their pass lapses).
 *
 * Same shape as runJobCleanup.ts: DB connect, do the work, disconnect,
 * exit — no migrations, no Express, runs to completion in its own Cloud
 * Run Job container. Local run: `npm run pass-expiry:run` (ts-node) or,
 * against a built image, `node dist/scripts/runPassExpiryCheck.js`.
 */

import { AppDataSource } from '../config/dataSource'
import { createPassExpiryNotifications } from '../services/notifications/passExpiryNotifier'
import { logger } from '../utils/logger'

async function main(): Promise<void> {
  await AppDataSource.initialize()
  logger.info('runPassExpiryCheck: database connected')

  try {
    const created = await createPassExpiryNotifications()
    logger.info(`runPassExpiryCheck: done — ${created} notification(s) created`)
  } finally {
    await AppDataSource.destroy()
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('runPassExpiryCheck: fatal error', { err: (err as Error).message })
    process.exit(1)
  })
