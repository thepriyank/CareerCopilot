'use client'

import { useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { Chip } from '@/components/ui/Chip'
import { Icon } from '@/components/ui/Icon'
import Link from 'next/link'

const JOBS = [
  { co: 'Linear',    role: 'Senior Product Designer',    loc: 'Remote · US',    salary: '$190–230k', score: 87, match: ['Design systems', 'Figma', 'Prototyping'], miss: ['Motion', 'Native macOS'] },
  { co: 'Vercel',    role: 'Staff PD, Platform',          loc: 'SF / Remote',    salary: '$200–250k', score: 82, match: ['Dev tools', 'Docs', 'Workspace'],         miss: ['System design'] },
  { co: 'Notion',    role: 'Lead Designer, Databases',   loc: 'SF / Remote',    salary: '$180–220k', score: 79, match: ['Notion alum', 'Workspace', 'Figma'],       miss: ['Lead exp.'] },
  { co: 'Ramp',      role: 'Sr. Product Designer, Card', loc: 'NYC',            salary: '$170–210k', score: 74, match: ['Fintech', 'Systems', 'B2B'],               miss: ['Compliance UX'] },
  { co: 'Anthropic', role: 'Product Designer, Claude',   loc: 'SF',             salary: '$190–240k', score: 64, match: ['Dev tools', 'Workspace', 'Figma'],         miss: ['AI eval', 'LLM UX'] },
  { co: 'Figma',     role: 'Senior PD, Community',       loc: 'SF / Remote',    salary: '$160–200k', score: 71, match: ['Figma native', 'Community', 'Docs'],       miss: ['Community mgmt'] },
]

export default function JobBoardPage() {
  const [minScore, setMinScore] = useState(60)

  const filtered = JOBS.filter(j => j.score >= minScore)

  return (
    <>
      <Topbar
        eyebrow="Job match board"
        title="Your matches"
        right={
          <>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{filtered.length} jobs · updated 5m ago</div>
            <button className="btn btn-secondary btn-sm"><Icon.Refresh size={13} /> Refresh</button>
            <button className="btn btn-primary btn-sm"><Icon.Plus size={13} /> Add job</button>
          </>
        }
      />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '240px 1fr', overflow: 'hidden' }}>
        {/* Filters */}
        <div style={{ borderRight: '1px solid var(--line-2)', padding: 20, background: 'var(--paper)', overflow: 'auto' }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Min match score</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <input
              type="range" min={0} max={100} value={minScore}
              onChange={e => setMinScore(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <div className="mono" style={{ fontSize: 13, fontWeight: 600, width: 28, textAlign: 'right' }}>{minScore}</div>
          </div>

          <div className="eyebrow" style={{ marginBottom: 10 }}>Status</div>
          {['All · 6', 'New · 3', 'Saved · 2', 'Tailored · 1'].map((s, i) => (
            <div key={s} style={{ padding: '8px 10px', borderRadius: 6, fontSize: 13, marginBottom: 2, background: i === 0 ? 'var(--ink-100)' : 'transparent', color: i === 0 ? 'var(--ink-900)' : 'var(--text-soft)', fontWeight: i === 0 ? 500 : 400, cursor: 'pointer' }}>{s}</div>
          ))}

          <div className="eyebrow" style={{ marginTop: 18, marginBottom: 10 }}>Role type</div>
          {['Senior IC', 'Lead', 'Staff', 'Principal'].map(r => (
            <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', fontSize: 13, color: 'var(--text-soft)', cursor: 'pointer' }}>
              <input type="checkbox" defaultChecked />
              <span>{r}</span>
            </div>
          ))}
        </div>

        {/* Job grid */}
        <div style={{ overflow: 'auto', padding: 24, background: 'var(--paper-2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            {filtered.map((job, i) => (
              <div key={job.co} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 9, background: 'var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 20, flexShrink: 0 }}>{job.co[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{job.co} · {job.loc}</div>
                    <div className="serif" style={{ fontSize: 17, marginTop: 2 }}>{job.role}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{job.salary}</div>
                  </div>
                  <ScoreRing value={job.score} size={48} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {job.match.slice(0, 3).map(s => <Chip key={s} tone="match" icon={<Icon.Check size={10} />}>{s}</Chip>)}
                  {job.miss.slice(0, 1).map(s => <Chip key={s} tone="missing">+ {s}</Chip>)}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                  <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>View match</button>
                  <Link href="/tailoring" className="btn btn-primary btn-sm" style={{ flex: 1.2, justifyContent: 'center' }}>
                    <Icon.Sparkle size={12} /> Tailor &amp; apply
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
