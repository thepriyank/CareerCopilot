/**
 * Weekly LLM model catalog refresh (NM-29) — see
 * services/ai/catalog/catalogJobs.ts#refreshCatalog and docs/NM-29_plan.md.
 *
 * Same shape as runPassExpiryCheck.ts: DB connect, do the work, disconnect,
 * exit — runs to completion in its own Cloud Run Job container. Local run:
 * `npm run llm-catalog:refresh`, or against a built image
 * `node dist/scripts/runModelCatalogRefresh.js`.
 */

import { AppDataSource } from '../config/dataSource'
import { refreshCatalog } from '../services/ai/catalog/catalogJobs'
import { logger } from '../utils/logger'

async function main(): Promise<void> {
  await AppDataSource.initialize()
  logger.info('runModelCatalogRefresh: database connected')
  try {
    const reports = await refreshCatalog()
    logger.info('runModelCatalogRefresh: done', {
      providers: reports.map((r) => `${r.providerId}=${r.state}/${r.workingModels} working`),
    })
  } finally {
    await AppDataSource.destroy()
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('runModelCatalogRefresh: fatal error', { err: (err as Error).message })
    process.exit(1)
  })
