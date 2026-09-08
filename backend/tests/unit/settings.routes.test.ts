import express from 'express'
import request from 'supertest'
import { signToken } from '../../src/middleware/auth'
import { errorHandler } from '../../src/middleware/errorHandler'
import { encrypt } from '../../src/utils/encryption'
import { createFakeRepo } from './testUtils/fakeRepo'

const userRepo = createFakeRepo()

jest.mock('../../src/config/dataSource', () => {
  const { User } = require('../../src/entities/User')
  return {
    AppDataSource: {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === User) return userRepo
        throw new Error(`No fake repo registered for entity: ${entity}`)
      }),
    },
  }
})

// eslint-disable-next-line @typescript-eslint/no-var-requires
import settingsRoutes from '../../src/routes/settings.routes'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/settings', settingsRoutes)
  app.use(errorHandler)
  return app
}

const USER_ID = 'user-1'
const token = signToken(USER_ID, 'FREE')

// The fake repo is untyped (Record<string, unknown> rows) — this just gives
// the test file a typed view onto the one field these tests care about.
function storedConnection(): string | undefined {
  return (userRepo.rows[0] as unknown as { settings: Record<string, unknown> }).settings.modelConnection as
    | string
    | undefined
}

beforeEach(() => {
  userRepo.rows.length = 0
  userRepo.rows.push({ id: USER_ID, settings: {} } as never)
  global.fetch = jest.fn(async () => ({ ok: true })) as unknown as typeof fetch
})

describe('GET /api/settings/model-connection', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(buildApp()).get('/api/settings/model-connection')
    expect(res.status).toBe(401)
  })

  it('returns not-configured when nothing is saved', async () => {
    const res = await request(buildApp()).get('/api/settings/model-connection').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ configured: false, kind: null, preview: null })
  })

  it('returns a masked preview for a saved cloud key', async () => {
    userRepo.rows[0].settings = { modelConnection: encrypt('sk-ant-abcdefghijklmnop') }
    const res = await request(buildApp()).get('/api/settings/model-connection').set('Authorization', `Bearer ${token}`)
    expect(res.body.configured).toBe(true)
    expect(res.body.kind).toBe('cloud')
    expect(res.body.preview).not.toContain('abcdefghijklmnop')
    expect(res.body.preview).toContain('…')
  })

  it('returns the full baseUrl#model preview for a saved local connection (not a secret)', async () => {
    userRepo.rows[0].settings = { modelConnection: encrypt('http://localhost:11434/v1#model=gemma4:e4b') }
    const res = await request(buildApp()).get('/api/settings/model-connection').set('Authorization', `Bearer ${token}`)
    expect(res.body).toEqual({
      configured: true,
      kind: 'local',
      preview: 'http://localhost:11434/v1#model=gemma4:e4b',
    })
  })
})

describe('PUT /api/settings/model-connection', () => {
  it('saves a valid local connection and reports it reachable', async () => {
    const res = await request(buildApp())
      .put('/api/settings/model-connection')
      .set('Authorization', `Bearer ${token}`)
      .send({ raw: 'http://localhost:11434/v1#model=gemma4:e4b' })

    expect(res.status).toBe(200)
    expect(res.body.configured).toBe(true)
    expect(res.body.kind).toBe('local')
    expect(res.body.warning).toBeUndefined()
    expect(typeof storedConnection()).toBe('string')
    expect(storedConnection()).not.toContain('gemma4') // stored encrypted, not plaintext
  })

  it('saves anyway but warns when the local endpoint is unreachable', async () => {
    global.fetch = jest.fn(async () => { throw new Error('ECONNREFUSED') }) as unknown as typeof fetch
    const res = await request(buildApp())
      .put('/api/settings/model-connection')
      .set('Authorization', `Bearer ${token}`)
      .send({ raw: 'http://localhost:11434/v1#model=gemma4:e4b' })

    expect(res.status).toBe(200)
    expect(res.body.configured).toBe(true)
    expect(res.body.warning).toMatch(/couldn't reach/)
  })

  it('rejects an invalid connection string without saving it', async () => {
    const res = await request(buildApp())
      .put('/api/settings/model-connection')
      .set('Authorization', `Bearer ${token}`)
      .send({ raw: 'http://localhost:11434/v1' }) // missing #model=

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_CONNECTION')
    expect(storedConnection()).toBeUndefined()
  })

  it('rejects an empty body', async () => {
    const res = await request(buildApp())
      .put('/api/settings/model-connection')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/settings/model-connection', () => {
  it('clears a saved connection', async () => {
    userRepo.rows[0].settings = { modelConnection: encrypt('sk-ant-something') }
    const res = await request(buildApp()).delete('/api/settings/model-connection').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ configured: false, kind: null, preview: null })
    expect(storedConnection()).toBeUndefined()
  })
})
