import express from 'express'
import request from 'supertest'
import crypto from 'crypto'
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

const WEBHOOK_SECRET = 'test-webhook-secret'
jest.mock('../../src/config', () => {
  const actual = jest.requireActual('../../src/config')
  return {
    config: {
      ...actual.config,
      razorpay: { keyId: 'rzp_test_fake', keySecret: 'test-key-secret', webhookSecret: 'test-webhook-secret' },
    },
  }
})

// eslint-disable-next-line @typescript-eslint/no-var-requires
import razorpayWebhookRoutes from '../../src/routes/razorpayWebhook.routes'

// Mirrors index.ts's express.json({ verify }) exactly — the webhook route
// depends on req.rawBody being the untouched bytes Razorpay signed, not a
// re-serialization of the parsed body.
function buildApp() {
  const app = express()
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        ;(req as express.Request & { rawBody?: Buffer }).rawBody = buf
      },
    })
  )
  app.use('/api/webhooks', razorpayWebhookRoutes)
  app.use(errorHandler)
  return app
}

const USER_ID = 'user-1'

function sign(body: string): string {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')
}

function paymentCapturedPayload(overrides: Partial<{ paymentId: string; orderId: string; userId: string; passType: string }> = {}) {
  const { paymentId = 'pay_xyz789', orderId = 'order_abc123', userId = USER_ID, passType = 'ONE_MONTH' } = overrides
  return {
    event: 'payment.captured',
    payload: { payment: { entity: { id: paymentId, order_id: orderId, notes: { userId, passType } } } },
  }
}

beforeEach(() => {
  userRepo.rows.length = 0
  userRepo.rows.push({ id: USER_ID, plan: Plan.FREE, planExpiresAt: null, settings: {} })
})

describe('POST /api/webhooks/razorpay', () => {
  it('rejects a request with no signature header', async () => {
    const res = await request(buildApp()).post('/api/webhooks/razorpay').send(paymentCapturedPayload())
    expect(res.status).toBe(400)
  })

  it('rejects a request with a wrong signature and never touches the user', async () => {
    const body = paymentCapturedPayload()
    const res = await request(buildApp())
      .post('/api/webhooks/razorpay')
      .set('X-Razorpay-Signature', 'aa'.repeat(32)) // well-formed hex, wrong value
      .send(body)

    expect(res.status).toBe(400)
    const user = userRepo.rows.find((r) => (r as { id: string }).id === USER_ID) as unknown as { plan: Plan }
    expect(user.plan).toBe(Plan.FREE)
  })

  it('acknowledges but ignores an event other than payment.captured', async () => {
    const body = { event: 'payment.failed', payload: {} }
    const raw = JSON.stringify(body)

    const res = await request(buildApp()).post('/api/webhooks/razorpay').set('X-Razorpay-Signature', sign(raw)).send(body)

    expect(res.status).toBe(200)
    expect(res.body.ignored).toBe('payment.failed')
    const user = userRepo.rows.find((r) => (r as { id: string }).id === USER_ID) as unknown as { plan: Plan }
    expect(user.plan).toBe(Plan.FREE)
  })

  it('applies the pass on a valid payment.captured signature', async () => {
    const body = paymentCapturedPayload()
    const raw = JSON.stringify(body)

    const res = await request(buildApp()).post('/api/webhooks/razorpay').set('X-Razorpay-Signature', sign(raw)).send(body)

    expect(res.status).toBe(200)
    const user = userRepo.rows.find((r) => (r as { id: string }).id === USER_ID) as unknown as { plan: Plan; planExpiresAt: Date }
    expect(user.plan).toBe(Plan.PREMIUM)
    expect(user.planExpiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000)
  })

  it('is idempotent with a repeat delivery of the same payment', async () => {
    const body = paymentCapturedPayload()
    const raw = JSON.stringify(body)
    const app = buildApp()

    await request(app).post('/api/webhooks/razorpay').set('X-Razorpay-Signature', sign(raw)).send(body)
    const firstExpiry = (userRepo.rows.find((r) => (r as { id: string }).id === USER_ID) as unknown as { planExpiresAt: Date }).planExpiresAt

    const second = await request(app).post('/api/webhooks/razorpay').set('X-Razorpay-Signature', sign(raw)).send(body)
    const secondExpiry = (userRepo.rows.find((r) => (r as { id: string }).id === USER_ID) as unknown as { planExpiresAt: Date }).planExpiresAt

    expect(second.status).toBe(200)
    expect(secondExpiry.getTime()).toBe(firstExpiry.getTime())
  })

  it('acknowledges with 200 rather than retrying forever on a malformed payment.captured payload', async () => {
    const body = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1' } } } } // no order_id/notes
    const raw = JSON.stringify(body)

    const res = await request(buildApp()).post('/api/webhooks/razorpay').set('X-Razorpay-Signature', sign(raw)).send(body)

    expect(res.status).toBe(200)
    expect(res.body.error).toBe('missing_fields')
  })

  it('this user\'s webhook and a separate verify-path payment both being idempotent share the same processedPaymentIds list', async () => {
    // Simulates /verify having already applied this exact payment (e.g. the
    // browser's callback beat the webhook there) — the webhook arriving
    // afterward for the same payment id must not extend the pass again.
    userRepo.rows[0] = { id: USER_ID, plan: Plan.PREMIUM, planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), settings: { processedPaymentIds: ['pay_xyz789'] } }
    const expiryBefore = (userRepo.rows[0] as { planExpiresAt: Date }).planExpiresAt

    const body = paymentCapturedPayload()
    const raw = JSON.stringify(body)
    const res = await request(buildApp()).post('/api/webhooks/razorpay').set('X-Razorpay-Signature', sign(raw)).send(body)

    expect(res.status).toBe(200)
    const expiryAfter = (userRepo.rows.find((r) => (r as { id: string }).id === USER_ID) as unknown as { planExpiresAt: Date }).planExpiresAt
    expect(expiryAfter.getTime()).toBe(expiryBefore.getTime())
  })
})
