/**
 * Proof that a Razorpay order was created by *this* app for a pass purchase.
 *
 * Razorpay webhooks are account-level: every payment on the merchant account
 * — including ones for other products sharing it (e.g. NowMagnate
 * Innovations) — is delivered to every active webhook endpoint. So the
 * webhook cannot assume "payment.captured" means "a JobMagnate pass". The
 * receipt is the marker: it is set only by POST /api/payments/create-order,
 * server-side, and has the form `pass_<userId>_<timestamp>`. Another
 * product's orders won't carry it, and payment `notes` alone can't stand in
 * for it because notes are free-form and a client can attach its own at
 * Checkout time.
 */

const RECEIPT_PREFIX = 'pass_'

export function buildPassReceipt(userId: string): string {
  return `${RECEIPT_PREFIX}${userId}_${Date.now()}`
}

/** True only for a receipt minted by buildPassReceipt() for exactly this user. */
export function receiptMatchesUser(receipt: unknown, userId: string): boolean {
  if (typeof receipt !== 'string') return false
  const prefix = `${RECEIPT_PREFIX}${userId}_`
  return receipt.startsWith(prefix) && /^\d+$/.test(receipt.slice(prefix.length))
}
