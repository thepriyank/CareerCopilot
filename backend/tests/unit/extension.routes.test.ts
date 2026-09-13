import express from 'express'
import request from 'supertest'
import { signToken } from '../../src/middleware/auth'
import { errorHandler } from '../../src/middleware/errorHandler'
import { createFakeRepo } from './testUtils/fakeRepo'
import { Plan } from '../../src/entities/enums'

const userRepo = createFakeRepo()
const tokenRepo = createFakeRepo()
const fillRepo = createFakeRepo()
const userJobRepo = createFakeRepo()

jest.mock('../../src/config/dataSource', () => {
  const { User } = require('../../src/entities/User')
  const { ExtensionToken } = require('../../src/entities/ExtensionToken')
  const { ExtensionFill } = require('../../src/entities/ExtensionFill')
  const { UserJob } = require('../../src/entities/UserJob')
  return {
    AppDataSource: {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === User) return userRepo
        if (entity === ExtensionToken) return tokenRepo
        if (entity === ExtensionFill) return fillRepo
        if (entity === UserJob) return userJobRepo
        throw new Error(`No fake repo registered for entity: ${entity}`)
      }),
    },
  }
})

// Job resolution and artifact/profile resolution are exercised in their own
// unit tests (resolveJob.test.ts, resolveArtifacts.test.ts) — mocked here at
// the module boundary so these route tests focus on auth, quota and
// idempotency, which live in this file.
const mockResolveJobForUrl = jest.fn()
jest.mock('../../src/services/extension/resolveJob', () => ({
  resolveJobForUrl: (...args: unknown[]) => mockResolveJobForUrl(...args),
}))

const mockResolveArtifactsForJob = jest.fn()
jest.mock('../../src/services/extension/resolveArtifacts', () => ({
  resolveArtifactsForJob: (...args: unknown[]) => mockResolveArtifactsForJob(...args),
}))

const mockBuildExtensionProfileFields = jest.fn()
jest.mock('../../src/services/extension/profileFields', () => ({
  buildExtensionProfileFields: (...args: unknown[]) => mockBuildExtensionProfileFields(...args),
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
import extensionRoutes from '../../src/routes/extension.routes'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/extension', extensionRoutes)
  app.use(errorHandler)
  return app
}

const USER_ID = 'user-1'
const sessionToken = signToken(USER_ID, 'PREMIUM')

async function mintToken(app: ReturnType<typeof buildApp>, label?: string): Promise<string> {
  const res = await request(app)
    .post('/api/extension/tokens')
    .set('Authorization', `Bearer ${sessionToken}`)
    .send(label ? { label } : {})
  return res.body.token as string
}

beforeEach(() => {
  userRepo.rows.length = 0
  tokenRepo.rows.length = 0
  fillRepo.rows.length = 0
  userJobRepo.rows.length = 0
  mockResolveJobForUrl.mockReset().mockResolvedValue({ job: null, candidates: [] })
  mockResolveArtifactsForJob.mockReset().mockResolvedValue({ resume: null, unapprovedTailoredResumeExists: false, coverLetter: null })
  mockBuildExtensionProfileFields.mockReset().mockResolvedValue({
    name: 'Test', email: 't@example.com', phone: null, location: null, linkedin: null, website: null, visaStatus: null, noticePeriod: null,
  })
})

describe('POST /api/extension/tokens', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(buildApp()).post('/api/extension/tokens').send({})
    expect(res.status).toBe(401)
  })

  it('mints a token and stores only its hash', async () => {
    const app = buildApp()
    const res = await request(app).post('/api/extension/tokens').set('Authorization', `Bearer ${sessionToken}`).send({ label: 'Chrome' })

    expect(res.status).toBe(201)
    expect(res.body.token).toMatch(/^ext_[0-9a-f]{64}$/)
    expect(res.body.label).toBe('Chrome')
    expect(tokenRepo.rows).toHaveLength(1)
    expect((tokenRepo.rows[0] as any).tokenHash).not.toBe(res.body.token)
  })

  it('defaults the label when none is given', async () => {
    const app = buildApp()
    const res = await request(app).post('/api/extension/tokens').set('Authorization', `Bearer ${sessionToken}`).send({})
    expect(res.body.label).toBe('Browser extension')
  })
})

describe('GET /api/extension/tokens', () => {
  it('lists tokens without ever exposing tokenHash', async () => {
    const app = buildApp()
    await mintToken(app, 'Chrome')

    const res = await request(app).get('/api/extension/tokens').set('Authorization', `Bearer ${sessionToken}`)
    expect(res.status).toBe(200)
    expect(res.body.tokens).toHaveLength(1)
    expect(res.body.tokens[0].label).toBe('Chrome')
    expect(res.body.tokens[0]).not.toHaveProperty('tokenHash')
  })
})

describe('DELETE /api/extension/tokens/:id', () => {
  it('revokes a token, after which it can no longer authenticate', async () => {
    const app = buildApp()
    const token = await mintToken(app)
    const id = tokenRepo.rows[0].id as string

    const del = await request(app).delete(`/api/extension/tokens/${id}`).set('Authorization', `Bearer ${sessionToken}`)
    expect(del.status).toBe(200)

    const profile = await request(app).get('/api/extension/profile').set('Authorization', `Bearer ${token}`)
    expect(profile.status).toBe(401)
  })

  it('404s for a token that does not belong to the caller', async () => {
    const app = buildApp()
    tokenRepo.rows.push({ id: 'someone-elses', userId: 'other-user', tokenHash: 'x', label: 'x', createdAt: new Date(), lastUsedAt: null, revokedAt: null } as never)

    const res = await request(app).delete('/api/extension/tokens/someone-elses').set('Authorization', `Bearer ${sessionToken}`)
    expect(res.status).toBe(404)
  })
})

describe('extension-token-authed routes', () => {
  it('reject a missing Authorization header', async () => {
    const res = await request(buildApp()).get('/api/extension/profile')
    expect(res.status).toBe(401)
  })

  it('reject a well-formed but unknown token', async () => {
    const res = await request(buildApp()).get('/api/extension/profile').set('Authorization', 'Bearer ext_deadbeef')
    expect(res.status).toBe(401)
  })

  it('reject the web app\'s own JWT — extension routes need an ext_ token, not a session token', async () => {
    const res = await request(buildApp()).get('/api/extension/profile').set('Authorization', `Bearer ${sessionToken}`)
    expect(res.status).toBe(401)
  })
})

describe('GET /api/extension/profile', () => {
  it('returns profile fields, effective plan and unlimited credits for PREMIUM', async () => {
    const app = buildApp()
    const token = await mintToken(app)
    userRepo.rows.push({ id: USER_ID, plan: Plan.PREMIUM, planExpiresAt: null, createdAt: new Date() } as never)

    const res = await request(app).get('/api/extension/profile').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.plan).toBe('PREMIUM')
    expect(res.body.remainingFills).toBeNull()
    expect(res.body.profile.email).toBe('t@example.com')
  })

  it('reports remaining credits for a FREE user', async () => {
    const app = buildApp()
    const token = await mintToken(app)
    userRepo.rows.push({ id: USER_ID, plan: Plan.FREE, planExpiresAt: null, createdAt: new Date('2026-01-01') } as never)

    const res = await request(app).get('/api/extension/profile').set('Authorization', `Bearer ${token}`)
    expect(res.body.remainingFills).toBe(5)
  })
})

describe('POST /api/extension/fills', () => {
  it('charges a credit and returns the resolved payload', async () => {
    const app = buildApp()
    const token = await mintToken(app)
    userRepo.rows.push({ id: USER_ID, plan: Plan.FREE, planExpiresAt: null, createdAt: new Date('2026-01-01') } as never)

    const res = await request(app).post('/api/extension/fills').set('Authorization', `Bearer ${token}`).send({ url: 'https://example.com/job' })
    expect(res.status).toBe(200)
    expect(fillRepo.rows).toHaveLength(1)
    expect(res.body.remainingFills).toBe(4)
  })

  it('does not charge a second credit for a repeat within the idempotency window', async () => {
    const app = buildApp()
    const token = await mintToken(app)
    userRepo.rows.push({ id: USER_ID, plan: Plan.FREE, planExpiresAt: null, createdAt: new Date('2026-01-01') } as never)

    await request(app).post('/api/extension/fills').set('Authorization', `Bearer ${token}`).send({ url: 'https://example.com/job' })
    const second = await request(app).post('/api/extension/fills').set('Authorization', `Bearer ${token}`).send({ url: 'https://example.com/job' })

    expect(second.status).toBe(200)
    expect(fillRepo.rows).toHaveLength(1)
    expect(second.body.remainingFills).toBe(4)
  })

  it('402s a FREE user once out of credits, and does not charge a 6th', async () => {
    const app = buildApp()
    const token = await mintToken(app)
    userRepo.rows.push({ id: USER_ID, plan: Plan.FREE, planExpiresAt: null, createdAt: new Date('2026-01-01') } as never)

    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/extension/fills').set('Authorization', `Bearer ${token}`).send({ url: `https://example.com/job-${i}` })
      expect(res.status).toBe(200)
    }

    const sixth = await request(app).post('/api/extension/fills').set('Authorization', `Bearer ${token}`).send({ url: 'https://example.com/job-6' })
    expect(sixth.status).toBe(402)
    expect(sixth.body.error.code).toBe('OUT_OF_CREDITS')
    expect(fillRepo.rows).toHaveLength(5)
  })

  it('never charges or caps a PREMIUM user', async () => {
    const app = buildApp()
    const token = await mintToken(app)
    userRepo.rows.push({ id: USER_ID, plan: Plan.PREMIUM, planExpiresAt: null, createdAt: new Date('2026-01-01') } as never)

    for (let i = 0; i < 7; i++) {
      const res = await request(app).post('/api/extension/fills').set('Authorization', `Bearer ${token}`).send({ url: `https://example.com/job-${i}` })
      expect(res.status).toBe(200)
      expect(res.body.remainingFills).toBeNull()
    }
    expect(fillRepo.rows).toHaveLength(7)
  })
})

describe('GET /api/extension/jobs/resolve', () => {
  it('requires a url query param', async () => {
    const app = buildApp()
    const token = await mintToken(app)
    userRepo.rows.push({ id: USER_ID, plan: Plan.PREMIUM, planExpiresAt: null, createdAt: new Date() } as never)

    const res = await request(app).get('/api/extension/jobs/resolve').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
  })

  it('returns whatever resolveJobForUrl resolves', async () => {
    const app = buildApp()
    const token = await mintToken(app)
    userRepo.rows.push({ id: USER_ID, plan: Plan.PREMIUM, planExpiresAt: null, createdAt: new Date() } as never)
    mockResolveJobForUrl.mockResolvedValue({ job: { id: 'uj-1' }, candidates: [] })

    const res = await request(app).get('/api/extension/jobs/resolve?url=https://example.com/job').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.job.id).toBe('uj-1')
  })
})

describe('GET /api/extension/jobs/:id/artifacts', () => {
  it('404s for a job that does not belong to the caller', async () => {
    const app = buildApp()
    const token = await mintToken(app)
    userRepo.rows.push({ id: USER_ID, plan: Plan.PREMIUM, planExpiresAt: null, createdAt: new Date() } as never)

    const res = await request(app).get('/api/extension/jobs/not-mine/artifacts').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('returns resolved artifacts for a job the caller owns', async () => {
    const app = buildApp()
    const token = await mintToken(app)
    userRepo.rows.push({ id: USER_ID, plan: Plan.PREMIUM, planExpiresAt: null, createdAt: new Date() } as never)
    userJobRepo.rows.push({ id: 'uj-1', userId: USER_ID } as never)
    mockResolveArtifactsForJob.mockResolvedValue({ resume: { type: 'MASTER', id: 'm1', downloadUrl: '/x' }, unapprovedTailoredResumeExists: false, coverLetter: null })

    const res = await request(app).get('/api/extension/jobs/uj-1/artifacts').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.resume.id).toBe('m1')
  })
})

describe('POST /api/extension/applications', () => {
  it('marks the job as applied (UserJob.appliedAt)', async () => {
    const app = buildApp()
    const token = await mintToken(app)
    const jobId = '22222222-2222-2222-2222-222222222222'
    userRepo.rows.push({ id: USER_ID, plan: Plan.PREMIUM, planExpiresAt: null, createdAt: new Date() } as never)
    userJobRepo.rows.push({ id: jobId, userId: USER_ID, appliedAt: null } as never)

    const res = await request(app).post('/api/extension/applications').set('Authorization', `Bearer ${token}`).send({ jobId })
    expect(res.status).toBe(200)
    expect((userJobRepo.rows[0] as any).appliedAt).not.toBeNull()
  })

  it('404s for a job that does not belong to the caller', async () => {
    const app = buildApp()
    const token = await mintToken(app)
    userRepo.rows.push({ id: USER_ID, plan: Plan.PREMIUM, planExpiresAt: null, createdAt: new Date() } as never)

    const res = await request(app)
      .post('/api/extension/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({ jobId: '11111111-1111-1111-1111-111111111111' })
    expect(res.status).toBe(404)
  })
})
