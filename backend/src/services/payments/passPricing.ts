/**
 * Phase B billing catalog (2026-09-19) — one-time passes only, no recurring
 * mandates (see docs/monetization_plan.md's "Recurring billing is not a
 * one-liner in India" note). Amounts are placeholders within that doc's
 * stated ₹199–499/month band, not a finalized business decision — adjust
 * these two numbers before taking real payments; nothing else needs to
 * change to reprice.
 *
 * Deliberately a server-side lookup table, not a client-supplied amount:
 * POST /api/payments/create-order takes a `passType` key and resolves the
 * price here, so a tampered client request can never create an order for
 * less than what a pass actually costs.
 */

export type PassType = 'ONE_MONTH' | 'THREE_MONTH'

interface PassOption {
  label: string
  months: number
  amountPaise: number
}

export const PASS_PRICING: Record<PassType, PassOption> = {
  ONE_MONTH: { label: '1-month pass', months: 1, amountPaise: 29900 }, // ₹299
  THREE_MONTH: { label: '3-month pass', months: 3, amountPaise: 79900 }, // ₹799 (~11% off the monthly rate)
}

export function isPassType(value: unknown): value is PassType {
  return value === 'ONE_MONTH' || value === 'THREE_MONTH'
}
