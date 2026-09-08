/**
 * Manual, one-off trigger for `discoverJobsGlobally()` — the same logic the
 * twice-daily cron runs (`services/jobs/discoveryCron.ts`), useful for
 * seeding a fresh local DB (or an empty pool right after this migration)
 * without waiting for the next scheduled tick.
 *
 * Not part of `npm test` — it makes live network + LLM calls. Run manually:
 *   npx ts-node --transpile-only src/scripts/seedJobPool.ts
 */

import { AppDataSource } from '../config/dataSource'
import { discoverJobsGlobally } from '../services/jobs/discoveryService'

async function main() {
  await AppDataSource.initialize()
  try {
    console.log('Running discovery against the shared job pool...')
    const result = await discoverJobsGlobally()
    console.log(JSON.stringify(result, null, 2))
  } finally {
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
