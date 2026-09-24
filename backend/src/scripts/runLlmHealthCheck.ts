/**
 * Daily LLM provider health check (NM-29) — see
 * services/ai/catalog/catalogJobs.ts#runHealthCheck and docs/NM-29_plan.md.
 *
 * Same shape as runPassExpiryCheck.ts. Local run: `npm run llm-health:run`,
 * or against a built image `node dist/scripts/runLlmHealthCheck.js`.
 */

import { AppDataSource } from '../config/dataSource'
import { runHealthCheck } from '../services/ai/catalog/catalogJobs'
import { logger } from '../utils/logger'

async function main(): Promise<void> {
  await AppDataSource.initialize()
  logger.info('runLlmHealthCheck: database connected')
  try {
    const reports = await runHealthCheck()
    logger.info('runLlmHealthCheck: done', {
      providers: reports.map((r) => `${r.providerId}=${r.state}/${r.workingModels} working`),
    })
  } finally {
    await AppDataSource.destroy()
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('runLlmHealthCheck: fatal error', { err: (err as Error).message })
    process.exit(1)
  })
