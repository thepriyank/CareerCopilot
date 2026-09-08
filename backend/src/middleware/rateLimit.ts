/**
 * Per-user rate limit on the routes that call an LLM (tailor, cover letter,
 * master-résumé generate/regenerate, LinkedIn review) — "one enthusiastic
 * (or scripted) user can burn [the shared free-tier LLM budget] out for
 * everyone" (2026-09-07 architecture review). A fixed-window counter in
 * Redis: `INCR` a per-user-per-window key, set its expiry only on the first
 * hit of that window.
 *
 * Fails OPEN, not closed — a genuinely down Redis degrades this to "no rate
 * limiting" rather than blocking every LLM-backed request. Losing the
 * protection during a Redis hiccup is preferable to losing the feature.
 *
 * Known simplification: this counts every request to the route, including
 * one served entirely from llmCache.ts (no LLM call actually made). A
 * cache hit costs nothing quota-wise, so this is conservative rather than
 * exact — decoupling them would mean moving the count into generate()/
 * generateJson() itself, which isn't worth the extra coupling given the
 * window is generous (20/hour by default) and this only errs toward
 * protecting the shared budget harder, never under-protecting it.
 */

import { Response, NextFunction } from 'express'
import { getRedisClient } from '../services/cache/redisClient'
import { config } from '../config'
import { createError } from './errorHandler'
import { logger } from '../utils/logger'
import { AuthRequest } from '../types'

export async function llmRateLimit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const redis = getRedisClient()
  if (!redis) {
    next()
    return
  }

  const userId = req.userId!
  const windowSeconds = config.rateLimit.windowSeconds
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds)
  const key = `ratelimit:llm:${userId}:${windowStart}`

  try {
    const count = await redis.incr(key)
    if (count === 1) {
      await redis.expire(key, windowSeconds)
    }
    if (count > config.rateLimit.llmRequestsPerWindow) {
      next(
        createError(
          429,
          'RATE_LIMITED',
          `You've hit the limit of ${config.rateLimit.llmRequestsPerWindow} AI-generation requests per ${Math.round(windowSeconds / 60)} minutes. Try again shortly.`
        )
      )
      return
    }
  } catch (err) {
    logger.warn('llmRateLimit: Redis check failed, allowing the request through', { err: (err as Error).message })
  }

  next()
}
