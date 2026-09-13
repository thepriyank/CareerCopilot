import { Plan } from '../../entities/enums'

// The moment the one-month full-access pass shipped — see
// "Existing users: opt in on next visit" in docs/monetization_plan.md. A
// user created before this instant is offered the pass on their next visit
// (POST /api/account/activate-pass) rather than being auto-granted one;
// anyone created after it already got one on signup. Override via env only
// for tests — this is meant to stay fixed once shipped.
export const PASS_LAUNCH_AT = new Date(process.env.PASS_LAUNCH_AT ?? '2026-09-13T00:00:00.000Z')

export const PASS_DURATION_MS = 30 * 24 * 60 * 60 * 1000

/**
 * The single source of truth for what a user can actually do right now.
 * `User.plan` alone isn't enough once a pass can expire — everything that
 * gates on plan (routes, UI) must call this instead of reading `user.plan`
 * directly. See docs/monetization_plan.md.
 */
export function resolveEffectivePlan(user: { plan: Plan; planExpiresAt: Date | null }): Plan {
  if (user.plan !== Plan.PREMIUM) return Plan.FREE
  if (user.planExpiresAt && user.planExpiresAt.getTime() < Date.now()) return Plan.FREE
  return Plan.PREMIUM
}

/**
 * True only for a pre-existing user who hasn't accepted the pass yet. A
 * user who signed up after PASS_LAUNCH_AT was already auto-granted one at
 * signup (planExpiresAt is never null for them), so this is naturally false
 * for every new signup without checking createdAt against "now."
 */
export function isPassEligible(user: { createdAt: Date | null | undefined; planExpiresAt: Date | null }): boolean {
  if (!user.createdAt) return false
  return user.createdAt.getTime() < PASS_LAUNCH_AT.getTime() && user.planExpiresAt === null
}

/** Whole days left on a pass, floored at 0. Null when there's no expiry to count down. */
export function daysRemaining(planExpiresAt: Date | null): number | null {
  if (!planExpiresAt) return null
  const ms = planExpiresAt.getTime() - Date.now()
  return ms <= 0 ? 0 : Math.ceil(ms / (24 * 60 * 60 * 1000))
}
