import greenhouse from './greenhouse'
import lever from './lever'
import ashby from './ashby'
import smartrecruiters from './smartrecruiters'
import remoteok from './remoteok'
import weworkremotely from './weworkremotely'
import himalayas from './himalayas'
import theirstack from './theirstack'
import adzuna from './adzuna'
import jooble from './jooble'
import jsearch from './jsearch'
import { Provider } from './types'

/**
 * Company-ATS providers: each entry needs a `careersUrl` or `api` pointing
 * at that specific company's board (used by the India-hiring seed list, see
 * `seeds/india-companies.json`).
 */
export const atsProviders: Provider[] = [greenhouse, lever, ashby, smartrecruiters]

/**
 * Board-wide remote providers: each fetches its entire public feed in one
 * call, no per-company entry needed.
 */
export const remoteBoardProviders: Provider[] = [remoteok, weworkremotely, himalayas]

/**
 * Job-aggregator APIs (licensed / free): key-gated, each degrades to
 * returning [] when its key(s) are unconfigured. Broad India + remote
 * coverage per ARCHITECTURE.md's job source policy.
 *
 * jsearch evaluated 2026-09-06 against a real 10-job manual pull: full, rich
 * descriptions (unlike Greenhouse, which returns none), real per-job isRemote
 * signal, and — once jdSkillGap.ts's flattened-heading recovery landed —
 * meaningful skill-gap/match extraction on 8 of 10 real postings. Approved
 * for live use; still a no-op until JSEARCH_API_KEY is set, same as the
 * other aggregators here.
 *
 * adzuna and jooble deliberately excluded (2026-09-12): both hard-truncate
 * `description` to a short snippet by design — Adzuna's `/search` endpoint
 * caps it at 500 chars (confirmed against Adzuna's own docs and a live
 * pull — no paid tier or param lifts this); Jooble's API is documented as
 * snippet-only too (it literally calls the field `snippet`, not
 * `description`). Both leave skill extraction and match scoring running on
 * a fragment, not the real JD — the app's core matching feature. The only
 * way to get full text from either is following their redirect/link field
 * to whatever site they aggregated it from — unresolvable in advance, and
 * ARCHITECTURE.md's job-source policy already rules out scraping several of
 * the platforms that could be. Modules kept (adzuna.ts, jooble.ts) in case
 * a from-approved-ATS-only redirect resolution is built later; not wired
 * into discovery until then. Replaced by the local JobSpy scraper (see
 * scripts/jobspy-ingest/) for full-text India postings in the meantime.
 */
export const aggregatorProviders: Provider[] = [theirstack, jsearch]

export const allProviders: Provider[] = [...atsProviders, ...remoteBoardProviders, ...aggregatorProviders]

export { greenhouse, lever, ashby, smartrecruiters, remoteok, weworkremotely, himalayas, theirstack, adzuna, jooble, jsearch }
export * from './types'
