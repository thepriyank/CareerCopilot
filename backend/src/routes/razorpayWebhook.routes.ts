import { Router, Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { config } from '../config'
import { createError } from '../middleware/errorHandler'
import { logger } from '../utils/logger'
import { PASS_PRICING, isPassType } from '../services/payments/passPricing'
import { applyPassPayment } from '../services/payments/applyPassPayment'
import { getRazorpayClient } from '../services/payments/razorpayClient'
import { receiptMatchesUser } from '../services/payments/orderOwnership'

/**
 * Razorpay webhook — the authoritative, server-to-server counterpart to
 * POST /api/payments/verify (routes/payments.routes.ts). Deliberately a
 * separate router with no requireAuth: Razorpay calls this directly, there
 * is no user session, and it's authenticated instead by an HMAC signature
 * over the raw request body (see index.ts's express.json `verify` option,
 * which stashes that raw buffer — re-serialized JSON isn't guaranteed to
 * byte-match what Razorpay actually signed).
 *
 * Why this exists alongside /verify rather than replacing it: /verify is
 * fast (the user sees their new plan the instant Checkout's modal closes)
 * but only runs if the browser stays alive long enough to call it. This
 * webhook fires from Razorpay's side regardless — closed tab, crashed
 * browser, flaky network after payment — so a pass never silently fails to
 * apply just because the client didn't get to finish. Both converge on the
 * same services/payments/applyPassPayment.ts, keyed by payment id, so
 * whichever arrives first wins and the other is a no-op.
 *
 * Shared-account safety: Razorpay delivers every payment on the merchant
 * account to every active webhook, including other products' (e.g. NowMagnate
 * Innovations). A payment is applied only if its order carries a JobMagnate
 * receipt (services/payments/orderOwnership.ts) and the amount matches the
 * catalog price; anything else is acknowledged with 200 and ignored.
 *
 * Setup (manual, in Razorpay Dashboard -> Settings -> Webhooks):
 *   URL: https://<backend host>/api/webhooks/razorpay
 *   Active events: payment.captured (only one needed — see below)
 *   Secret: any value you choose, set identically here as
 *   RAZORPAY_WEBHOOK_SECRET — this is NOT the same as RAZORPAY_KEY_SECRET.
 */

const router = Router()

type RawBodyRequest = Request & { rawBody?: Buffer }

interface RazorpayWebhookPayload {
  event: string
  payload?: {
    payment?: {
      entity?: {
        id?: string
        order_id?: string | null
        amount?: number
        currency?: string
      }
    }
  }
}

router.post('/razorpay', async (req: RawBodyRequest, res: Response, next: NextFunction) => {
  try {
    if (!config.razorpay.webhookSecret) {
      throw createError(503, 'WEBHOOK_NOT_CONFIGURED', 'RAZORPAY_WEBHOOK_SECRET is not set')
    }

    const signature = req.headers['x-razorpay-signature']
    if (typeof signature !== 'string' || !req.rawBody) {
      throw createError(400, 'MISSING_SIGNATURE', 'Missing X-Razorpay-Signature header or request body')
    }

    const expected = crypto.createHmac('sha256', config.razorpay.webhookSecret).update(req.rawBody).digest('hex')
    const expectedBuf = Buffer.from(expected, 'hex')
    const actualBuf = Buffer.from(signature, 'hex')
    const signatureValid = expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf)

    if (!signatureValid) {
      logger.warn('razorpayWebhook: signature mismatch — rejecting')
      throw createError(400, 'SIGNATURE_MISMATCH', 'Webhook signature verification failed')
    }

    const body = req.body as RazorpayWebhookPayload

    // Every other event (payment.failed, order.paid, refund.*, ...) is
    // acknowledged with 200 and otherwise ignored — payment.captured is the
    // one definitive "money secured" signal; reacting to more than one
    // event for the same payment would just mean re-deriving the same
    // idempotency check for no benefit.
    if (body.event !== 'payment.captured') {
      res.status(200).json({ received: true, ignored: body.event })
      return
    }

    const payment = body.payload?.payment?.entity
    const paymentId = payment?.id
    const orderId = payment?.order_id

    // Webhooks are account-level: payments for other products on the same
    // Razorpay account (e.g. NowMagnate Innovations) arrive here too, and
    // must be acknowledged and dropped, never applied. Every JobMagnate pass
    // goes through an order we created, so a payment with no order can't be
    // ours (payment links, QR codes, etc.).
    if (!paymentId || !orderId) {
      logger.info('razorpayWebhook: payment.captured has no order — not a JobMagnate pass, ignoring')
      res.status(200).json({ received: true, ignored: 'not_jobmagnate' })
      return
    }

    // The payload's own `notes` are not trusted for identity: they are
    // free-form and can be set by whoever initiates the payment. The order
    // is fetched from Razorpay instead (same approach as /verify), since its
    // receipt + notes were written server-side by create-order. A fetch
    // failure throws -> 5xx -> Razorpay retries, rather than silently
    // dropping a real purchase.
    let order
    try {
      order = await getRazorpayClient().orders.fetch(orderId)
    } catch (err) {
      logger.error('razorpayWebhook: could not fetch order from Razorpay', { orderId, err: (err as Error).message })
      throw createError(502, 'RAZORPAY_ERROR', 'Could not confirm the order with Razorpay')
    }

    const passType = order.notes?.passType
    const userId = order.notes?.userId
    if (typeof userId !== 'string' || !isPassType(passType) || !receiptMatchesUser(order.receipt, userId)) {
      logger.info('razorpayWebhook: order was not created by JobMagnate create-order — ignoring', { orderId, paymentId })
      res.status(200).json({ received: true, ignored: 'not_jobmagnate' })
      return
    }

    // It's our order; now make sure what was actually paid matches the
    // catalog price for that pass. A mismatch is never auto-applied and
    // never retried (retrying can't fix it) — logged loudly for a human.
    const expectedAmount = PASS_PRICING[passType].amountPaise
    if (payment.amount !== expectedAmount || order.amount !== expectedAmount || payment.currency !== 'INR') {
      logger.error('razorpayWebhook: JobMagnate order payment does not match catalog price — not applying', {
        orderId,
        paymentId,
        passType,
        expectedAmount,
        paymentAmount: payment.amount,
        orderAmount: order.amount,
        currency: payment.currency,
      })
      res.status(200).json({ received: true, ignored: 'amount_mismatch' })
      return
    }

    const result = await applyPassPayment(userId, paymentId, passType)
    logger.info(`razorpayWebhook: payment.captured applied for user ${userId}, payment ${paymentId} (alreadyProcessed=${result.alreadyProcessed})`)
    res.status(200).json({ received: true })
  } catch (err) {
    next(err)
  }
})

export default router
