import express from 'express'
import request from 'supertest'
import crypto from 'crypto'
import { signToken } from '../../src/middleware/auth'
import { errorHandler } from '../../src/middleware/errorHandler'
import { createFakeRepo } from './testUtils/fakeRepo'
import { Plan } from '../../src/entities/enums'

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

const KEY_SECRET = 'test-key-secret'
jest.mock('../../src/config', () => {
  const actual = jest.requireActual('../../src/config')
  return { config: { ...actual.config, razorpay: { keyId: 'rzp_test_fake', keySecret: 'test-key-secret' } } }
})

const mockOrdersCreate = jest.fn()
const mockOrdersFetch = jest.fn()
jest.mock('../../src/services/payments/razorpayClient', () => ({
  getRazorpayClient: () => ({ orders: { create: mockOrdersCreate, fetch: mockOrdersFetch } }),
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
import paymentsRoutes from '../../src/routes/payments.routes'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/payments', paymentsRoutes)
  app.use(errorHandler)
  return app
}

const USER_ID = 'user-1'
const sessionToken = signToken(USER_ID, 'FREE')

function validSignature(orderId: string, paymentId: string): string {
  return crypto.createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex')
}

beforeEach(() => {
  userRepo.rows.length = 0
  userRepo.rows.push({ id: USER_ID, plan: Plan.FREE, planExpiresAt: null, settings: {} })
  mockOrdersCreate.mockReset()
  mockOrdersFetch.mockReset()
})

describe('POST /api/payments/create-order', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(buildApp()).post('/api/payments/create-order').send({ passType: 'ONE_MONTH' })
    expect(res.status).toBe(401)
  })

  it('rejects an unknown passType', async () => {
    const res = await request(buildApp())
      .post('/api/payments/create-order')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ passType: 'LIFETIME' })
    expect(res.status).toBe(400)
    expect(mockOrdersCreate).not.toHaveBeenCalled()
  })

  it('creates an order priced from the server-side catalog, never a client-supplied amount', async () => {
    mockOrdersCreate.mockResolvedValue({ id: 'order_abc123', amount: 29900, currency: 'INR' })

    const res = await request(buildApp())
      .post('/api/payments/create-order')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ passType: 'ONE_MONTH', amount: 1 }) // a tampered/irrelevant client amount

    expect(res.status).toBe(200)
    expect(mockOrdersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 29900, currency: 'INR', notes: { userId: USER_ID, passType: 'ONE_MONTH' } })
    )
    expect(res.body).toEqual({ orderId: 'order_abc123', amount: 29900, currency: 'INR', keyId: 'rzp_test_fake', passType: 'ONE_MONTH', label: '1-month pass' })
  })

  it('returns 500 when the Razorpay API call fails', async () => {
    mockOrdersCreate.mockRejectedValue(new Error('upstream down'))
    const res = await request(buildApp())
      .post('/api/payments/create-order')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ passType: 'ONE_MONTH' })
    expect(res.status).toBe(500)
  })
})

describe('POST /api/payments/verify', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(buildApp()).post('/api/payments/verify').send({})
    expect(res.status).toBe(401)
  })

  it('returns 400 on missing fields', async () => {
    const res = await request(buildApp())
      .post('/api/payments/verify')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ razorpay_order_id: 'order_abc123' })
    expect(res.status).toBe(400)
  })

  it('returns 400 and never touches the user on a signature mismatch', async () => {
    const res = await request(buildApp())
      .post('/api/payments/verify')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ razorpay_order_id: 'order_abc123', razorpay_payment_id: 'pay_xyz789', razorpay_signature: 'not-the-real-signature-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' })

    expect(res.status).toBe(400)
    expect(mockOrdersFetch).not.toHaveBeenCalled()
    const user = userRepo.rows.find((r) => (r as { id: string }).id === USER_ID) as unknown as { plan: Plan }
    expect(user.plan).toBe(Plan.FREE)
  })

  it('rejects an order that belongs to a different user', async () => {
    const orderId = 'order_abc123'
    const paymentId = 'pay_xyz789'
    mockOrdersFetch.mockResolvedValue({ id: orderId, notes: { userId: 'someone-else', passType: 'ONE_MONTH' } })

    const res = await request(buildApp())
      .post('/api/payments/verify')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: validSignature(orderId, paymentId) })

    expect(res.status).toBe(403)
  })

  it('extends planExpiresAt and upgrades to PREMIUM on a valid, matching signature', async () => {
    const orderId = 'order_abc123'
    const paymentId = 'pay_xyz789'
    mockOrdersFetch.mockResolvedValue({ id: orderId, notes: { userId: USER_ID, passType: 'ONE_MONTH' } })

    const res = await request(buildApp())
      .post('/api/payments/verify')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: validSignature(orderId, paymentId) })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const user = userRepo.rows.find((r) => (r as { id: string }).id === USER_ID) as unknown as { plan: Plan; planExpiresAt: Date }
    expect(user.plan).toBe(Plan.PREMIUM)
    expect(user.planExpiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000)
  })

  it('is idempotent — a repeat verify for the same payment does not extend the pass twice', async () => {
    const orderId = 'order_abc123'
    const paymentId = 'pay_xyz789'
    mockOrdersFetch.mockResolvedValue({ id: orderId, notes: { userId: USER_ID, passType: 'ONE_MONTH' } })
    const app = buildApp()
    const body = { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: validSignature(orderId, paymentId) }

    const first = await request(app).post('/api/payments/verify').set('Authorization', `Bearer ${sessionToken}`).send(body)
    const firstExpiry = (userRepo.rows.find((r) => (r as { id: string }).id === USER_ID) as unknown as { planExpiresAt: Date }).planExpiresAt

    const second = await request(app).post('/api/payments/verify').set('Authorization', `Bearer ${sessionToken}`).send(body)
    const secondExpiry = (userRepo.rows.find((r) => (r as { id: string }).id === USER_ID) as unknown as { planExpiresAt: Date }).planExpiresAt

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(second.body.alreadyProcessed).toBe(true)
    expect(secondExpiry.getTime()).toBe(firstExpiry.getTime())
  })
})
