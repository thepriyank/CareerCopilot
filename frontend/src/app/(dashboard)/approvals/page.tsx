'use client'

import { Topbar } from '@/components/layout/Topbar'
import { StatusPill } from '@/components/ui/StatusPill'
import { Icon } from '@/components/ui/Icon'

const APPROVALS = [
  { co: 'Linear',  role: 'Senior Product Designer',     artifacts: [
    { type: 'Resume',       status: 'reviewed' as const, v: 2, ai: 5, edits: 7,  lastEdit: '12m ago' },
    { type: 'Cover letter', status: 'draft' as const,    v: 1, ai: 1, edits: 0,  lastEdit: '12m ago' },
  ]},
  { co: 'Vercel',  role: 'Staff Product Designer',       artifacts: [
    { type: 'Resume',       status: 'approved' as const, v: 3, ai: 4, edits: 12, lastEdit: '1d ago' },
    { type: 'Cover letter', status: 'approved' as const, v: 2, ai: 1, edits: 4,  lastEdit: '1d ago' },
  ]},
  { co: 'Notion',  role: 'Lead Designer, Databases',     artifacts: [
    { type: 'Resume',       status: 'draft' as const,    v: 1, ai: 8, edits: 0,  lastEdit: '2d ago' },
  ]},
  { co: 'Ramp',    role: 'Sr. Product Designer, Card',   artifacts: [
    { type: 'Resume',       status: 'reviewed' as const, v: 2, ai: 6, edits: 3,  lastEdit: '3d ago' },
    { type: 'Cover letter', status: 'reviewed' as const, v: 1, ai: 2, edits: 2,  lastEdit: '3d ago' },
  ]},
]

function DiffLine({ left, right, op = 'edit' }: { left: string; right: string; op?: 'edit' | 'add' }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '14px 1fr', gap: 8, marginBottom: 14, fontSize: 12.5, lineHeight: 1.5 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: op === 'add' ? 'var(--success)' : 'var(--ochre-700)' }} />
        <span style={{ width: 1, flex: 1, background: 'var(--line)' }} />
      </div>
      <div>
        {op !== 'add' && <div className="del" style={{ display: 'block', marginBottom: 4 }}>{left}</div>}
        <div className="ins" style={{ display: 'block' }}>{right}</div>
      </div>
    </div>
  )
}

export default function ApprovalsPage() {
  return (
    <>
      <Topbar
        eyebrow="Review & approval"
        title="Everything waiting on you"
        right={
          <>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>4 jobs · 7 artifacts</div>
            <button className="btn btn-secondary btn-sm"><Icon.Filter size={13} /> Filter</button>
            <button className="btn btn-primary btn-sm">Approve all reviewed</button>
          </>
        }
      />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '260px 1fr 380px', overflow: 'hidden' }}>

        {/* Status filters */}
        <div style={{ borderRight: '1px solid var(--line-2)', padding: 20, background: 'var(--paper)', overflow: 'auto' }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>By status</div>
          {[['All', 7, true], ['Draft', 2, false], ['Reviewed', 3, false], ['Approved', 2, false]].map(([n, c, a]) => (
            <div key={String(n)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 6, background: a ? 'var(--ink-100)' : 'transparent', color: a ? 'var(--ink-900)' : 'var(--text-soft)', fontWeight: a ? 500 : 400, fontSize: 13, marginBottom: 2, cursor: 'pointer' }}>
              <span>{String(n)}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{String(c)}</span>
            </div>
          ))}
          <div className="eyebrow" style={{ marginTop: 22, marginBottom: 12 }}>By artifact</div>
          {[['Resume', 4], ['Cover letter', 3]].map(([n, c]) => (
            <div key={String(n)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', fontSize: 13, color: 'var(--text-soft)' }}>
              <span>{String(n)}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{String(c)}</span>
            </div>
          ))}
          <div style={{ marginTop: 22, padding: 12, background: 'var(--paper-2)', borderRadius: 10, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Approval is the only thing that lets an artifact leave the platform. No auto-apply.
          </div>
        </div>

        {/* List */}
        <div style={{ overflow: 'auto', padding: 24, background: 'var(--paper-2)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {APPROVALS.map((g, gi) => (
              <div key={g.co} className="card" style={{ overflow: 'hidden', borderColor: gi === 0 ? 'var(--ink-700)' : undefined, boxShadow: gi === 0 ? '0 0 0 1px var(--ink-700)' : undefined }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 16 }}>{g.co[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{g.role}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{g.co}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm">Open job</button>
                </div>
                {g.artifacts.map((a, ai) => (
                  <div key={a.type} style={{ padding: '12px 18px', display: 'grid', gridTemplateColumns: '20px 180px 1fr 100px 120px 110px', gap: 14, alignItems: 'center', borderTop: ai > 0 ? '1px solid var(--line-2)' : 'none', background: gi === 0 && ai === 0 ? 'var(--paper-2)' : 'transparent' }}>
                    <input type="checkbox" defaultChecked={a.status === 'reviewed'} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {a.type === 'Resume' ? <Icon.Doc size={14} /> : <Icon.Mail size={14} />}
                      <span style={{ fontSize: 13 }}>{a.type}</span>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>v{a.v}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 14 }}>
                      <span><strong style={{ color: 'var(--text)' }}>{a.ai}</strong> AI edits</span>
                      <span><strong style={{ color: 'var(--text)' }}>{a.edits}</strong> your edits</span>
                      <span>Last · {a.lastEdit}</span>
                    </div>
                    <StatusPill status={a.status} />
                    <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'center' }}><Icon.Eye size={12} /> View diff</button>
                    <button className="btn btn-primary btn-sm" style={{ justifyContent: 'center' }} disabled={a.status === 'approved'}>
                      {a.status === 'approved' ? <><Icon.Check size={12} /> Approved</> : 'Approve'}
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Diff preview */}
        <div style={{ borderLeft: '1px solid var(--line-2)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--paper)' }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="eyebrow">Diff preview</div>
              <div style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>Linear · Resume v2</div>
            </div>
            <StatusPill status="reviewed" />
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            <DiffLine
              left="6+ years of experience designing for high-growth tech companies"
              right="Senior product designer who turns dense developer workflows into calm, fast tools"
            />
            <DiffLine
              left="Improved performance metrics across the dashboard"
              right="Cut TTI by 1.4s on p75 across the dashboard shell"
            />
            <DiffLine
              left="Worked on docs"
              right="Built the keyboard model for developer docs — cut time-to-first-API-call by 22%"
            />
            <DiffLine
              left="—"
              right="Owned the design-system primitives layer across web and macOS"
              op="add"
            />
            <div style={{ marginTop: 14, padding: 12, background: 'var(--ochre-100)', borderRadius: 10 }}>
              <div className="eyebrow" style={{ color: 'var(--ochre-900)' }}>Hallucination check</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 12, color: 'var(--ochre-900)' }}>
                <Icon.Check size={13} /> All claims grounded in master resume v3
              </div>
            </div>
          </div>
          <div style={{ padding: 14, borderTop: '1px solid var(--line-2)', display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" style={{ flex: 1 }}>Reject</button>
            <button className="btn btn-primary btn-sm" style={{ flex: 1.4, justifyContent: 'center' }}>Approve for Linear</button>
          </div>
        </div>

      </div>
    </>
  )
}
