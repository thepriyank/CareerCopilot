/**
 * Job discovery — system-wide, not per-candidate (2026-09-06 redesign).
 *
 * Discovery used to run once per candidate, using that candidate's own
 * target roles to query aggregators, and attaching whatever it found to
 * that one candidate's list via `POST /api/jobs/discover`. Per the product
 * decision on 2026-09-06: candidates never trigger discovery themselves —
 * "this is an internal feature and should be only handled by our system."
 * There is no HTTP route for it any more; only the twice-daily cron
 * (`discoveryCron.ts`) calls `discoverJobsGlobally()` below, using a
 * system-wide list of target job titles (`providers/seeds/target-job-
 * titles.json` — a stand-in for the admin-configurable list described in
 * the F4 plan doc, not yet built) instead of any one candidate's profile.
 *
 * Discovery only ever touches the shared `JobListing` pool — it never
 * creates a `UserJob`. Attaching a job to a specific candidate's list is a
 * separate concern now: `services/matching/surfaceJobs.ts` scans the pool
 * against a candidate's résumé and lazily attaches whatever scores well
 * (see that file). `ensureUserHasJob` below still exists for the one
 * candidate-initiated path that legitimately creates both a listing and a
 * per-candidate row in one step: manually pasting a JD (`POST /api/jobs`).
 */

import { AppDataSource } from '../../config/dataSource'
import { JobListing } from '../../entities/JobListing'
import { UserJob } from '../../entities/UserJob'
import { JobOrigin } from '../../entities/enums'
import { classifyTier } from './classifyTier'
import { hashJobUrl } from './jobIdentity'
import { JobView, toJobView } from './jobView'
import { extractJobSkills, flattenJobSkills } from '../skills/extractJobSkills'
import { atsProviders, remoteBoardProviders, aggregatorProviders, NormalizedJob } from './providers'
import { makeHttpContext } from './providers/http'
import indiaCompaniesSeed from './providers/seeds/india-companies.json'
import targetJobTitlesSeed from './providers/seeds/target-job-titles.json'
import { isSoftwareEngineeringRole } from './isSoftwareEngineeringRole'
import { logger } from '../../utils/logger'

const REMOTE_BOARD_SOURCE_IDS = new Set(remoteBoardProviders.map((p) => p.id))

interface SeedCompany {
  name: string
  provider: string
  careersUrl?: string
  api?: string
}

export interface DiscoveredJob {
  job: NormalizedJob
  source: string
}

export interface DiscoveryRunResult {
  jobs: DiscoveredJob[]
  errors: Array<{ source: string; message: string }>
}

export interface GlobalDiscoveryResult {
  newListings: number
  seen: number
  errors: Array<{ source: string; message: string }>
}

/**
 * Calls every configured provider once, using `titles` for the title-based
 * aggregators. Never throws — a bad provider/seed entry is reported in
 * `errors` instead of failing the whole run.
 */
export async function runProvidersForDiscovery(titles: string[]): Promise<DiscoveryRunResult> {
  const ctx = makeHttpContext()
  const jobs: DiscoveredJob[] = []
  const errors: Array<{ source: string; message: string }> = []

  // Board-wide remote providers — one call each, no per-company entry needed.
  for (const provider of remoteBoardProviders) {
    try {
      const found = await provider.fetch({ name: provider.id, provider: provider.id }, ctx)
      jobs.push(...found.map((job) => ({ job, source: provider.id })))
    } catch (err) {
      errors.push({ source: provider.id, message: (err as Error).message })
    }
  }

  // Company-ATS providers — one call per seed entry matching that provider id.
  // A bad/stale seed entry (see india-companies.json's disclaimer) fails only
  // that one company, not the whole discovery run.
  const seedCompanies = (indiaCompaniesSeed as { companies: SeedCompany[] }).companies
  for (const company of seedCompanies) {
    const provider = atsProviders.find((p) => p.id === company.provider)
    if (!provider) continue
    try {
      const found = await provider.fetch({ name: company.name, careersUrl: company.careersUrl, api: company.api }, ctx)
      jobs.push(...found.map((job) => ({ job, source: provider.id })))
    } catch (err) {
      errors.push({ source: `${provider.id}:${company.name}`, message: (err as Error).message })
    }
  }

  // Keyed aggregators (TheirStack/Adzuna/Jooble/JSearch) — each returns [] on
  // its own when unconfigured; JSearch additionally rotates its own two
  // credentials internally (see providers/jobCredentialChain.ts).
  for (const provider of aggregatorProviders) {
    try {
      const entry = { name: provider.id, query: { countryCodes: ['IN'], titles } }
      const found = await provider.fetch(entry, ctx)
      jobs.push(...found.map((job) => ({ job, source: provider.id })))
    } catch (err) {
      errors.push({ source: provider.id, message: (err as Error).message })
    }
  }

  return { jobs, errors }
}

export interface JobInput {
  title: string
  company: string | null
  location: string | null
  url: string | null
  description: string
  salary: string | null
  isRemote: boolean | null
  postedAt: Date | null
  source: string
  // Some sources (e.g. Naukri, via the local JobSpy ingest pipeline — see
  // scripts/jobspy-ingest/) already return a structured skills list. When
  // present and non-empty, upsertJobListing uses it directly instead of
  // paying for an LLM extraction call that would likely do worse than the
  // source's own structured data.
  preExtractedSkills?: string[]
}

function toJobInput(job: NormalizedJob, source: string): JobInput {
  return {
    title: job.title,
    company: job.company || null,
    location: job.location || null,
    url: job.url || null,
    description: job.description || '',
    salary: job.salary
      ? `${job.salary.min.toLocaleString()}–${job.salary.max.toLocaleString()} ${job.salary.currency}`
      : null,
    // Board-wide remote providers (RemoteOK/WeWorkRemotely/Himalayas) are
    // remote-only by definition. Some aggregators (e.g. JSearch) instead
    // supply a real per-job signal — prefer that when present, since it's
    // job-specific truth rather than a provider-wide assumption. Otherwise
    // leave it unknown rather than guess.
    isRemote: typeof job.isRemote === 'boolean' ? job.isRemote : REMOTE_BOARD_SOURCE_IDS.has(source) ? true : null,
    postedAt: typeof job.postedAt === 'number' ? new Date(job.postedAt) : null,
    source,
  }
}

/**
 * Upserts one job into the shared pool by URL hash — the one place Tier A
 * extraction actually runs, and only when the listing is genuinely new.
 * Mutable fields (salary, remote flag, posted date, etc.) refresh on every
 * re-discovery of an existing listing, since the real posting can change;
 * AI-derived `skills`/`normalizedFields` are deliberately left alone once
 * set — re-extracting on every refresh would defeat the point of doing it
 * once.
 */
export async function upsertJobListing(input: JobInput): Promise<{ listing: JobListing; isNew: boolean }> {
  const listingRepo = AppDataSource.getRepository(JobListing)

  const urlHash = hashJobUrl(input.url)
  let listing = await listingRepo.findOneBy({ urlHash })
  let isNew = false

  if (listing) {
    listing.title = input.title
    listing.company = input.company
    listing.location = input.location
    listing.salary = input.salary
    listing.isRemote = input.isRemote
    listing.postedAt = input.postedAt
    if (input.description) listing.description = input.description
    listing = await listingRepo.save(listing) // @UpdateDateColumn bumps lastSeenAt
    return { listing, isNew }
  }

  isNew = true
  listing = await listingRepo.save(
    listingRepo.create({
      source: input.source,
      url: input.url,
      urlHash,
      title: input.title,
      company: input.company,
      location: input.location,
      salary: input.salary,
      description: input.description,
      normalizedFields: {},
      skills: [],
      experienceLevel: classifyTier(input.title),
      isRemote: input.isRemote,
      postedAt: input.postedAt,
    })
  )

  if (input.preExtractedSkills && input.preExtractedSkills.length > 0) {
    const extraction = { requiredSkills: input.preExtractedSkills, niceToHaveSkills: [], seniorityLevel: null }
    listing.skills = flattenJobSkills(extraction)
    listing.normalizedFields = { ...extraction }
    listing = await listingRepo.save(listing)
  } else if (input.description) {
    try {
      const extraction = await extractJobSkills(input.description)
      listing.skills = flattenJobSkills(extraction)
      listing.normalizedFields = { ...extraction }
      listing = await listingRepo.save(listing)
    } catch (err) {
      // extractJobSkills already falls back internally on LLM failure —
      // this catch is only for something more fundamental (DB write
      // failure, etc.). The listing still exists with empty skills rather
      // than failing the whole discovery/paste call over it.
      logger.error('upsertJobListing: skill extraction failed unexpectedly', {
        jobListingId: listing.id,
        err: (err as Error).message,
      })
    }
  }

  return { listing, isNew }
}

/**
 * Ensures `userId` has a `UserJob` pointing at this job, upserting the
 * shared listing first. The one candidate-initiated path that legitimately
 * creates a per-user row directly — manually pasting a JD (`POST
 * /api/jobs`). System-wide discovery never calls this; it only calls
 * `upsertJobListing`, leaving per-candidate attachment to
 * `services/matching/surfaceJobs.ts`.
 */
export async function ensureUserHasJob(
  userId: string,
  input: JobInput,
  origin: JobOrigin
): Promise<{ jobView: JobView; isNewListing: boolean; isNewToUser: boolean }> {
  const userJobRepo = AppDataSource.getRepository(UserJob)
  const { listing, isNew: isNewListing } = await upsertJobListing(input)

  let userJob = await userJobRepo.findOneBy({ userId, jobListingId: listing.id })
  let isNewToUser = false
  if (!userJob) {
    isNewToUser = true
    userJob = await userJobRepo.save(userJobRepo.create({ userId, jobListingId: listing.id, origin, appliedAt: null }))
  }

  return { jobView: toJobView(userJob, listing), isNewListing, isNewToUser }
}

export interface ExternalIngestResult {
  newListings: number
  seen: number
  filteredOut: number
}

/**
 * Entry point for the local JobSpy ingest pipeline (see
 * scripts/jobspy-ingest/) — jobs are scraped and normalized entirely outside
 * this process (a separate Python script, run locally or on any machine that
 * has cloned this repo) and POSTed here as already-shaped `JobInput`s. Same
 * title filter + dedup + upsert path `discoverJobsGlobally` uses for every
 * other source, so a JobSpy-sourced listing is indistinguishable from any
 * other provider's once it's in the pool.
 */
export async function ingestExternalJobs(jobs: JobInput[]): Promise<ExternalIngestResult> {
  const seenThisRun = new Set<string>()
  let newListings = 0
  let seen = 0
  let filteredOut = 0

  for (const job of jobs) {
    if (!isSoftwareEngineeringRole(job.title)) {
      filteredOut++
      continue
    }
    if (!job.url || seenThisRun.has(job.url)) {
      seen++
      continue
    }
    seenThisRun.add(job.url)

    const { isNew } = await upsertJobListing(job)
    if (isNew) newListings++
    else seen++
  }

  return { newListings, seen, filteredOut }
}

/**
 * The cron's entry point: runs every provider against the system-wide
 * target-title list and upserts whatever it finds into the shared pool.
 * Never touches any candidate's list — see this file's header comment.
 */
export async function discoverJobsGlobally(): Promise<GlobalDiscoveryResult> {
  const titles = (targetJobTitlesSeed as { titles: string[] }).titles
  const { jobs: discovered, errors } = await runProvidersForDiscovery(titles)

  const seenThisRun = new Set<string>()
  let newListings = 0
  let seen = 0
  let filteredOut = 0

  for (const { job, source } of discovered) {
    // `titles` only bounds what the keyword-search aggregators ask for —
    // the remote-board/ATS providers return their entire feed unfiltered.
    // This is the actual software-engineering-domain gate, applied
    // regardless of source. See isSoftwareEngineeringRole.ts's header.
    if (!isSoftwareEngineeringRole(job.title)) {
      filteredOut++
      continue
    }

    if (!job.url || seenThisRun.has(job.url)) {
      seen++
      continue
    }
    seenThisRun.add(job.url)

    const { isNew } = await upsertJobListing(toJobInput(job, source))
    if (isNew) newListings++
    else seen++
  }

  if (filteredOut > 0) {
    logger.info(`discoverJobsGlobally: filtered out ${filteredOut} non-software-engineering listing(s)`)
  }

  return { newListings, seen, errors }
}
