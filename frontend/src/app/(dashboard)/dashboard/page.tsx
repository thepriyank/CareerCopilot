'use client'

import { Topbar } from '@/components/layout/Topbar'
import { StatusPill } from '@/components/ui/StatusPill'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { Chip } from '@/components/ui/Chip'
import { Icon } from '@/components/ui/Icon'
import Link from 'next/link'

function Stat({ label, value, delta, trend = 'up' }: { label: string; value: string; delta: string; trend?: 'up' | 'warn' | 'neutral' }) {
  const tone = trend === 'up' ? 'var(--success)' : trend === 'warn' ? 'var(--ochre-900)' : 'var(--text-muted)'
  return (
    <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div className="eyebrow">{label}</div>
      <div>
        <div className="display" style={{ fontSize: 38, lineHeight: 1, marginTop: 8 }}>{value}</div>
        <div style={{ fontSize: 12, color: tone, marginTop: 4, fontWeight: 500 }}>{delta}</div>
      </div>
    </div>
  )
}

const MATCHES = [
  { co: 'Linear',    role: 'Senior Product Designer', loc: 'Remote · $190–230k', score: 87, match: ['Design systems', 'Dev tools'], miss: 'Motion' },
  { co: 'Vercel',    role: 'Staff PD, Platform',      loc: 'SF / Remote',        score: 82, match: ['Docs', 'Workspace'],          miss: 'System design' },
  { co: 'Anthropic', role: 'Product Designer, Claude', loc: 'SF',                score: 64, match: ['Dev tools', 'Workspace'],     miss: 'AI eval' },
]

const ACTIVITY = [
  { who: 'You approved',  what: 'Vercel · Resume v3',             when: 'Just now',  kind: 'approved' },
  { who: 'AI generated',  what: 'Notion · Cover letter draft',    when: '12m ago',   kind: 'ai' },
  { who: 'AI reviewed',   what: 'Linear · Resume tailored',       when: '1h ago',    kind: 'ai' },
  { who: 'You edited',    what: 'Master · Experience section',    when: '3h ago',    kind: 'edit' },
  { who: 'AI suggested',  what: 'Skill goal: System design',      when: 'Yesterday', kind: 'ai' },
]

export default function DashboardPage() {
  return (
    <>
      <Topbar
        eyebrow="Welcome back, Maya"
        title="Wednesday, 21 May"
        right={
          <>
            <button className="btn btn-secondary btn-sm"><Icon.Search size={13} /> Search</button>
            <Link href="/tailoring" className="btn btn-primary btn-sm"><Icon.Plus size={13} /> New tailor</Link>
          </>
        }
      />
      <div style={{ flex: 1, overflow: 'auto', padding: 28, background: 'var(--paper-2)' }}>

        {/* Top strip */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 14, marginBottom: 18 }}>
          <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="eyebrow">Master resume</div>
              <StatusPill status="reviewed" />
            </div>
            <div>
              <div className="serif" style={{ fontSize: 26, marginTop: 4 }}>Maya Kapoor · v3</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>4 AI suggestions waiting for review.</div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
              <Link href="/resume" className="btn btn-primary btn-sm">Open workspace</Link>
              <button className="btn btn-ghost btn-sm">Approve master</button>
            </div>
          </div>
          <Stat label="Matches this week" value="42" delta="+8" trend="up" />
          <Stat label="Pending approval" value="3" delta="2 reviewed" trend="warn" />
          <Stat label="Approval rate" value="86%" delta="+4%" trend="up" />
        </div>

        {/* Middle */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, marginBottom: 18 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div className="eyebrow">Top matches today</div>
                <div className="serif" style={{ fontSize: 18, marginTop: 2 }}>Three I&rsquo;d start with</div>
              </div>
              <Link href="/jobs" className="btn btn-ghost btn-sm">All matches <Icon.ChevronR size={12} /></Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {MATCHES.map(({ co, role, loc, score, match, miss }) => (
                <div key={co} style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto 100px', gap: 14, alignItems: 'center', padding: '10px 6px', borderBottom: '1px solid var(--line-2)' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 7, background: 'var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 15 }}>{co[0]}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{role}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{co} · {loc}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {match.map(s => <Chip key={s} tone="match" icon={<Icon.Check size={10} />}>{s}</Chip>)}
                    <Chip tone="missing">+ {miss}</Chip>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
                    <ScoreRing value={score} size={36} />
                    <Icon.ChevronR size={14} color="var(--text-muted)" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column' }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Recent activity</div>
            {ACTIVITY.map(({ who, what, when, kind }, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: i > 0 ? '1px solid var(--line-2)' : 'none' }}>
                <div style={{ width: 6, height: 6, borderRadius: 999, marginTop: 7, flexShrink: 0,
                  background: kind === 'approved' ? 'var(--success)' : kind === 'ai' ? 'var(--ochre-700)' : 'var(--ink-700)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13 }}><strong style={{ fontWeight: 500 }}>{who}</strong> · {what}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{when}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="card" style={{ padding: 18, display: 'flex', gap: 18, alignItems: 'center' }}>
            <div style={{ width: 80, height: 80, position: 'relative' }}>
              <svg width={80} height={80} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={40} cy={40} r={34} stroke="var(--paper-3)" strokeWidth="6" fill="none" />
                <circle cx={40} cy={40} r={34} stroke="var(--ochre-700)" strokeWidth="6" fill="none"
                  strokeDasharray={214} strokeDashoffset={34} strokeLinecap="round" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 28 }}>84</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="eyebrow">Top skill gap</div>
              <div className="serif" style={{ fontSize: 22, marginTop: 4 }}>System design</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Blocks 7 of your 10 saved roles.</div>
            </div>
            <Link href="/roadmap" className="btn btn-secondary btn-sm">Open roadmap</Link>
          </div>

          <div className="card" style={{ padding: 18, display: 'flex', gap: 18, alignItems: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--ink-100)', color: 'var(--ink-900)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon.LinkedIn size={26} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="eyebrow">LinkedIn review</div>
              <div className="serif" style={{ fontSize: 18, marginTop: 4 }}>Your headline scores 62</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>3 rewrites drafted — pick one to copy.</div>
            </div>
            <Link href="/linkedin" className="btn btn-secondary btn-sm">View feedback</Link>
          </div>
        </div>

      </div>
    </>
  )
}
