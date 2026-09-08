import express from 'express'
import request from 'supertest'
import { signToken } from '../../src/middleware/auth'
import { errorHandler } from '../../src/middleware/errorHandler'
import { createFakeRepo } from './testUtils/fakeRepo'

const profileRepo = createFakeRepo()

jest.mock('../../src/config/dataSource', () => {
  const { CandidateProfile } = require('../../src/entities/CandidateProfile')
  return {
    AppDataSource: {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === CandidateProfile) return profileRepo
        throw new Error(`No fake repo registered for entity: ${entity}`)
      }),
    },
  }
})

jest.mock('../../src/services/ai/anthropicClient', () => ({
  generateJson: jest.fn(async () => ({})),
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
import profileRoutes from '../../src/routes/profile.routes'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/profile', profileRoutes)
  app.use(errorHandler)
  return app
}

const USER_ID = 'user-1'
const token = signToken(USER_ID, 'FREE')

beforeEach(() => {
  profileRepo.rows.length = 0
})

describe('POST /api/profile/onboarding', () => {
  it('trusts the persisted onboardingState over a stale client-supplied state', async () => {
    // Server already has the user at VISA_STATUS (90%); a stale client
    // (e.g. after a page refresh that reset local state) sends TARGET_ROLES.
    profileRepo.rows.push({
      id: 'p1',
      userId: USER_ID,
      onboardingState: 'VISA_STATUS',
      completionScore: 90,
    } as never)

    const res = await request(buildApp())
      .post('/api/profile/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'No constraints', state: 'TARGET_ROLES' })

    expect(res.status).toBe(200)
    // Should advance from the real persisted state (VISA_STATUS -> DONE),
    // not regress based on the client's stale TARGET_ROLES.
    expect(res.body.state).toBe('DONE')
    expect(res.body.completionScore).toBe(100)
  })

  it('falls back to the client-supplied state only when no profile exists yet', async () => {
    const res = await request(buildApp())
      .post('/api/profile/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Senior Backend Engineer', state: 'WELCOME' })

    expect(res.status).toBe(200)
    expect(res.body.state).toBe('TARGET_ROLES')
  })
})
