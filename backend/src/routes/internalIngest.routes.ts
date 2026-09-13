import { Router, Response, NextFunction } from 'express'
import { z } from 'zod'
import { requireInternalAuth } from '../middleware/internalAuth'
import { ingestExternalJobs, JobInput } from '../services/jobs/discoveryService'

const router = Router()
router.use(requireInternalAuth)

const jobSchema = z.object({
  title: z.string().min(1),
  company: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  description: z.string().default(''),
  salary: z.string().nullable().optional(),
  isRemote: z.boolean().nullable().optional(),
  postedAt: z.string().datetime().nullable().optional(),
  source: z.string().min(1),
  preExtractedSkills: z.array(z.string()).nullable().optional(),
})

const ingestSchema = z.object({
  jobs: z.array(jobSchema).min(1).max(500),
})

// POST /api/internal/jobs/ingest — bulk-upserts already-scraped/normalized
// jobs into the shared pool via the same title-filter + dedup + skill-
// extraction path discoverJobsGlobally() uses for every other source (see
// discoveryService.ts's ingestExternalJobs). Written for the local JobSpy
// scraper (scripts/jobspy-ingest/), which runs as its own process — this is
// the only way for it to reach the pool, since discovery itself has no
// public HTTP trigger by design (2026-09-06 product decision).
router.post('/jobs/ingest', async (req, res: Response, next: NextFunction) => {
  try {
    const { jobs } = ingestSchema.parse(req.body)

    const inputs: JobInput[] = jobs.map((j) => ({
      title: j.title,
      company: j.company ?? null,
      location: j.location ?? null,
      url: j.url ?? null,
      description: j.description,
      salary: j.salary ?? null,
      isRemote: j.isRemote ?? null,
      postedAt: j.postedAt ? new Date(j.postedAt) : null,
      source: j.source,
      preExtractedSkills: j.preExtractedSkills ?? undefined,
    }))

    const result = await ingestExternalJobs(inputs)
    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
})

export default router
