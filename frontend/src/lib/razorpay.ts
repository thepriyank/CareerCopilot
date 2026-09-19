// Loads https://checkout.razorpay.com/v1/checkout.js on demand — only
// PlanTab (Settings → Plan) ever needs it, so this isn't pulled in on every
// page load. Cached so a second call (e.g. clicking "Buy" twice) reuses the
// same in-flight/loaded script instead of injecting it again.
let loadPromise: Promise<void> | null = null

export function loadRazorpayCheckout(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Razorpay Checkout requires a browser'))
  if (window.Razorpay) return Promise.resolve()
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loadPromise = null
      reject(new Error('Could not load Razorpay Checkout'))
    }
    document.body.appendChild(script)
  })
  return loadPromise
}

// Razorpay Checkout's own runtime global — declared loosely here rather
// than pulling in a full @types/razorpay for the handful of fields this
// app actually uses. See https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
export interface RazorpayCheckoutOptions {
  key: string
  amount: number
  currency: string
  order_id: string
  name: string
  description?: string
  handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void
  modal?: { ondismiss?: () => void }
  theme?: { color?: string }
}

interface RazorpayInstance {
  open: () => void
  on: (event: 'payment.failed', handler: (response: { error?: { description?: string } }) => void) => void
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance
  }
}
