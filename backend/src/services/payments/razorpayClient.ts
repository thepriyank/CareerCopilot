import Razorpay from 'razorpay'
import { config } from '../../config'

let client: Razorpay | null = null

/**
 * Lazily constructed so a backend with no Razorpay keys configured (local
 * dev without billing set up, or any environment before Phase B secrets are
 * provisioned) can still boot and serve every other route — the same
 * degrade-to-absent pattern as every other optional integration in
 * config/index.ts. Only POST /api/payments/* ever calls this, and only at
 * request time, so an unconfigured key surfaces as a clear 500 on that one
 * route rather than crashing the whole process on startup.
 */
export function getRazorpayClient(): Razorpay {
  if (!config.razorpay.keyId || !config.razorpay.keySecret) {
    throw new Error('Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET unset)')
  }
  if (!client) {
    client = new Razorpay({ key_id: config.razorpay.keyId, key_secret: config.razorpay.keySecret })
  }
  return client
}
