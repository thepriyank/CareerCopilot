/**
 * Shared Redis client — absence-tolerant like every other optional
 * integration in this codebase (SETTINGS_ENCRYPTION_KEY, the job-source API
 * keys, etc.): with no `REDIS_URL` set, `getRedisClient()` returns `null`
 * and every caller (llmCache.ts, rateLimit.ts) degrades to a no-op rather
 * than crashing the app or blocking a request.
 *
 * `lazyConnect: true` + a short `connectTimeout` means a genuinely down
 * Redis (not just unconfigured) fails fast on the first real command rather
 * than hanging a request — callers wrap every use in try/catch and treat a
 * failure as a cache miss / rate-limit pass-through, never a request
 * failure. Caching and rate limiting are both optimizations here, not
 * correctness-critical paths.
 */

import Redis from 'ioredis'
import { config } from '../../config'
import { logger } from '../../utils/logger'

let client: Redis | null | undefined // undefined = not yet attempted, null = unavailable/unconfigured

export function getRedisClient(): Redis | null {
  if (client !== undefined) return client
  if (!config.redis.url) {
    client = null
    return client
  }

  const instance = new Redis(config.redis.url, {
    lazyConnect: true,
    connectTimeout: 2000,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null, // don't keep retrying a down Redis in the background
  })
  instance.on('error', (err) => {
    logger.warn('Redis connection error — caching/rate-limiting degrades to a no-op', { err: err.message })
  })
  client = instance
  return client
}

/** Test-only seam: forget the cached client so the next getRedisClient() re-reads config. */
export function resetRedisClientForTests(): void {
  client = undefined
}
