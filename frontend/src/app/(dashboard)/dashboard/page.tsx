'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Topbar } from '@/components/layout/Topbar'
import { StatusPill, PillStatus } from '@/components/ui/StatusPill'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { Chip } from '@/components/ui/Chip'
import { Icon } from '@/components/ui/Icon'
import { dashboard as dashboardApi, ApiError } from '@/lib/api'
import type { DashboardData, ArtifactStatus } from '@/types'

const STATUS_TO_PILL: Record<ArtifactStatus, PillStatus> = {
  DRAFT: 'draft',
  IN_REVIEW: 'reviewed',
  APPROVED: 'approved',
  REJECTED: 'rejected',
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function Stat({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div className="eyebrow">{label}</div>
      <div>
        <div className="display" style={{ fontSize: 38, lineHeight: 1, marginTop: 8 }}>{value}</div>
        {delta && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>{delta}</div>}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    dashboardApi
      .get()
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load your dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <>
        <Topbar eyebrow="Welcome back" title="Dashboard" />
        <div style={{ padding: 24 }} className="mono">Loading…</div>
      </>
    )
  }

  if (error || !data) {
    return (
      <>
        <Topbar eyebrow="Welcome back" title="Dashboard" />
        <div style={{ padding: 24, background: 'var(--error-bg)', color: 'var(--error)', margin: 24, borderRadius: 10 }}>
          {error || 'Could not load your dashboard'}
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar
        eyebrow="Welcome back"
        title={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        right={<Link href="/jobs" className="btn btn-primary btn-sm"><Icon.Plus size={13} /> Add a job</Link>}
      />
      <div style={{ flex: 1, overflow: 'auto', padding: 28, background: 'var(--paper-2)' }}>

        {/* Top strip */}
        <div className="grid-stack" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 14, marginBottom: 18 }}>
          <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="eyebrow">Master resume</div>
              {data.masterResume && <StatusPill status={STATUS_TO_PILL[data.masterResume.status]} />}
            </div>
            <div>
              <div className="serif" style={{ fontSize: 26, marginTop: 4 }}>
                {data.masterResume ? 'Master Resume' : 'Not created yet'}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                {data.masterResume ? 'Review AI enhancements and approve your master.' : 'Upload a resume to generate your master resume.'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
              <Link href="/master-resume" className="btn btn-primary btn-sm">✨ Open master resume</Link>
              <Link href="/resume" className="btn btn-ghost btn-sm">My uploads</Link>
            </div>
          </div>
          <Stat label="Matches this week" value={String(data.matchesThisWeek)} />
          <Stat
            label="Pending approval"
            value={String(data.pendingApprovalCount)}
            delta={data.reviewedCount > 0 ? `${data.reviewedCount} reviewed` : undefined}
          />
          <Stat label="Approval rate" value={data.approvalRate === null ? '—' : `${data.approvalRate}%`} />
        </div>

        {/* Middle */}
        <div className="grid-stack" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, marginBottom: 18 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div className="eyebrow">Top matches</div>
                <div className="serif" style={{ fontSize: 18, marginTop: 2 }}>Three I&rsquo;d start with</div>
              </div>
              <Link href="/jobs" className="btn btn-ghost btn-sm">All matches <Icon.ChevronR size={12} /></Link>
            </div>
            {data.topMatches.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>No matches scored yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.topMatches.map((m) => (
                  <Link key={m.jobId} href={`/jobs/${m.jobId}`} className="row-stack" style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto 100px', gap: 14, alignItems: 'center', padding: '10px 6px', borderBottom: '1px solid var(--line-2)', color: 'inherit', textDecoration: 'none' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 7, background: 'var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 15 }}>{(m.company ?? m.title)[0]}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{m.title}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{[m.company, m.location].filter(Boolean).join(' · ')}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {m.matchedSkills.slice(0, 2).map((s) => <Chip key={s} tone="match" icon={<Icon.Check size={10} />}>{s}</Chip>)}
                      {m.missingSkills[0] && <Chip tone="missing">+ {m.missingSkills[0]}</Chip>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
                      <ScoreRing value={m.score} size={36} />
                      <Icon.ChevronR size={14} color="var(--text-muted)" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column' }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Recent activity</div>
            {data.recentActivity.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing yet — activity shows up here as you use Jobmagnate.</div>
            ) : (
              data.recentActivity.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: i > 0 ? '1px solid var(--line-2)' : 'none' }}>
                  <div style={{ width: 6, height: 6, borderRadius: 999, marginTop: 7, flexShrink: 0, background: 'var(--accent)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13 }}>{a.description}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{relativeTime(a.at)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bottom */}
        <div className="grid-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="card" style={{ padding: 18, display: 'flex', gap: 18, alignItems: 'center' }}>
            {data.topSkillGap ? (
              <>
                <div style={{ width: 80, height: 80, position: 'relative' }}>
                  <svg width={80} height={80} style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx={40} cy={40} r={34} stroke="var(--paper-3)" strokeWidth="6" fill="none" />
                    <circle cx={40} cy={40} r={34} stroke="var(--gap)" strokeWidth="6" fill="none"
                      strokeDasharray={2 * Math.PI * 34} strokeDashoffset={2 * Math.PI * 34 * (1 - data.topSkillGap.weight / 100)} strokeLinecap="round" />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 26 }}>{data.topSkillGap.weight}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="eyebrow">Top skill gap</div>
                  <div className="serif" style={{ fontSize: 22, marginTop: 4 }}>{data.topSkillGap.skill}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Missing in {data.topSkillGap.frequency} of your scored {data.topSkillGap.frequency === 1 ? 'job' : 'jobs'}.
                  </div>
                </div>
                <Link href="/roadmap" className="btn btn-secondary btn-sm">Open roadmap</Link>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No skill gaps identified yet — check a job&rsquo;s skill gap first.</div>
            )}
          </div>

          <div className="card" style={{ padding: 18, display: 'flex', gap: 18, alignItems: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--ink-100)', color: 'var(--ink-900)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon.LinkedIn size={26} />
            </div>
            {data.linkedIn ? (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="eyebrow">LinkedIn review</div>
                  <div className="serif" style={{ fontSize: 18, marginTop: 4 }}>
                    {data.linkedIn.overallScore !== null ? `Your profile scores ${data.linkedIn.overallScore}` : 'Review complete'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {data.linkedIn.headlineRewrite ? 'A rewrite is ready — pick one to copy.' : 'Open your review for details.'}
                  </div>
                </div>
                <Link href="/linkedin" className="btn btn-secondary btn-sm">View feedback</Link>
              </>
            ) : (
              <>
                <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text-muted)' }}>No LinkedIn review yet.</div>
                <Link href="/linkedin" className="btn btn-secondary btn-sm">Run a review</Link>
              </>
            )}
          </div>
        </div>

      </div>
    </>
  )
}
