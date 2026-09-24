/**
 * Runtime view of the LLM model catalog for the web service (NM-29).
 *
 * `catalogModelsFor(providerId)` is called on the hot path of every AI call
 * (providerChain.usableModels), so it never touches the DB itself: it returns
 * whatever the in-memory cache holds and, when that's older than
 * `config.llm.catalogCacheTtlMs`, kicks off a background reload. An empty
 * cache (first request after boot, DB down, staging where no job fills the
 * table) returns undefined and the caller falls back to the registry's
 * hardcoded models — the catalog can only ever add information, never
 * block a call.
 */

import { AppDataSource } from '../../../config/dataSource'
import { config } from '../../../config'
import { LlmModelCatalogEntry } from '../../../entities/LlmModelCatalogEntry'
import { LlmModelStatus } from '../../../entities/enums'
import { logger } from '../../../utils/logger'

/** Statuses the live chain should try: tested-good first, then "429 at probe time". */
export const USABLE_STATUSES = [LlmModelStatus.ACTIVE, LlmModelStatus.RATE_LIMITED]

let cache: Map<string, string[]> = new Map()
let loadedAt = 0
let loading: Promise<void> | null = null

export function catalogModelsFor(providerId: string): string[] | undefined {
  if (Date.now() - loadedAt > config.llm.catalogCacheTtlMs) void reloadCatalogCache()
  return cache.get(providerId)
}

/** Reloads the cache from the DB. Safe to call concurrently; never throws. */
export function reloadCatalogCache(): Promise<void> {
  if (loading) return loading
  if (!AppDataSource.isInitialized) return Promise.resolve()
  loading = (async () => {
    try {
      const rows = await AppDataSource.getRepository(LlmModelCatalogEntry)
        .createQueryBuilder('m')
        .select(['m.providerId', 'm.modelId'])
        .where('m.status IN (:...statuses)', { statuses: USABLE_STATUSES })
        .orderBy('m.providerId')
        .addOrderBy('m.rank', 'ASC')
        .getMany()
      cache = groupByProvider(rows)
      loadedAt = Date.now()
    } catch (err) {
      // Table missing (migration not yet run) or DB blip: keep the old cache,
      // retry after the next TTL rather than on every call.
      loadedAt = Date.now()
      logger.warn('Model catalog reload failed; using the previous/hardcoded model lists', {
        err: (err as Error).message,
      })
    } finally {
      loading = null
    }
  })()
  return loading
}

export function groupByProvider(rows: Pick<LlmModelCatalogEntry, 'providerId' | 'modelId'>[]): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const r of rows) {
    const list = out.get(r.providerId) ?? []
    list.push(r.modelId)
    out.set(r.providerId, list)
  }
  return out
}

/** Test seam. */
export function setCatalogCacheForTests(next: Map<string, string[]>, at = Date.now()): void {
  cache = next
  loadedAt = at
}
