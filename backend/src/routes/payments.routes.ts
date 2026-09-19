import { Router, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { z } from 'zod'
import { AppDataSource } from '../config/dataSource'
import { config } from '../config'
import { User } from '../entities/User'
import { Plan } from '../entities/enums'
import { requireAuth } from '../middleware/auth'
import { createError } from '../middleware/errorHandler'
import { logger } from '../utils/logger'
import { getRazorpayClient } from '../services/payments/razorpayClient'
import { PASS_PRICING, isPassType } from '../services/payments/passPricing'
import { AuthRequest } from '../types'

/**
 * Phase B billing (2026-09-19) — Razorpay Standard Checkout, one-time passes
 * only. See docs/monetization_plan.md's "Phase B" section for the design
 * this implements: order creation here, signature verification below, and
 * a successful verify extends `User.planExpiresAt` exactly the way
 * POST /api/account/activate-pass already does for the free month — no new
 * entity, no webhook, no Subscription table (see that doc's "Mechanism —
 * deliberately two columns, not a billing system").
 */

const router = Router()
router.use(requireAuth)

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

    const userRepo = AppDataSource.getRepository(User)
    const user = await userRepo.findOneBy({ id: req.userId! })
    if (!user) throw createError(404, 'USER_NOT_FOUND', 'User not found')

    const processedPaymentIds = (user.settings.processedPaymentIds as string[] | undefined) ?? []
    if (processedPaymentIds.includes(razorpay_payment_id)) {
      // Already applied — same success shape, but no double-extension.
      res.json({ success: true, planExpiresAt: user.planExpiresAt, alreadyProcessed: true })
      return
    }

    const { months } = PASS_PRICING[passType]
    const extendFrom = user.planExpiresAt && user.planExpiresAt.getTime() > Date.now() ? user.planExpiresAt : new Date()
    user.plan = Plan.PREMIUM
    user.planExpiresAt = new Date(extendFrom.getTime() + months * 30 * 24 * 60 * 60 * 1000)
    user.settings = { ...user.settings, processedPaymentIds: [...processedPaymentIds, razorpay_payment_id] }
    await userRepo.save(user)

    logger.info(`payments.verify: extended user ${user.id} to ${user.planExpiresAt.toISOString()} (${passType})`)
    res.json({ success: true, planExpiresAt: user.planExpiresAt })
  } catch (err) {
    next(err)
  }
})

export default router
