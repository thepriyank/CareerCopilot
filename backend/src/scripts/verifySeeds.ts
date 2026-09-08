/**
 * Manual verification for `services/jobs/providers/seeds/india-companies.json`.
 *
 * That file is an explicitly UNVERIFIED starter list (see its `_disclaimer`
 * field) — this script hits each entry's resolved API URL for real and
 * reports which ones actually resolve, so a stale/wrong board token gets
 * caught here rather than silently returning nothing (or nothing useful)
 * from discovery.
 *
 * Not part of `npm test` — it makes live network calls. Run manually:
 *   npx ts-node src/scripts/verifySeeds.ts
 */

import { atsProviders } from '../services/jobs/providers'
import { makeHttpContext } from '../services/jobs/providers/http'
import seeds from '../services/jobs/providers/seeds/india-companies.json'

interface SeedCompany {
  name: string
  provider: string
  careersUrl?: string
  api?: string
}

async function main() {
  const ctx = makeHttpContext()
  const companies = (seeds as { companies: SeedCompany[] }).companies

  let ok = 0
  let failed = 0

  for (const company of companies) {
    const provider = atsProviders.find((p) => p.id === company.provider)
    if (!provider) {
      console.error(`[FAIL] ${company.name}: no provider registered for "${company.provider}"`)
      failed++
      continue
    }

    const detected = provider.detect({ name: company.name, careersUrl: company.careersUrl, api: company.api })
    if (!detected) {
      console.error(`[FAIL] ${company.name}: ${company.provider}.detect() could not resolve an API URL from the seed entry`)
      failed++
      continue
    }

    try {
      const jobs = await provider.fetch(
        { name: company.name, careersUrl: company.careersUrl, api: company.api },
        ctx
      )
      console.log(`[OK]   ${company.name} (${company.provider}) → ${jobs.length} postings at ${detected.url}`)
      ok++
    } catch (err) {
      console.error(`[FAIL] ${company.name} (${company.provider}) → ${(err as Error).message}`)
      failed++
    }
  }

  console.log(`\n${ok} resolved, ${failed} failed, out of ${companies.length} seed entries.`)
  if (failed > 0) {
    console.log('Remove or fix failing entries in seeds/india-companies.json before relying on this list.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
