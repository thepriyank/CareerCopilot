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
 * adzuna deliberately excluded (2026-09-12): its `/search` endpoint hard-
 * truncates `description` to 500 chars by design (confirmed against
 * Adzuna's own docs and a live pull — no paid tier or param lifts this), so
 * skill extraction and match scoring were running on a snippet, not the real
 * JD. The only way to get the full text is following `redirect_url` to
 * whatever site Adzuna aggregated it from — unresolvable in advance, and
 * ARCHITECTURE.md's job-source policy already rules out scraping several of
 * the platforms that could be. Module kept (adzuna.ts) in case a
 * from-approved-ATS-only redirect resolution is built later; not wired into
 * discovery until then.
 */
export const aggregatorProviders: Provider[] = [theirstack, jooble, jsearch]

export const allProviders: Provider[] = [...atsProviders, ...remoteBoardProviders, ...aggregatorProviders]

export { greenhouse, lever, ashby, smartrecruiters, remoteok, weworkremotely, himalayas, theirstack, adzuna, jooble, jsearch }
export * from './types'
