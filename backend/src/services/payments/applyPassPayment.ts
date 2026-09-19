import { AppDataSource } from '../../config/dataSource'
import { User } from '../../entities/User'
import { Plan, PlanTier } from '../../entities/enums'
import { PASS_PRICING, PassType } from './passPricing'
import { logger } from '../../utils/logger'

export interface ApplyPassResult {
  planExpiresAt: Date
  alreadyProcessed: boolean
}

/**
 * The single place that actually grants a pass — called from both
 * POST /api/payments/verify (the client-side path: fast, but depends on the
 * browser staying alive after Razorpay Checkout succeeds) and the Razorpay
 * webhook (routes/razorpayWebhook.routes.ts — server-to-server, fires
 * regardless of what the browser does). Both converge here so a payment
 * already applied by one path is a harmless no-op when the other sees it
 * too, via the same `processedPaymentIds` idempotency list used since the
 * client-only version of this flow.
 *
 * Not row-locked: a payment landing on both paths within the same instant
 * (rather than the more typical few-second gap between them) could in
 * theory read-then-write twice before either commits, granting a few extra
 * days. Accepted as a low-severity edge case rather than adding
 * `SELECT ... FOR UPDATE` — matches this project's stated preference for
 * "a single UPDATE" over building entitlement infrastructure (see
 * docs/monetization_plan.md).
 */
export async function applyPassPayment(userId: string, paymentId: string, passType: PassType): Promise<ApplyPassResult> {
  const userRepo = AppDataSource.getRepository(User)
  const user = await userRepo.findOneBy({ id: userId })
  if (!user) throw new Error(`applyPassPayment: user ${userId} not found`)

  const processedPaymentIds = (user.settings.processedPaymentIds as string[] | undefined) ?? []
  if (processedPaymentIds.includes(paymentId)) {
    return { planExpiresAt: user.planExpiresAt!, alreadyProcessed: true }
  }

  const { months } = PASS_PRICING[passType]
  const extendFrom = user.planExpiresAt && user.planExpiresAt.getTime() > Date.now() ? user.planExpiresAt : new Date()
  user.plan = Plan.PREMIUM
  // A real purchase always overwrites activePlanTier, even if the trial (or
  // an earlier pass) was still active — the freshly bought tier is what's
  // now driving the extended expiry, so it's what the UI should show.
  user.activePlanTier = passType as unknown as PlanTier
  user.planExpiresAt = new Date(extendFrom.getTime() + months * 30 * 24 * 60 * 60 * 1000)
  user.settings = { ...user.settings, processedPaymentIds: [...processedPaymentIds, paymentId] }
  await userRepo.save(user)

  logger.info(`applyPassPayment: extended user ${user.id} to ${user.planExpiresAt.toISOString()} (${passType}, payment ${paymentId})`)
  return { planExpiresAt: user.planExpiresAt, alreadyProcessed: false }
}
