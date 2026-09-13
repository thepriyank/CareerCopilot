/**
 * Standalone entrypoint for the daily job-discovery run — the Phase E fix
 * flagged throughout docs/cicd_terraform_plan.md: `discoveryCron.ts`'s
 * in-process `node-cron` schedule doesn't survive Cloud Run's scale-to-zero
 * (a tick fired while the instance is idle/stopped never runs, silently),
 * and can't be trusted to fire exactly once if the service ever runs more
 * than one instance. This script is the entrypoint for a Cloud Run Job
 * instead — Cloud Scheduler invokes it once daily (see
 * infra/terraform/modules/cloud-scheduler-job), it runs to completion in
 * its own container, and exits. No always-on process required, no
 * duplicate-tick risk, no missed tick from being asleep.
 *
 * Deliberately does NOT run migrations (that stays the web service's job
 * on boot, see index.ts) and does NOT start Express — just DB connect,
 * discover, disconnect, exit.
 *
 * Local run: `npm run discover:run` (ts-node) or, against a built image,
 * `node dist/scripts/runDiscovery.js` — the same command Terraform's
 * cloud-run-job module overrides the container's entrypoint with.
 */

import { AppDataSource } from '../config/dataSource'
import { runScheduledDiscovery } from '../services/jobs/discoveryCron'
import { logger } from '../utils/logger'

async function main(): Promise<void> {
  await AppDataSource.initialize()
  logger.info('runDiscovery: database connected')

  try {
    const { newListings, seen } = await runScheduledDiscovery()
    logger.info(`runDiscovery: done — ${newListings} new listing(s), ${seen} already known`)
  } finally {
    await AppDataSource.destroy()
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('runDiscovery: fatal error', { err: (err as Error).message })
    process.exit(1)
  })
