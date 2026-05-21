'use client'

import { useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { StatusPill } from '@/components/ui/StatusPill'
import { Chip } from '@/components/ui/Chip'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { AiBadge } from '@/components/ui/AiBadge'
import { Icon } from '@/components/ui/Icon'

function Tab({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{
      padding: '10px 14px', fontSize: 13.5, fontWeight: active ? 500 : 400,
      color: active ? 'var(--text)' : 'var(--text-muted)',
      borderBottom: '2px solid ' + (active ? 'var(--ink-900)' : 'transparent'),
      marginBottom: -1, cursor: 'pointer', display: 'flex', alignItems: 'center',
    }}>
      {children}
    </div>
  )
}

const TABS = ['Tailored resume', 'Cover letter', 'Application notes'] as const
type TabName = typeof TABS[number]

export default function TailoringPage() {
  const [activeTab, setActiveTab] = useState<TabName>('Tailored resume')

  return (
    <>
      <Topbar
        eyebrow="Tailoring · Linear"
        title="Senior Product Designer"
        right={
          <>
            <StatusPill status="draft" />
            <button className="btn btn-secondary btn-sm"><Icon.Refresh size={13} /> Regenerate</button>
            <button className="btn btn-primary btn-sm">Approve for this job</button>
          </>
        }
      />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1.15fr', overflow: 'hidden' }}>

        {/* Left: JD + match */}
        <div style={{ borderRight: '1px solid var(--line-2)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--paper)' }}>
          <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid var(--line-2)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 22 }}>L</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Linear · linear.app · posted 2 days ago</div>
                <div className="serif" style={{ fontSize: 24, marginTop: 2 }}>Senior Product Designer</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>Remote (US/EU) · $190–230k base + equity</div>
              </div>
              <ScoreRing value={87} />
            </div>
            <div style={{ marginTop: 14, padding: 14, background: 'var(--ochre-100)', border: '1px solid var(--ochre-200)', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon.Sparkle size={14} color="var(--ochre-900)" />
                <div className="eyebrow" style={{ color: 'var(--ochre-900)' }}>Why this is a strong match</div>
              </div>
              <div style={{ fontSize: 13, marginTop: 8, color: 'var(--ochre-900)', lineHeight: 1.55 }}>
                Linear hires designers who love <strong>fast, opinionated tools</strong>. Your Stripe work on developer
                onboarding and your design-system depth at Notion both align. Your <em>quantified bullets</em> (TTI,
                adoption numbers) are exactly the proof Linear&rsquo;s hiring designers tend to ask for.
              </div>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '16px 28px 28px' }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Skill alignment</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
              <div style={{ padding: 12, background: 'var(--sage-100)', borderRadius: 10, border: '1px solid var(--sage-200)' }}>
                <div className="eyebrow" style={{ color: 'var(--sage-900)' }}>Matched · 9</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                  {['Design systems', 'Figma', 'Prototyping', 'Dev tools', 'Documentation', 'Workspace UX', 'Accessibility', 'Cross-pod', 'Quant work'].map(s => (
                    <Chip key={s} tone="match" icon={<Icon.Check size={10} />}>{s}</Chip>
                  ))}
                </div>
              </div>
              <div style={{ padding: 12, background: 'var(--ochre-100)', borderRadius: 10, border: '1px solid var(--ochre-200)' }}>
                <div className="eyebrow" style={{ color: 'var(--ochre-900)' }}>Gaps · 2</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                  <Chip tone="missing">+ Motion design</Chip>
                  <Chip tone="missing">+ Native macOS chrome</Chip>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ochre-900)', marginTop: 8, lineHeight: 1.4 }}>I&rsquo;ll de-emphasise these in the tailored resume and propose courses in your roadmap.</div>
              </div>
            </div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Job description</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-soft)' }}>
              We&rsquo;re hiring a senior product designer to lead the next generation of{' '}
              <mark style={{ background: 'var(--sage-100)', color: 'inherit', padding: '0 2px' }}>Linear&rsquo;s design system</mark>{' '}
              and core workspace primitives. You&rsquo;ll partner with engineering on{' '}
              <mark style={{ background: 'var(--sage-100)', color: 'inherit', padding: '0 2px' }}>workspace navigation</mark>,
              the keyboard model, and developer-facing surfaces. We value{' '}
              <mark style={{ background: 'var(--sage-100)', color: 'inherit', padding: '0 2px' }}>quantified impact</mark>{' '}
              and craft. Experience shipping{' '}
              <mark style={{ background: 'var(--ochre-100)', color: 'inherit', padding: '0 2px' }}>fluid motion</mark>{' '}
              is a strong plus.
            </div>
            <div style={{ marginTop: 16, padding: 12, background: 'var(--paper-2)', borderRadius: 10, fontSize: 12, color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text-soft)' }}>Highlighting key:</strong>{' '}
              <span style={{ background: 'var(--sage-100)', padding: '0 4px', borderRadius: 3 }}>matched in your resume</span> ·{' '}
              <span style={{ background: 'var(--ochre-100)', padding: '0 4px', borderRadius: 3 }}>gap area</span>
            </div>
          </div>
        </div>

        {/* Right: tabbed editor */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--paper-2)' }}>
          <div style={{ display: 'flex', padding: '16px 24px 0', gap: 8, borderBottom: '1px solid var(--line-2)' }}>
            <Tab active={activeTab === 'Tailored resume'} onClick={() => setActiveTab('Tailored resume')}>
              Tailored resume <span className="pill pill-ai" style={{ marginLeft: 6 }}>AI</span>
            </Tab>
            <Tab active={activeTab === 'Cover letter'} onClick={() => setActiveTab('Cover letter')}>
              Cover letter <span className="pill pill-draft" style={{ marginLeft: 6 }}>Draft</span>
            </Tab>
            <Tab active={activeTab === 'Application notes'} onClick={() => setActiveTab('Application notes')}>
              Application notes
            </Tab>
            <div style={{ flex: 1 }} />
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'center' }}><Icon.Eye size={13} /> Compare with master</button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
            <div className="doc" style={{ maxWidth: 600, margin: '0 auto' }}>
              <h1>Maya Kapoor</h1>
              <div className="meta">Senior Product Designer · San Francisco · maya@kapoor.studio</div>
              <h2>Summary</h2>
              <p>
                <span className="ai-edit">Senior product designer who turns dense developer workflows into calm, fast tools.</span> Six
                years at Stripe and Notion, with a focus on <span className="ai-edit">design systems, workspace primitives, and quantified impact</span>.
              </p>
              <h2>Selected experience</h2>
              <h3>Stripe — Senior Product Designer <span className="meta" style={{ float: 'right', fontWeight: 400 }}>2022 – Present</span></h3>
              <ul>
                <li>Led the <span className="ai-edit">workspace-navigation rebuild</span> for Stripe Dashboard, used by 12k merchants in their first 30 days.</li>
                <li><span className="ai-edit">Built the keyboard model</span> for developer docs — cut time-to-first-API-call by 22%.</li>
                <li>Cut TTI by 1.4s on p75 across the dashboard shell.</li>
              </ul>
              <h3>Notion — Product Designer <span className="meta" style={{ float: 'right', fontWeight: 400 }}>2019 – 2022</span></h3>
              <ul>
                <li>Designed the database block surface used by ~60% of teams during their first week.</li>
                <li><span className="ai-edit">Owned the design-system primitives layer</span> across web and macOS.</li>
              </ul>
            </div>
            <div style={{ maxWidth: 600, margin: '16px auto 0', padding: 14, background: '#fff', border: '1px dashed var(--ochre-500)', borderRadius: 10, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <Icon.Sparkle size={16} color="var(--ochre-900)" />
              <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-soft)' }}>
                <strong style={{ color: 'var(--ochre-900)' }}>3 changes vs your master resume.</strong>{' '}
                Reframed your Stripe lead role around <em>workspace navigation</em> + <em>keyboard model</em> to match Linear&rsquo;s JD. No new facts introduced.
              </div>
              <button className="btn btn-secondary btn-sm">See full diff</button>
            </div>
          </div>
          <div style={{ padding: '12px 24px', borderTop: '1px solid var(--line)', background: 'var(--paper)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              <span className="mono">v2</span>
              <span>·</span>
              <span>auto-saved 11s ago</span>
            </div>
            <div style={{ flex: 1 }} />
            <button className="btn btn-ghost btn-sm">Revert to master</button>
            <button className="btn btn-ai btn-sm"><Icon.Sparkle size={13} /> Regenerate this section</button>
            <button className="btn btn-primary btn-sm">Approve for Linear</button>
          </div>
        </div>
      </div>
    </>
  )
}
