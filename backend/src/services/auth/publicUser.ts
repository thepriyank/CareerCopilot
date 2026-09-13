import { User } from '../../entities/User'
import { resolveEffectivePlan, isPassEligible } from '../plan/resolveEffectivePlan'

/**
 * The subset of a User row every endpoint that returns "the current user"
 * sends back — register/login/google/me, and POST /api/account/activate-pass.
 * `plan` is always the *effective* plan, never the raw column, so nothing
 * downstream needs to know a pass can expire. Requires `settings` and
 * `planExpiresAt` to have been loaded (a partial `select` must include
 * both, or these read as undefined/false).
 */
export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    plan: resolveEffectivePlan(user),
    planExpiresAt: user.planExpiresAt ? user.planExpiresAt.toISOString() : null,
    passEligible: isPassEligible(user),
    passBannerDismissed: Boolean(user.settings?.passBannerDismissed),
    region: user.region,
    createdAt: user.createdAt,
  }
}
