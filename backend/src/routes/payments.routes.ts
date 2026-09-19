import { Router, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { z } from 'zod'
import { config } from '../config'
import { requireAuth } from '../middleware/auth'
import { createError } from '../middleware/errorHandler'
import { logger } from '../utils/logger'
import { getRazorpayClient } from '../services/payments/razorpayClient'
import { PASS_PRICING, isPassType } from '../services/payments/passPricing'
import { applyPassPayment } from '../services/payments/applyPassPayment'
import { AuthRequest } from '../types'

/**
 * Phase B billing (2026-09-19) — Razorpay Standard Checkout, one-time passes
 * only. See docs/monetization_plan.md's "Phase B" section for the design
 * this implements: order creation here, signature verification below, and
 * a successful verify extends `User.planExpiresAt` via
 * services/payments/applyPassPayment.ts — the same helper the Razorpay
 * webhook (routes/razorpayWebhook.routes.ts) calls, since a browser-side
 * verify alone can't be trusted as the only path (it never runs if the tab
 * closes right after payment) — no new entity, no Subscription table (see
 * that doc's "Mechanism — deliberately two columns, not a billing system").
 */

const router = Router()
router.use(requireAuth)

// GET /api/payments/plans — the pricing catalog, so the frontend renders
// its three pass cards from the same source of truth create-order prices
// against, instead of a second hardcoded copy that could drift out of sync.
router.get('/plans', (_req: AuthRequest, res: Response) => {
  const plans = (Object.entries(PASS_PRICING) as [keyof typeof PASS_PRICING, (typeof PASS_PRICING)[keyof typeof PASS_PRICING]][]).map(
    ([passType, option]) => ({
      passType,
      label: option.label,
      months: option.months,
      amount: option.amountPaise,
      listPrice: option.listPricePaise,
      recommended: option.recommended ?? false,
    })
  )
  res.json({ plans })
})

const createOrderSchema = z.object({
  passType: z.string().refine(isPassType, { message: 'Unknown passType' }),
})

// POST /api/payments/create-order — resolves the requested pass to a price
// from the server-side catalog (never trusts a client-supplied amount — see
// passPricing.ts) and opens a Razorpay order for it. `keyId` comes back in
// the response so the frontend never needs its own copy of it (see
// config/index.ts's razorpay comment for why).
router.post('/create-order', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { passType } = createOrderSchema.parse(req.body)
    const option = PASS_PRICING[passType]

    // Belt-and-suspenders: the catalog is hand-written and always above
    // this, but Razorpay itself rejects an order under 100 paise, so fail
    // with a clear message instead of forwarding a confusing upstream error.
    if (option.amountPaise < 100) {
      throw createError(500, 'INVALID_AMOUNT', 'Configured pass price is below the minimum payable amount')
    }

    let order
    try {
      order = await getRazorpayClient().orders.create({
        amount: option.amountPaise,
        currency: 'INR',
        receipt: `pass_${req.userId}_${Date.now()}`,
        // Server-authoritative record of what this order is for and who it's
        // for — read back in /verify rather than trusting the client at that
        // point either.
        notes: { userId: req.userId!, passType },
      })
    } catch (err) {
      logger.error('payments.createOrder: Razorpay API error', { err: (err as Error).message })
      throw createError(500, 'RAZORPAY_ERROR', 'Could not create the payment order')
    }

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: config.razorpay.keyId,
      passType,
      label: option.label,
      listPrice: option.listPricePaise,
      recommended: option.recommended ?? false,
    })
  } catch (err) {
    next(err)
  }
})

const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
})

function signaturesMatch(expectedHex: string, actualHex: string): boolean {
  const expected = Buffer.from(expectedHex, 'hex')
  const actual = Buffer.from(actualHex, 'hex')
  // A malformed/wrong-length signature from the client would otherwise
  // throw inside timingSafeEqual before ever reaching the comparison.
  if (expected.length !== actual.length) return false
  return crypto.timingSafeEqual(expected, actual)
}

// POST /api/payments/verify — the client's final step after Razorpay
// Checkout's modal succeeds. Verifies the HMAC-SHA256(order_id + "|" +
// payment_id) signature against KEY_SECRET; only on a match does anything
// touch the database. Idempotent: a repeat call for a payment already
// processed (e.g. a retried request) returns success without re-extending
// the pass a second time.
router.post('/verify', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = verifyPaymentSchema.parse(req.body)

    const expectedSignature = crypto
      .createHmac('sha256', config.razorpay.keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (!signaturesMatch(expectedSignature, razorpay_signature)) {
      throw createError(400, 'SIGNATURE_MISMATCH', 'Payment signature verification failed')
    }

    // The signature proves the payment happened; fetching the order proves
    // it was *this user's* order (its notes were set server-side at create
    // time, see above) and tells us which pass they actually paid for —
    // never taken from the request body.
    let order
    try {
      order = await getRazorpayClient().orders.fetch(razorpay_order_id)
    } catch (err) {
      logger.error('payments.verify: Razorpay API error', { err: (err as Error).message })
      throw createError(500, 'RAZORPAY_ERROR', 'Could not confirm the order with Razorpay')
    }

    if (order.notes?.userId !== req.userId) {
      throw createError(403, 'ORDER_MISMATCH', 'This order does not belong to the current user')
    }
    const passType = order.notes?.passType
    if (!isPassType(passType)) {
      throw createError(500, 'ORDER_CORRUPT', 'Order is missing a valid pass type')
    }

    let result
    try {
      result = await applyPassPayment(req.userId!, razorpay_payment_id, passType)
    } catch (err) {
      throw createError(404, 'USER_NOT_FOUND', (err as Error).message)
    }

    res.json({ success: true, planExpiresAt: result.planExpiresAt, alreadyProcessed: result.alreadyProcessed })
  } catch (err) {
    next(err)
  }
})

export default router
