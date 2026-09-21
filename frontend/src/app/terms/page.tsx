import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service — JobMagnate',
  description: 'The terms that govern using JobMagnate and the Assisted Apply browser extension.',
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

// Standalone doc page, same pattern as /privacy — not gated behind auth,
// since Razorpay account activation and anyone evaluating the product both
// need to reach this without signing in first.
export default function TermsOfServicePage() {
  return (
    <div className="app-root" style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '56px 24px 96px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 18, textDecoration: 'none', color: 'var(--text)', marginBottom: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a small static brand asset, not worth next/image's overhead here */}
          <img src="/icons/logo-mark.png" alt="" width={64} height={19} />
          <span className="wordmark">JobMagnate</span>
        </Link>

        <div className="eyebrow" style={{ marginTop: 24, marginBottom: 8 }}>Legal</div>
        <h1 className="display" style={{ fontSize: 36, marginBottom: 8 }}>Terms of Service</h1>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 40 }}>Last updated: {LAST_UPDATED}</div>

        <Section title="Agreement">
          These terms govern your use of JobMagnate — the web app and the Assisted Apply browser extension — both
          published by NowMagnate Innovations. By creating an account or using the extension, you agree to them. If
          you don&rsquo;t agree, don&rsquo;t use the service.
        </Section>

        <Section title="What JobMagnate does">
          <p style={{ marginBottom: 14 }}>JobMagnate parses your résumé, matches you against job postings, and — for
          jobs you choose — drafts tailored résumé versions and cover letters using AI. Everything AI-generated is a
          draft: you review and approve it before it&rsquo;s treated as final, and nothing is submitted to an
          employer without you clicking submit yourself.</p>
          <p>We do not fabricate experience, employers, degrees, or certifications that aren&rsquo;t in your source
          résumé or profile. If you spot AI-generated content that invents something about your background, that&rsquo;s
          a bug — tell us at the contact address below.</p>
        </Section>

        <Section title="Your account">
          <p style={{ marginBottom: 14 }}>You&rsquo;re responsible for the accuracy of what you upload and for
          keeping your login credentials secure. You must be old enough in your jurisdiction to enter into this
          agreement on your own behalf.</p>
          <p>You can delete your account at any time from Settings — see the Privacy Policy for what that removes.</p>
        </Section>

        <Section title="Paid passes">
          <p style={{ marginBottom: 14 }}>Tailored résumé generation, cover letter generation, and unlimited use of
          the Assisted Apply extension are available on a paid pass (1-month, 3-month, or annual), purchased
          one-time through Razorpay. Passes are <strong>not a recurring subscription</strong> — you&rsquo;re charged
          once per purchase, for the duration you bought, and nothing renews automatically.</p>
          <p style={{ marginBottom: 14 }}>Displayed prices may include a limited-time discount off the listed price;
          the price you&rsquo;re charged is the one shown at checkout at the time of purchase.</p>
          <p>See the <Link href="/refund-policy" style={{ color: 'var(--text-soft)', textDecoration: 'underline' }}>Refund Policy</Link> for
          cancellations and refunds.</p>
        </Section>

        <Section title="Acceptable use">
          <p style={{ marginBottom: 14 }}>Don&rsquo;t use JobMagnate to build a résumé or cover letter containing
          information you know to be false, to harass or impersonate anyone, to scrape or resell the service, or to
          attempt to bypass the human-approval step before anything is submitted.</p>
          <p>We may suspend or terminate an account that violates this section.</p>
        </Section>

        <Section title="What we don't do">
          Per the Privacy Policy: we don&rsquo;t sell your data, we don&rsquo;t store third-party credentials
          (LinkedIn, Naukri, Indeed, or any other site) to scrape or auto-apply on your behalf, and we never submit a
          job application or take an irreversible action on your behalf without your explicit review.
        </Section>

        <Section title="Disclaimers">
          <p style={{ marginBottom: 14 }}>JobMagnate helps you prepare applications — it doesn&rsquo;t guarantee you
          an interview, an offer, or any particular outcome. Match scores and AI-drafted content are aids to your
          judgment, not a substitute for it; you&rsquo;re responsible for reviewing everything before it goes out
          under your name.</p>
          <p>The service is provided &ldquo;as is,&rdquo; without warranties of any kind, to the extent permitted by
          law.</p>
        </Section>

        <Section title="Limitation of liability">
          To the extent permitted by law, JobMagnate and NowMagnate Innovations aren&rsquo;t liable for indirect,
          incidental, or consequential damages arising from your use of the service, including a missed job
          opportunity. Our total liability for any claim is limited to the amount you paid us in the 3 months before
          the claim arose.
        </Section>

        <Section title="Changes">
          We&rsquo;ll update this page and the &ldquo;Last updated&rdquo; date above if these terms change. Continued
          use after a change means you accept the updated terms.
        </Section>

        <Section title="Governing law">
          These terms are governed by the laws of India. Any dispute will be subject to the exclusive jurisdiction of
          the courts of India.
        </Section>

        <Section title="Contact">
          Questions about these terms: <a href="mailto:support@jobmagnate.com" style={{ color: 'var(--text-soft)', textDecoration: 'underline' }}>support@jobmagnate.com</a>.
        </Section>
      </div>
    </div>
  )
}
