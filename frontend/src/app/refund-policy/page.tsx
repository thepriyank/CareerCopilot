import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Refund Policy — JobMagnate',
  description: 'When a JobMagnate pass purchase is eligible for a refund, and how to request one.',
}

const LAST_UPDATED = '2026-09-19'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 className="serif" style={{ fontSize: 20, marginBottom: 10 }}>{title}</h2>
      <div style={{ fontSize: 14, color: 'var(--text-soft)', lineHeight: 1.7 }}>{children}</div>
    </section>
  )
}

// Standalone doc page, same pattern as /privacy and /terms.
export default function RefundPolicyPage() {
  return (
    <div className="app-root" style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '56px 24px 96px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 18, textDecoration: 'none', color: 'var(--text)', marginBottom: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a small static brand asset, not worth next/image's overhead here */}
          <img src="/icons/logo-mark.png" alt="" width={64} height={19} />
          <span className="wordmark">JobMagnate</span>
        </Link>

        <div className="eyebrow" style={{ marginTop: 24, marginBottom: 8 }}>Legal</div>
        <h1 className="display" style={{ fontSize: 36, marginBottom: 8 }}>Refund Policy</h1>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 40 }}>Last updated: {LAST_UPDATED}</div>

        <Section title="Overview">
          JobMagnate&rsquo;s paid passes (1-month, 3-month, annual) are one-time purchases, not recurring
          subscriptions — see the <Link href="/terms" style={{ color: 'var(--text-soft)', textDecoration: 'underline' }}>Terms of Service</Link>.
          This page covers when a purchase is eligible for a refund and how to request one.
        </Section>

        <Section title="7-day eligibility window">
          <p style={{ marginBottom: 14 }}>You can request a full refund within <strong>7 days</strong> of purchase,
          provided you haven&rsquo;t used any of the pass&rsquo;s paid features during that pass — specifically,
          generating a tailored résumé, generating a cover letter, or using the Assisted Apply extension beyond the
          free monthly allowance.</p>
          <p>Discovery, matching, skill-gap analysis, LinkedIn review, and application tracking are free for everyone
          regardless of plan, so using those doesn&rsquo;t affect refund eligibility.</p>
        </Section>

        <Section title="What isn't refundable">
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            <li style={{ marginBottom: 6 }}>Requests made more than 7 days after purchase.</li>
            <li style={{ marginBottom: 6 }}>A pass where a paid feature (tailored résumé, cover letter, or extension use beyond the free allowance) has already been used.</li>
            <li>Partial refunds for unused time on a pass you&rsquo;ve otherwise used — a pass is refundable in full within the window above, or not at all after it.</li>
          </ul>
        </Section>

        <Section title="How to request one">
          <p style={{ marginBottom: 14 }}>Email <a href="mailto:support@jobmagnate.com" style={{ color: 'var(--text-soft)', textDecoration: 'underline' }}>support@jobmagnate.com</a> from
          the email address on your account, with the approximate purchase date. We&rsquo;ll confirm eligibility and
          process approved refunds to your original payment method via Razorpay within 5–7 business days.</p>
          <p>If a payment was deducted but you never received your pass (for example, a network issue right after
          paying), contact us with the payment details you have — this is investigated and corrected outside the
          window above, since it&rsquo;s a delivery failure, not a change of mind.</p>
        </Section>

        <Section title="Changes">
          We&rsquo;ll update this page and the &ldquo;Last updated&rdquo; date above if this policy changes. A
          purchase is governed by the policy in effect on the date you bought your pass.
        </Section>

        <Section title="Contact">
          Questions about a refund: <a href="mailto:support@jobmagnate.com" style={{ color: 'var(--text-soft)', textDecoration: 'underline' }}>support@jobmagnate.com</a>.
        </Section>
      </div>
    </div>
  )
}
