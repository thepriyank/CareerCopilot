'use client'

import { useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { StatusPill } from '@/components/ui/StatusPill'
import { AiBadge } from '@/components/ui/AiBadge'
import { Chip } from '@/components/ui/Chip'
import { Icon } from '@/components/ui/Icon'

type Section = 'headline' | 'about' | 'experience' | 'skills'

const SECTIONS: { key: Section; label: string; score: number; body: string }[] = [
  { key: 'headline', label: 'Headline', score: 62, body: 'Senior Product Designer @ Stripe. Designing tools for builders.' },
  { key: 'about',    label: 'About',    score: 71, body: "I'm a product designer who cares about craft. I've spent the last 6 years working at companies like Stripe and Notion. I love design systems and making things feel calm. Outside of work I cycle and bake bread." },
  { key: 'experience', label: 'Experience', score: 84, body: 'Stripe · Senior Product Designer · 2022–present  ·  Notion · Product Designer · 2019–2022  ·  Asana · Designer · 2017–2019' },
  { key: 'skills', label: 'Skills (37)', score: 58, body: 'Figma · Design systems · Prototyping · Accessibility · User research · UX writing · Information architecture · Design strategy · Workshop facilitation · …' },
]

const REWRITES = [
  { key: 'Calm-but-impact lead',   v: 'Senior Product Designer @ Stripe · Building design systems and workspace tools used by 12k+ developer teams' },
  { key: 'Lead-track signaling',   v: 'Designer-lead in the making · Workspace primitives, design systems, and quantified craft at Stripe (prev. Notion)' },
  { key: 'Outcome-first',          v: 'Cut dev-onboarding time-to-first-API-call by 22% at Stripe · Senior Product Designer focused on design systems' },
]

export default function LinkedInPage() {
  const [activeSection, setActiveSection] = useState<Section>('headline')
  const [selectedRewrite, setSelectedRewrite] = useState(0)
  const active = SECTIONS.find(s => s.key === activeSection)!

  return (
    <>
      <Topbar
        eyebrow="LinkedIn review · MVP · feedback only"
        title="Your profile, read like a recruiter would"
        right={
          <>
            <StatusPill status="ai" />
            <button className="btn btn-secondary btn-sm">Re-run analysis</button>
          </>
        }
      />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>

        {/* Left: parsed profile */}
        <div style={{ borderRight: '1px solid var(--line-2)', overflow: 'auto', padding: 28, background: 'var(--paper)' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Parsed profile</div>
          <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {SECTIONS.map(s => (
              <div
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                style={{ padding: 14, borderRadius: 10, background: activeSection === s.key ? 'var(--ink-100)' : 'var(--paper-2)', border: '1px solid ' + (activeSection === s.key ? 'var(--ink-700)' : 'var(--line-2)'), cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.1 }}>{s.key}</div>
                  {activeSection === s.key && <Icon.ChevronR size={13} />}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.55 }}>{s.body}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: feedback */}
        <div style={{ overflow: 'auto', padding: 28, background: 'var(--paper-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="eyebrow">Feedback · {active.label}</div>
            <div style={{ width: 64, height: 64, position: 'relative' }}>
              <svg width={64} height={64} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={32} cy={32} r={26} stroke="var(--paper-3)" strokeWidth="5" fill="none" />
                <circle cx={32} cy={32} r={26} stroke="var(--ochre-700)" strokeWidth="5" fill="none"
                  strokeDasharray={2 * Math.PI * 26} strokeDashoffset={2 * Math.PI * 26 * (1 - active.score / 100)} strokeLinecap="round" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span className="display" style={{ fontSize: 20 }}>{active.score}</span>
                <span className="mono" style={{ fontSize: 8.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.1 }}>strength</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 18, marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Narrative</div>
                <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-soft)' }}>
                  Strong company anchor (Stripe), but the value claim — <em>&ldquo;Designing tools for builders&rdquo;</em> — is
                  generic. Recruiters scanning for design leads pause on <strong>scope</strong> and <strong>outcome</strong>.
                  Three of your saved roles ask explicitly for system design experience that this headline hides.
                </div>
              </div>
              <div style={{ width: 120, padding: 12, background: 'var(--paper-2)', borderRadius: 10, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                <div className="mono" style={{ textTransform: 'uppercase', letterSpacing: 0.1, marginBottom: 6 }}>Keyword coverage</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
                  <Chip tone="match" icon={<Icon.Check size={10} />}>Stripe</Chip>
                  <Chip tone="missing">Lead</Chip>
                  <Chip tone="missing">Systems</Chip>
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 18, marginBottom: 14, borderColor: 'var(--ochre-200)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <AiBadge label="3 rewrites" />
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Pick one to copy</span>
            </div>
            {REWRITES.map(({ key, v }, i) => (
              <div
                key={key}
                onClick={() => setSelectedRewrite(i)}
                style={{ padding: 12, background: selectedRewrite === i ? 'var(--ochre-100)' : 'var(--paper-2)', borderRadius: 8, marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}
              >
                <input type="radio" name="rw" checked={selectedRewrite === i} readOnly />
                <div style={{ flex: 1 }}>
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.08 }}>{key}</div>
                  <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.45 }}>{v}</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); navigator.clipboard?.writeText(v) }}>Copy</button>
              </div>
            ))}
          </div>

          <div style={{ padding: 14, background: 'var(--info-bg)', borderRadius: 10, fontSize: 12.5, color: 'var(--info)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Icon.Bell size={14} />
            <div><strong>MVP scope</strong> — Copilot doesn&rsquo;t post or edit LinkedIn directly. Copy a rewrite and update your profile manually.</div>
          </div>

          <div style={{ marginTop: 22 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Other sections</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {SECTIONS.filter(s => s.key !== activeSection).map(s => (
                <div
                  key={s.key}
                  onClick={() => setActiveSection(s.key)}
                  style={{ padding: 12, background: 'var(--paper)', borderRadius: 10, border: '1px solid var(--line)', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <div className="score-bar" style={{ flex: 1 }}><i style={{ width: s.score + '%' }} /></div>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
