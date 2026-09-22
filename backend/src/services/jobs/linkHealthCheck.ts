/**
 * Link-health check (2026-09-22, Jira NM-26) — verifies that a job
 * listing's own posting URL still resolves, independent of the
 * age-based staleness in jobCleanup.ts (a listing can go dead well before
 * its 60-day STALE_AFTER_DAYS window, e.g. the company pulls the posting
 * the day after it's filled).
 *
 * Design constraints (all from the original product ask):
 * - Bounded batch per run, oldest/never-checked first — spreads full-pool
 *   coverage over several days instead of one big spike, and adds zero
 *   load to user-facing traffic since this only ever runs on a schedule
 *   (see scripts/runLinkCheck.ts), never in a request path.
 * - HEAD request, falling back to GET only when a site rejects HEAD
 *   outright (405) — cheaper than downloading the full page just to check
 *   it still exists.
 * - Rate-limited per domain, not just globally — hammering one domain with
 *   every request in a batch risks getting blocked/flagged, which then
 *   looks identical to "the link is dead" if not handled carefully (same
 *   reasoning as the JobSpy scraper's LinkedIn throttling).
 * - A single ambiguous failure (403/429/timeout/5xx) does NOT mark a
 *   listing dead — that's usually a site blocking a bot, not evidence the
 *   job is gone. Only a clean 404/410 is unambiguous enough to expire
 *   immediately; anything else needs AMBIGUOUS_FAILURE_THRESHOLD
 *   consecutive failed checks (each check is a separate scheduled run, so
 *   this naturally means "on separate days") before the listing expires.
 */

import { AppDataSource } from '../../config/dataSource'
import { JobListing } from '../../entities/JobListing'
import { JobListingStatus } from '../../entities/enums'
import { logger } from '../../utils/logger'

/** How many ACTIVE listings one run checks, oldest/never-checked first. */
export const BATCH_SIZE = 300

/** How many checks run concurrently across the whole batch. */
export const CONCURRENCY = 5

/** Minimum gap between two requests to the same domain, regardless of overall concurrency. */
export const PER_DOMAIN_DELAY_MS = 1_000

export const REQUEST_TIMEOUT_MS = 5_000

/** Consecutive ambiguous failures (not a clean 404/410) before a listing is marked EXPIRED. */
export const AMBIGUOUS_FAILURE_THRESHOLD = 2

const USER_AGENT = 'Mozilla/5.0 (compatible; jobmagnate-linkcheck/0.1; +https://jobmagnate.com)'

export interface LinkHealthCheckSummary {
  checked: number
  markedExpired: number
  stillHealthy: number
  ambiguousFailures: number
}

interface CheckOutcome {
  reachable: boolean
  definitivelyDead: boolean
  status: number | null
  detail: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Falls back to the raw string if it's somehow not a valid URL — never throws. */
function resolveDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

async function fetchWithTimeout(url: string, method: 'HEAD' | 'GET'): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, {
      method,
      redirect: 'follow',
      headers: { 'user-agent': USER_AGENT },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * A clean 404/410 is unambiguous — the posting is genuinely gone. Anything
 * else that isn't a 2xx/3xx (403, 429, 500s, a timeout, a DNS failure) is
 * treated as "can't tell right now," since plenty of sites bot-block a
 * HEAD/GET from an unfamiliar client without the job itself being gone.
 */
async function checkUrl(url: string): Promise<CheckOutcome> {
  try {
    let res = await fetchWithTimeout(url, 'HEAD')
    if (res.status === 405) {
      res = await fetchWithTimeout(url, 'GET')
    }
    return {
      reachable: res.ok,
      definitivelyDead: res.status === 404 || res.status === 410,
      status: res.status,
      detail: `HTTP ${res.status}`,
    }
  } catch (err) {
    return { reachable: false, definitivelyDead: false, status: null, detail: (err as Error).message }
  }
}

/**
 * Runs `worker` over every item with at most CONCURRENCY in flight at once,
 * additionally never letting two items that map to the same domainOf(item)
 * start within PER_DOMAIN_DELAY_MS of each other. Best-effort on the
 * per-domain spacing under heavy concurrent contention for the same domain
 * (a couple of workers can both be mid-sleep on a stale timestamp at once)
 * — fine for "don't hammer one domain," not sold as a hard guarantee.
 */
async function runWithLimits<T>(
  items: T[],
  domainOf: (item: T) => string,
  worker: (item: T) => Promise<void>
): Promise<void> {
  const nextAllowedAtByDomain = new Map<string, number>()
  let cursor = 0

  async function runOne(item: T): Promise<void> {
    const domain = domainOf(item)
    const now = Date.now()
    const nextAllowed = nextAllowedAtByDomain.get(domain) ?? 0
    if (nextAllowed > now) {
      await sleep(nextAllowed - now)
    }
    nextAllowedAtByDomain.set(domain, Date.now() + PER_DOMAIN_DELAY_MS)
    await worker(item)
  }

  async function workerLoop(): Promise<void> {
    while (cursor < items.length) {
      const item = items[cursor++]
      await runOne(item)
    }
  }

  const workerCount = Math.min(CONCURRENCY, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => workerLoop()))
}

/**
 * Checks a bounded batch of ACTIVE listings' URLs and expires the ones
 * confirmed dead. Never touches a listing with no URL (a pasted job with
 * no link — see JobListing.url's comment) since there's nothing to check.
 */
export async function runLinkHealthCheck(): Promise<LinkHealthCheckSummary> {
  const repo = AppDataSource.getRepository(JobListing)

  // Sorted/filtered/limited in application code rather than SQL — fine at
  // MVP pool sizes (same tradeoff surfaceJobs.ts already makes scanning the
  // whole pool per candidate); revisit with a real query (NULLS FIRST
  // ordering, a WHERE url IS NOT NULL) if the pool ever gets large enough
  // for this to matter.
  const active = await repo.find({ where: { status: JobListingStatus.ACTIVE } })
  const eligible = active.filter((listing) => listing.url != null)
  eligible.sort((a, b) => (a.lastLinkCheckedAt?.getTime() ?? -Infinity) - (b.lastLinkCheckedAt?.getTime() ?? -Infinity))
  const listings = eligible.slice(0, BATCH_SIZE)

  const summary: LinkHealthCheckSummary = { checked: listings.length, markedExpired: 0, stillHealthy: 0, ambiguousFailures: 0 }

  await runWithLimits(
    listings,
    (listing) => resolveDomain(listing.url as string), // query guarantees url is non-null here
    async (listing) => {
      const outcome = await checkUrl(listing.url as string)
      listing.lastLinkCheckedAt = new Date()

      if (outcome.reachable) {
        listing.linkCheckFailureCount = 0
        summary.stillHealthy++
      } else if (outcome.definitivelyDead) {
        listing.status = JobListingStatus.EXPIRED
        listing.expiredAt = new Date()
        listing.linkCheckFailureCount = 0
        summary.markedExpired++
        logger.info(`runLinkHealthCheck: listing ${listing.id} confirmed dead (${outcome.detail}) — marked EXPIRED`, { url: listing.url })
      } else {
        listing.linkCheckFailureCount += 1
        summary.ambiguousFailures++
        if (listing.linkCheckFailureCount >= AMBIGUOUS_FAILURE_THRESHOLD) {
          listing.status = JobListingStatus.EXPIRED
          listing.expiredAt = new Date()
          summary.markedExpired++
          logger.info(
            `runLinkHealthCheck: listing ${listing.id} failed ${listing.linkCheckFailureCount} consecutive checks (${outcome.detail}) — marked EXPIRED`,
            { url: listing.url }
          )
        }
      }

      await repo.save(listing)
    }
  )

  logger.info(
    `runLinkHealthCheck: checked ${summary.checked} listing(s) — ${summary.markedExpired} marked EXPIRED, ` +
      `${summary.stillHealthy} healthy, ${summary.ambiguousFailures} ambiguous failure(s) this run`
  )

  return summary
}
