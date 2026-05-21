import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { Chip } from '@/components/ui/Chip'

const WORKFLOW = [
  { n: '01', h: 'Upload',  desc: 'Drop your resume. We parse and structure everything.' },
  { n: '02', h: 'Match',   desc: 'AI scores you against real job descriptions.' },
  { n: '03', h: 'Tailor',  desc: 'Job-specific resume and cover letter, AI-drafted.' },
  { n: '04', h: 'Approve', desc: 'You review every AI edit before anything is final.' },
  { n: '05', h: 'Upskill', desc: 'We surface the gaps blocking your next role.' },
]

export default function LandingPage() {
  return (
    <div className="app-root" style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      {/* Nav */}
      <nav style={{
        height: 64, display: 'flex', alignItems: 'center',
        padding: '0 48px', borderBottom: '1px solid var(--line)',
        background: 'var(--paper)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-display)', fontSize: 22, flex: 1 }}>
          <i style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--ink-900)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontStyle: 'normal' }}>C</i>
          Copilot
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/login" className="btn btn-ghost btn-sm">Sign in</Link>
          <Link href="/register" className="btn btn-primary btn-sm">Get started free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: '96px 48px 80px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ maxWidth: 760 }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>AI Career Copilot</div>
          <h1 className="display" style={{ fontSize: 72, lineHeight: 1, marginBottom: 24 }}>
            The career copilot<br />that <em style={{ fontStyle: 'italic' }}>shows its work.</em>
          </h1>
          <p style={{ fontSize: 18, color: 'var(--text-soft)', lineHeight: 1.6, maxWidth: 560, marginBottom: 40 }}>
            Upload your resume. We interview, sharpen, match, and draft — with every AI edit
            waiting on your approval.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link href="/register" className="btn btn-primary btn-lg">
              <Icon.Upload size={18} /> Upload resume
            </Link>
            <Link href="/login" className="btn btn-secondary btn-lg">Sign in</Link>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14 }}>
            PDF · DOCX · 10 MB max. Your data never trains models.
          </div>
        </div>
      </section>

      {/* Workflow strip */}
      <section style={{ padding: '0 48px 80px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0 }}>
          {WORKFLOW.map(({ n, h, desc }, i) => (
            <div key={n} style={{ padding: '28px 20px', borderLeft: i > 0 ? '1px solid var(--line-2)' : 'none' }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{n}</div>
              <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>{h}</div>
              <div style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.5 }}>{desc}</div>
              <div style={{ height: 2, background: i === 0 ? 'var(--ink-900)' : 'var(--line)', marginTop: 16 }} />
            </div>
          ))}
        </div>
      </section>

      {/* Product preview */}
      <section style={{ padding: '0 48px 96px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'center' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Match intelligence</div>
            <h2 className="serif" style={{ fontSize: 42, marginBottom: 16 }}>See why you fit — before you apply.</h2>
            <p style={{ fontSize: 15, color: 'var(--text-soft)', lineHeight: 1.65, marginBottom: 24 }}>
              Every job gets a scored breakdown. Matched skills in green, gaps in amber.
              AI explains the fit in plain language — never a black box.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
              <Chip tone="match" icon={<Icon.Check size={11} />}>Design systems</Chip>
              <Chip tone="match" icon={<Icon.Check size={11} />}>Figma</Chip>
              <Chip tone="match" icon={<Icon.Check size={11} />}>Dev tools</Chip>
              <Chip tone="missing">+ Motion design</Chip>
              <Chip tone="missing">+ Native macOS</Chip>
            </div>
          </div>
          <div className="card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 22 }}>L</div>
              <div style={{ flex: 1 }}>
                <div className="serif" style={{ fontSize: 20 }}>Senior Product Designer</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Linear · Remote (US/EU) · $190–230k</div>
              </div>
              <ScoreRing value={87} size={60} />
            </div>
            <div style={{ padding: 14, background: 'var(--ochre-100)', border: '1px solid var(--ochre-200)', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Icon.Sparkle size={14} color="var(--ochre-900)" />
                <span className="eyebrow" style={{ color: 'var(--ochre-900)' }}>Why this is a strong match</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--ochre-900)', lineHeight: 1.55 }}>
                Linear hires designers who love fast, opinionated tools. Your Stripe work on developer
                onboarding and your design-system depth align closely with this role.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 48px', background: 'var(--ink-900)', textAlign: 'center' }}>
        <div className="eyebrow" style={{ color: 'rgba(245,243,238,0.55)', marginBottom: 16 }}>Free to start</div>
        <h2 className="display" style={{ fontSize: 52, color: 'var(--text-onink)', marginBottom: 20 }}>
          Your next role starts here.
        </h2>
        <Link href="/register" className="btn btn-lg" style={{ background: 'var(--ochre-900)', color: '#fff' }}>
          <Icon.Upload size={18} /> Upload your resume
        </Link>
      </section>
    </div>
  )
}
