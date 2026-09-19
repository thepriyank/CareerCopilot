/**
 * Phase B billing catalog — one-time passes only, no recurring mandates
 * (see docs/monetization_plan.md's "Recurring billing is not a one-liner in
 * India" note). Prices decided 2026-09-19 (replacing the earlier ₹299/₹799
 * placeholders): each tier has a struck-through `listPricePaise` and the
 * `amountPaise` actually charged while the current discount runs — Razorpay
 * only ever sees `amountPaise`, `listPricePaise` is display-only (frontend
 * strikethrough).
 *
 * Deliberately a server-side lookup table, not a client-supplied amount:
 * POST /api/payments/create-order takes a `passType` key and resolves the
 * price here, so a tampered client request can never create an order for
 * less than what a pass actually costs.
 */

export type PassType = 'ONE_MONTH' | 'THREE_MONTH' | 'ANNUAL'

interface PassOption {
  label: string
  months: number
  amountPaise: number
  listPricePaise: number
  recommended?: boolean
}

export const PASS_PRICING: Record<PassType, PassOption> = {
  ONE_MONTH: { label: '1-month pass', months: 1, amountPaise: 39900, listPricePaise: 79900 }, // ₹399, list ₹799
  THREE_MONTH: { label: '3-month pass', months: 3, amountPaise: 99900, listPricePaise: 199900, recommended: true }, // ₹999, list ₹1999
  ANNUAL: { label: 'Annual pass', months: 12, amountPaise: 499900, listPricePaise: 799900 }, // ₹4999, list ₹7999
}

export function isPassType(value: unknown): value is PassType {
  return value === 'ONE_MONTH' || value === 'THREE_MONTH' || value === 'ANNUAL'
}
