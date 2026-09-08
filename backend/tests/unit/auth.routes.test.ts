import express from 'express'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import { errorHandler } from '../../src/middleware/errorHandler'
import { AuthProvider, Plan } from '../../src/entities/enums'
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

const mockVerifyFirebaseIdToken = jest.fn()
jest.mock('../../src/services/auth/firebaseAdmin', () => ({
  verifyFirebaseIdToken: (...args: unknown[]) => mockVerifyFirebaseIdToken(...(args as [string])),
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
import authRoutes from '../../src/routes/auth.routes'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/auth', authRoutes)
  app.use(errorHandler)
  return app
}

beforeEach(() => {
  userRepo.rows.length = 0
  mockVerifyFirebaseIdToken.mockReset()
})

describe('POST /api/auth/register', () => {
  it('creates a password-based account', async () => {
    const app = buildApp()
    const res = await request(app).post('/api/auth/register').send({ email: 'a@example.com', password: 'password123', name: 'A' })

    expect(res.status).toBe(201)
    expect(res.body.token).toBeDefined()
    expect(userRepo.rows).toHaveLength(1)
    expect((userRepo.rows[0] as any).authProvider).toBe(AuthProvider.PASSWORD)
    expect((userRepo.rows[0] as any).passwordHash).not.toBe('password123') // hashed, not plaintext
  })

  it('rejects a duplicate email', async () => {
    userRepo.rows.push({ id: 'u1', email: 'a@example.com', passwordHash: 'x', plan: Plan.FREE } as never)
    const app = buildApp()
    const res = await request(app).post('/api/auth/register').send({ email: 'a@example.com', password: 'password123' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('EMAIL_TAKEN')
  })
})

describe('POST /api/auth/login', () => {
  it('logs in with correct password', async () => {
    const hash = await bcrypt.hash('password123', 12)
    userRepo.rows.push({ id: 'u1', email: 'a@example.com', passwordHash: hash, plan: Plan.FREE, name: null } as never)

    const app = buildApp()
    const res = await request(app).post('/api/auth/login').send({ email: 'a@example.com', password: 'password123' })

    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()
    expect(res.body.user.email).toBe('a@example.com')
  })

  it('rejects a wrong password with a generic message', async () => {
    const hash = await bcrypt.hash('password123', 12)
    userRepo.rows.push({ id: 'u1', email: 'a@example.com', passwordHash: hash, plan: Plan.FREE } as never)

    const app = buildApp()
    const res = await request(app).post('/api/auth/login').send({ email: 'a@example.com', password: 'wrong' })
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('rejects login for a Google-only account (null passwordHash) without throwing', async () => {
    userRepo.rows.push({ id: 'u1', email: 'a@example.com', passwordHash: null, plan: Plan.FREE, authProvider: AuthProvider.GOOGLE } as never)

    const app = buildApp()
    const res = await request(app).post('/api/auth/login').send({ email: 'a@example.com', password: 'anything' })
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('rejects an unknown email with the same generic message (no email enumeration)', async () => {
    const app = buildApp()
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'anything' })
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
  })
})

describe('POST /api/auth/google', () => {
  it('creates a new Google account when no user matches by uid or email, and reports isNewUser', async () => {
    mockVerifyFirebaseIdToken.mockResolvedValue({ uid: 'firebase-uid-1', email: 'new@example.com', name: 'New User' })

    const app = buildApp()
    const res = await request(app).post('/api/auth/google').send({ idToken: 'real-firebase-token' })

    expect(res.status).toBe(200)
    expect(res.body.isNewUser).toBe(true)
    expect(res.body.token).toBeDefined()
    expect(userRepo.rows).toHaveLength(1)
    const created = userRepo.rows[0] as any
    expect(created.email).toBe('new@example.com')
    expect(created.firebaseUid).toBe('firebase-uid-1')
    expect(created.authProvider).toBe(AuthProvider.GOOGLE)
    expect(created.passwordHash).toBeNull()
  })

  it('signs in an existing Google-linked user without creating a duplicate', async () => {
    userRepo.rows.push({
      id: 'u1', email: 'existing@example.com', firebaseUid: 'firebase-uid-2',
      passwordHash: null, plan: Plan.FREE, authProvider: AuthProvider.GOOGLE, name: 'Existing',
    } as never)
    mockVerifyFirebaseIdToken.mockResolvedValue({ uid: 'firebase-uid-2', email: 'existing@example.com' })

    const app = buildApp()
    const res = await request(app).post('/api/auth/google').send({ idToken: 'real-firebase-token' })

    expect(res.status).toBe(200)
    expect(res.body.isNewUser).toBe(false)
    expect(userRepo.rows).toHaveLength(1) // no duplicate created
  })

  it('links Google to an existing password account with the same email, rather than duplicating it', async () => {
    userRepo.rows.push({
      id: 'u1', email: 'shared@example.com', passwordHash: 'some-hash',
      plan: Plan.FREE, authProvider: AuthProvider.PASSWORD, firebaseUid: null, name: 'Shared',
    } as never)
    mockVerifyFirebaseIdToken.mockResolvedValue({ uid: 'firebase-uid-3', email: 'shared@example.com' })

    const app = buildApp()
    const res = await request(app).post('/api/auth/google').send({ idToken: 'real-firebase-token' })

    expect(res.status).toBe(200)
    expect(res.body.isNewUser).toBe(false)
    expect(userRepo.rows).toHaveLength(1) // linked, not duplicated
    expect((userRepo.rows[0] as any).firebaseUid).toBe('firebase-uid-3')
    expect((userRepo.rows[0] as any).id).toBe('u1') // same account, still password-capable
  })

  it('returns a 401 when the Firebase token fails verification', async () => {
    mockVerifyFirebaseIdToken.mockRejectedValue(new Error('Firebase ID token has expired'))

    const app = buildApp()
    const res = await request(app).post('/api/auth/google').send({ idToken: 'bad-token' })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_GOOGLE_TOKEN')
  })

  it('returns a 400 when the verified Google account has no email', async () => {
    mockVerifyFirebaseIdToken.mockResolvedValue({ uid: 'firebase-uid-4' }) // no email

    const app = buildApp()
    const res = await request(app).post('/api/auth/google').send({ idToken: 'real-firebase-token' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('NO_EMAIL')
  })
})
