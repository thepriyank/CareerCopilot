/**
 * Twice-daily background job-discovery refresh, at 7:00am and 5:00pm IST
 * (1:30 / 11:30 UTC) by default.
 *
 * 2026-09-06 product decision: discovery is a system-internal feature, not
 * something a candidate ever triggers — "The UX should never depend on a
 * person seeing an empty stack and has [needing] to click discover to find
 * jobs... Do not give the user option to call these API." So this cron is
 * now the ONLY caller of discovery — there is no HTTP route for it, and it
 * runs once per tick against a system-wide target-title list
 * (`providers/seeds/target-job-titles.json`, a stand-in for the
 * admin-configurable list described in the F4 plan doc), not once per
 * candidate. See `discoveryService.ts`'s `discoverJobsGlobally()`.
 *
 * A candidate's own job board is populated separately and automatically —
 * see `services/matching/surfaceJobs.ts`, called from `GET /api/jobs`.
 */

import cron, { ScheduledTask } from 'node-cron'
import { config } from '../../config'
import { logger } from '../../utils/logger'
import { discoverJobsGlobally } from './discoveryService'

let task: ScheduledTask | null = null
let running = false // re-entrancy guard — a slow run should never overlap the next tick

export async function runScheduledDiscovery(): Promise<{ newListings: number; seen: number }> {
  if (running) {
    logger.warn('discoveryCron: previous run still in progress; skipping this tick')
    return { newListings: 0, seen: 0 }
  }
  running = true
  const startedAt = Date.now()

  try {
    const { newListings, seen, errors } = await discoverJobsGlobally()
    if (errors.length > 0) {
      // Provider-level errors (bad seed entry, exhausted quota, etc.) are
      // expected in normal operation — logged, not fatal to the run.
      logger.warn(`discoveryCron: ${errors.length} provider error(s)`, { errors })
    }
    logger.info(
      `discoveryCron: ${newListings} new listing(s), ${seen} already known, in ${Date.now() - startedAt}ms`
    )
    return { newListings, seen }
  } catch (err) {
    logger.error('discoveryCron: run failed', { err: (err as Error).message })
    return { newListings: 0, seen: 0 }
  } finally {
    running = false
  }
}

/**
 * Registers the twice-daily schedule. No-op (and logs why) when
 * JOB_DISCOVERY_CRON_ENABLED isn't truthy — off by default so local dev and
 * test runs never spend free-tier API quota just by starting the server.
 * Safe to call more than once; a second call replaces the first schedule.
 */
export function startDiscoveryCron(): void {
  if (!config.jobDiscovery.cronEnabled) {
    logger.info('discoveryCron: disabled (set JOB_DISCOVERY_CRON_ENABLED=true to turn on the twice-daily refresh)')
    return
  }
  if (task) task.stop()

  task = cron.schedule(config.jobDiscovery.cronSchedule, () => {
    runScheduledDiscovery().catch((err) => {
      logger.error('discoveryCron: unhandled error', { err: (err as Error).message })
    })
  }, { timezone: 'Etc/UTC' })

  logger.info(`discoveryCron: scheduled "${config.jobDiscovery.cronSchedule}" (UTC)`)
}

/** Test/shutdown seam. */
export function stopDiscoveryCron(): void {
  if (task) {
    task.stop()
    task = null
  }
}
