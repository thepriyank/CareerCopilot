'use client'

import { Topbar } from '@/components/layout/Topbar'
import { Icon } from '@/components/ui/Icon'

function CourseCard({ provider, title, level, hours, rating }: { provider: string; title: string; level: string; hours: string; rating: string }) {
  return (
    <div style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--paper)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--ink-900)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>{provider[0]}</div>
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.08 }}>{provider}</div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, marginTop: 8 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
        <span>{level}</span><span>· {hours}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon.Star size={11} color="var(--ochre-700)" />{rating}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>Open course</button>
        <button className="btn btn-ghost btn-sm">Save</button>
      </div>
    </div>
  )
}

const GAPS = [
  ['System design',  84, 'critical'],
  ['Motion design',  62, 'high'],
  ['Compliance UX',  54, 'medium'],
  ['Data viz',       48, 'medium'],
  ['B2B pricing',    40, 'low'],
  ['Edu content',    32, 'low'],
] as const

const TIMELINE = [
  ['Week 1–2', 'Foundations', 'System design primer · 6h',      'var(--ink-900)'],
  ['Week 3–4', 'Apply',       'Refactor 2 Stripe bullets · self', 'var(--ink-700)'],
  ['Week 5–6', 'Stretch',     'Distributed systems UX · 4w',    'var(--ink-500)'],
  ['Week 7–8', 'Portfolio',   'Public write-up + critique',      'var(--ink-300)'],
]

export default function RoadmapPage() {
  return (
    <>
      <Topbar
        eyebrow="Skill roadmap"
        title="Close the gap to your target roles"
        right={
          <>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Based on <strong style={{ color: 'var(--text)' }}>10 saved jobs</strong></div>
            <button className="btn btn-secondary btn-sm">Switch target set</button>
          </>
        }
      />
      <div style={{ flex: 1, overflow: 'auto', padding: 28, background: 'var(--paper-2)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20, marginBottom: 24 }}>

          {/* Hero gap */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div className="eyebrow">Top gap</div>
                <div className="serif" style={{ fontSize: 32, marginTop: 4 }}>System design</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Mentioned in 7 of 10 target roles · ranked critical for staff+</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 80, height: 80, position: 'relative' }}>
                  <svg width={80} height={80} style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx={40} cy={40} r={34} stroke="var(--paper-3)" strokeWidth="6" fill="none" />
                    <circle cx={40} cy={40} r={34} stroke="var(--ochre-700)" strokeWidth="6" fill="none"
                      strokeDasharray={2 * Math.PI * 34} strokeDashoffset={2 * Math.PI * 34 * 0.16} strokeLinecap="round" />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="display" style={{ fontSize: 26 }}>84</span>
                    <span className="mono" style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.1 }}>impact</span>
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm">Mark as goal</button>
              </div>
            </div>
            <div style={{ marginTop: 20, padding: 14, background: 'var(--paper-2)', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon.Sparkle size={14} color="var(--ochre-900)" /><span className="eyebrow" style={{ color: 'var(--ochre-900)' }}>Why this matters</span></div>
              <div style={{ fontSize: 13, marginTop: 8, lineHeight: 1.55, color: 'var(--text-soft)' }}>
                Linear, Vercel, and Notion all use &ldquo;system design&rdquo; as a senior-IC bar — partnering with engineering on
                rate-limits, data shapes, and platform primitives. Your Stripe role brushes against it; framing two
                bullets around it would unblock 4 of your saved roles.
              </div>
            </div>
            <div className="eyebrow" style={{ marginTop: 22, marginBottom: 10 }}>Recommended courses</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <CourseCard provider="Udemy" title="System Design for Designers" level="Intermediate" hours="6h" rating="4.8" />
              <CourseCard provider="Maven" title="Designing Distributed Systems UX" level="Advanced" hours="4 weeks" rating="4.7" />
            </div>
          </div>

          {/* All gaps */}
          <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="eyebrow">All identified gaps</div>
            {GAPS.map(([n, p, sev]) => (
              <div key={n} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 80px 16px', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line-2)' }}>
                <span style={{ fontSize: 13.5 }}>{n}</span>
                <div className="score-bar"><i style={{ width: p + '%' }} /></div>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.08 }}>{sev}</span>
                <Icon.ChevronR size={14} color="var(--text-muted)" />
              </div>
            ))}
          </div>
        </div>

        {/* Learning path */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div className="eyebrow">Learning path</div>
              <div className="serif" style={{ fontSize: 22, marginTop: 2 }}>An 8-week plan, designed around your job-search calendar</div>
            </div>
            <div style={{ display: 'flex', gap: 6, fontSize: 12 }}>
              <button className="btn btn-ghost btn-sm" style={{ background: 'var(--paper-3)' }}>Timeline</button>
              <button className="btn btn-ghost btn-sm">List</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 24, left: 24, right: 24, height: 2, background: 'var(--line)' }} />
            {TIMELINE.map(([w, h, s, c]) => (
              <div key={w} style={{ position: 'relative', paddingTop: 36 }}>
                <div style={{ position: 'absolute', top: 16, left: 8, width: 16, height: 16, borderRadius: 999, background: String(c), border: '3px solid var(--paper-2)' }} />
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.1 }}>{w}</div>
                <div style={{ fontSize: 16, fontWeight: 500, marginTop: 6 }}>{h}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{s}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
