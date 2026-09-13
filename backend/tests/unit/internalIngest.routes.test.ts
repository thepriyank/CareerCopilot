import express from 'express'
import request from 'supertest'
import { errorHandler } from '../../src/middleware/errorHandler'
import { config } from '../../src/config'

const mockIngestExternalJobs = jest.fn(async (_jobs: Array<Record<string, unknown>>) => ({
  newListings: 1,
  seen: 0,
  filteredOut: 0,
}))
jest.mock('../../src/services/jobs/discoveryService', () => ({
  ingestExternalJobs: (jobs: Array<Record<string, unknown>>) => mockIngestExternalJobs(jobs),
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
import internalIngestRoutes from '../../src/routes/internalIngest.routes'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/internal', internalIngestRoutes)
  app.use(errorHandler)
  return app
}

const validJob = {
  title: 'Backend Engineer',
  url: 'https://example.com/jobs/1',
  description: 'A real job description',
  source: 'jobspy:naukri',
}

describe('POST /api/internal/jobs/ingest', () => {
  const originalToken = config.internalIngest.token

  beforeEach(() => {
    mockIngestExternalJobs.mockClear()
    ;(config.internalIngest as { token: string }).token = 'test-token'
  })

  afterAll(() => {
    ;(config.internalIngest as { token: string }).token = originalToken
  })

  it('rejects a request with no Authorization header', async () => {
    const res = await request(buildApp()).post('/api/internal/jobs/ingest').send({ jobs: [validJob] })
    expect(res.status).toBe(401)
    expect(mockIngestExternalJobs).not.toHaveBeenCalled()
  })

  it('rejects a request with the wrong token', async () => {
    const res = await request(buildApp())
      .post('/api/internal/jobs/ingest')
      .set('Authorization', 'Bearer wrong-token')
      .send({ jobs: [validJob] })
    expect(res.status).toBe(401)
    expect(mockIngestExternalJobs).not.toHaveBeenCalled()
  })

  it('fails closed (503) when INTERNAL_INGEST_TOKEN is unset, even with a bearer header present', async () => {
    ;(config.internalIngest as { token: string }).token = ''
    const res = await request(buildApp())
      .post('/api/internal/jobs/ingest')
      .set('Authorization', 'Bearer anything')
      .send({ jobs: [validJob] })
    expect(res.status).toBe(503)
    expect(mockIngestExternalJobs).not.toHaveBeenCalled()
  })

  it('accepts a valid request with the correct token and forwards jobs to ingestExternalJobs', async () => {
    const res = await request(buildApp())
      .post('/api/internal/jobs/ingest')
      .set('Authorization', 'Bearer test-token')
      .send({ jobs: [validJob] })

    expect(res.status).toBe(201)
    expect(res.body).toEqual({ newListings: 1, seen: 0, filteredOut: 0 })
    expect(mockIngestExternalJobs).toHaveBeenCalledTimes(1)
    const forwarded = mockIngestExternalJobs.mock.calls[0]![0]
    expect(forwarded[0]).toMatchObject({ title: 'Backend Engineer', url: 'https://example.com/jobs/1', source: 'jobspy:naukri' })
  })

  it('treats an explicit null preExtractedSkills the same as absent (JobSpy sends null when a job has none)', async () => {
    const res = await request(buildApp())
      .post('/api/internal/jobs/ingest')
      .set('Authorization', 'Bearer test-token')
      .send({ jobs: [{ ...validJob, preExtractedSkills: null }] })

    expect(res.status).toBe(201)
    const forwarded = mockIngestExternalJobs.mock.calls[0]![0]
    expect(forwarded[0]!.preExtractedSkills).toBeUndefined()
  })

  it('rejects a job missing a required field (title)', async () => {
    const res = await request(buildApp())
      .post('/api/internal/jobs/ingest')
      .set('Authorization', 'Bearer test-token')
      .send({ jobs: [{ ...validJob, title: '' }] })
    expect(res.status).toBe(400)
    expect(mockIngestExternalJobs).not.toHaveBeenCalled()
  })

  it('rejects an empty jobs array', async () => {
    const res = await request(buildApp())
      .post('/api/internal/jobs/ingest')
      .set('Authorization', 'Bearer test-token')
      .send({ jobs: [] })
    expect(res.status).toBe(400)
    expect(mockIngestExternalJobs).not.toHaveBeenCalled()
  })
})
