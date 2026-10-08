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

const mockOrdersFetch = jest.fn()
jest.mock('../../src/services/payments/razorpayClient', () => ({
  getRazorpayClient: () => ({ orders: { fetch: mockOrdersFetch } }),
}))

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

const ONE_MONTH_PAISE = 39900

function paymentCapturedPayload(
  overrides: Partial<{ paymentId: string; orderId: string | null; amount: number; currency: string }> = {}
) {
  const { paymentId = 'pay_xyz789', orderId = 'order_abc123', amount = ONE_MONTH_PAISE, currency = 'INR' } = overrides
  return {
    event: 'payment.captured',
    payload: { payment: { entity: { id: paymentId, order_id: orderId, amount, currency } } },
  }
}

// What Razorpay returns for an order created by POST /api/payments/create-order.
function jobmagnateOrder(overrides: Partial<{ receipt: string; amount: number; notes: Record<string, string> }> = {}) {
  return {
    id: 'order_abc123',
    amount: ONE_MONTH_PAISE,
    receipt: `pass_${USER_ID}_1760000000000`,
    notes: { userId: USER_ID, passType: 'ONE_MONTH' },
    ...overrides,
  }
}

function getUser() {
  return userRepo.rows.find((r) => (r as { id: string }).id === USER_ID) as unknown as { plan: Plan; planExpiresAt: Date | null }
}

async function postSigned(body: object) {
  return request(buildApp()).post('/api/webhooks/razorpay').set('X-Razorpay-Signature', sign(JSON.stringify(body))).send(body)
}

beforeEach(() => {
  userRepo.rows.length = 0
  userRepo.rows.push({ id: USER_ID, plan: Plan.FREE, planExpiresAt: null, settings: {} })
  mockOrdersFetch.mockReset()
  mockOrdersFetch.mockResolvedValue(jobmagnateOrder())
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

  describe('payments that are not JobMagnate passes (shared Razorpay account)', () => {
    it('ignores a payment with no order (e.g. a payment link / QR) without calling Razorpay', async () => {
      const res = await postSigned(paymentCapturedPayload({ orderId: null }))

      expect(res.status).toBe(200)
      expect(res.body.ignored).toBe('not_jobmagnate')
      expect(mockOrdersFetch).not.toHaveBeenCalled()
      expect(getUser().plan).toBe(Plan.FREE)
    })

    it('ignores another product\'s order (no JobMagnate notes or receipt)', async () => {
      mockOrdersFetch.mockResolvedValue({ id: 'order_other', amount: 150000, receipt: 'nm_invoice_42', notes: {} })

      const res = await postSigned(paymentCapturedPayload({ amount: 150000 }))

      expect(res.status).toBe(200)
      expect(res.body.ignored).toBe('not_jobmagnate')
      expect(getUser().plan).toBe(Plan.FREE)
    })

    it('ignores an order whose notes imitate ours but whose receipt was not minted by create-order', async () => {
      mockOrdersFetch.mockResolvedValue(jobmagnateOrder({ receipt: 'nm_invoice_42' }))

      const res = await postSigned(paymentCapturedPayload())

      expect(res.body.ignored).toBe('not_jobmagnate')
      expect(getUser().plan).toBe(Plan.FREE)
    })

    it('ignores an order whose receipt belongs to a different user than its notes claim', async () => {
      mockOrdersFetch.mockResolvedValue(jobmagnateOrder({ receipt: 'pass_someone-else_1760000000000' }))

      const res = await postSigned(paymentCapturedPayload())

      expect(res.body.ignored).toBe('not_jobmagnate')
      expect(getUser().plan).toBe(Plan.FREE)
    })

    it('does not trust notes on the webhook payload itself — only the fetched order', async () => {
      mockOrdersFetch.mockResolvedValue({ id: 'order_other', amount: 150000, receipt: 'nm_invoice_42', notes: {} })
      const body = paymentCapturedPayload({ amount: 150000 })
      ;(body.payload.payment.entity as Record<string, unknown>).notes = { userId: USER_ID, passType: 'ONE_MONTH' }

      const res = await postSigned(body)

      expect(res.body.ignored).toBe('not_jobmagnate')
      expect(getUser().plan).toBe(Plan.FREE)
    })
  })

  it('does not apply a JobMagnate order whose paid amount differs from the catalog price', async () => {
    const res = await postSigned(paymentCapturedPayload({ amount: 100 }))

    expect(res.status).toBe(200)
    expect(res.body.ignored).toBe('amount_mismatch')
    expect(getUser().plan).toBe(Plan.FREE)
  })

  it('does not apply a payment in a non-INR currency', async () => {
    const res = await postSigned(paymentCapturedPayload({ currency: 'USD' }))

    expect(res.body.ignored).toBe('amount_mismatch')
    expect(getUser().plan).toBe(Plan.FREE)
  })

  it('returns 5xx (so Razorpay retries) when the order cannot be fetched, instead of dropping a real purchase', async () => {
    mockOrdersFetch.mockRejectedValue(new Error('network down'))

    const res = await postSigned(paymentCapturedPayload())

    expect(res.status).toBe(502)
    expect(getUser().plan).toBe(Plan.FREE)
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
