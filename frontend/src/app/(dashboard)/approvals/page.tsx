'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Topbar } from '@/components/layout/Topbar'
import { StatusPill, PillStatus } from '@/components/ui/StatusPill'
import { Icon } from '@/components/ui/Icon'
import { approvals as approvalsApi, ApiError } from '@/lib/api'
import type { ApprovalArtifact, ArtifactStatus } from '@/types'

const STATUS_TO_PILL: Record<ArtifactStatus, PillStatus> = {
  DRAFT: 'draft',
  IN_REVIEW: 'reviewed',
  APPROVED: 'approved',
  REJECTED: 'rejected',
}

const STATUS_FILTERS: { label: string; value: ArtifactStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'In review', value: 'IN_REVIEW' },
  { label: 'Rejected', value: 'REJECTED' },
]

function artifactKey(a: ApprovalArtifact) {
  return `${a.artifactType}:${a.id}`
}

export default function ApprovalsPage() {
  const [artifacts, setArtifacts] = useState<ApprovalArtifact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState<ArtifactStatus | 'ALL'>('ALL')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [actioningKey, setActioningKey] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  function load() {
    setLoading(true)
    approvalsApi
      .list()
      .then((res) => {
        setArtifacts(res.artifacts)
        setSelectedKey((prev) => prev ?? (res.artifacts[0] ? artifactKey(res.artifacts[0]) : null))
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load approvals'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(
    () => (statusFilter === 'ALL' ? artifacts : artifacts.filter((a) => a.status === statusFilter)),
    [artifacts, statusFilter]
  )

  const grouped = useMemo(() => {
    const byJob = new Map<string, { company: string; role: string; artifacts: ApprovalArtifact[] }>()
    for (const a of filtered) {
      const key = a.jobId ?? 'general'
      if (!byJob.has(key)) {
        byJob.set(key, { company: a.jobCompany ?? 'General', role: a.jobTitle ?? 'Master resume', artifacts: [] })
      }
      byJob.get(key)!.artifacts.push(a)
    }
    return [...byJob.values()]
  }, [filtered])

  const selected = artifacts.find((a) => artifactKey(a) === selectedKey) ?? null

  async function handleDecision(a: ApprovalArtifact, decision: 'approve' | 'reject') {
    const key = artifactKey(a)
    setActioningKey(key)
    setActionError('')
    try {
      if (decision === 'approve') {
        await approvalsApi.approve(a.artifactType, a.id)
      } else {
        await approvalsApi.reject(a.artifactType, a.id)
      }
      // Approved artifacts leave the "waiting on you" list; rejected ones stay (still need a decision).
      setArtifacts((prev) =>
        decision === 'approve'
          ? prev.filter((x) => artifactKey(x) !== key)
          : prev.map((x) => (artifactKey(x) === key ? { ...x, status: 'REJECTED' } : x))
      )
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : `Could not ${decision} this artifact`)
    } finally {
      setActioningKey(null)
    }
  }

  const counts: Record<ArtifactStatus | 'ALL', number> = {
    ALL: artifacts.length,
    DRAFT: artifacts.filter((a) => a.status === 'DRAFT').length,
    IN_REVIEW: artifacts.filter((a) => a.status === 'IN_REVIEW').length,
    REJECTED: artifacts.filter((a) => a.status === 'REJECTED').length,
    APPROVED: 0, // never present — approved artifacts leave the "waiting on you" list server-side
  }

  if (loading) {
    return (
      <>
        <Topbar eyebrow="Review & approval" title="Everything waiting on you" />
        <div style={{ padding: 24 }} className="mono">Loading…</div>
      </>
    )
  }

  return (
    <>
      <Topbar
        eyebrow="Review & approval"
        title="Everything waiting on you"
        right={<div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{grouped.length} jobs · {filtered.length} artifacts</div>}
      />
      <div className="grid-stack-scroll" style={{ flex: 1, display: 'grid', gridTemplateColumns: '220px 1fr 360px', overflow: 'hidden' }}>

        {/* Status filters */}
        <div style={{ borderRight: '1px solid var(--line-2)', padding: 20, background: 'var(--paper)', overflow: 'auto' }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>By status</div>
          {STATUS_FILTERS.map((f) => (
            <div
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 6, background: statusFilter === f.value ? 'var(--accent-subtle)' : 'transparent', color: statusFilter === f.value ? 'var(--accent-text)' : 'var(--text-soft)', fontWeight: statusFilter === f.value ? 500 : 400, fontSize: 13, marginBottom: 2, cursor: 'pointer' }}
            >
              <span>{f.label}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{counts[f.value]}</span>
            </div>
          ))}
          <div style={{ marginTop: 22, padding: 12, background: 'var(--paper-2)', borderRadius: 10, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Approval is the only thing that lets an artifact leave the platform. No auto-apply.
          </div>
        </div>

        {/* List */}
        <div style={{ overflow: 'auto', padding: 24, background: 'var(--paper-2)' }}>
          {error && <div style={{ padding: 14, background: 'var(--error-bg)', color: 'var(--error)', borderRadius: 10, marginBottom: 14 }}>{error}</div>}
          {grouped.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing waiting on you right now.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {grouped.map((g) => (
                <div key={g.role + g.company} className="card" style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 16 }}>{g.company[0]}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{g.role}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{g.company}</div>
                    </div>
                    {g.artifacts[0]?.jobId && (
                      <Link href={`/jobs/${g.artifacts[0].jobId}`} className="btn btn-ghost btn-sm">Open job</Link>
                    )}
                  </div>
                  {g.artifacts.map((a, ai) => {
                    const key = artifactKey(a)
                    const busy = actioningKey === key
                    return (
                      <div
                        key={key}
                        onClick={() => setSelectedKey(key)}
                        className="row-stack"
                        style={{ padding: '12px 18px', display: 'grid', gridTemplateColumns: '180px 1fr 100px 110px 110px', gap: 14, alignItems: 'center', borderTop: ai > 0 ? '1px solid var(--line-2)' : 'none', background: selectedKey === key ? 'var(--paper-2)' : 'transparent', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {a.artifactType === 'resume' ? <Icon.Doc size={14} /> : <Icon.Mail size={14} />}
                          <span style={{ fontSize: 13 }}>{a.artifactType === 'resume' ? (a.resumeVersionType === 'TAILORED' ? 'Tailored resume' : 'Master resume') : 'Cover letter'}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.preview || '—'}</div>
                        <StatusPill status={STATUS_TO_PILL[a.status]} />
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ justifyContent: 'center' }}
                          disabled={busy}
                          onClick={(e) => { e.stopPropagation(); handleDecision(a, 'reject') }}
                        >
                          Reject
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ justifyContent: 'center' }}
                          disabled={busy}
                          onClick={(e) => { e.stopPropagation(); handleDecision(a, 'approve') }}
                        >
                          {busy ? 'Working…' : 'Approve'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail preview */}
        <div style={{ borderLeft: '1px solid var(--line-2)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--paper)' }}>
          {selected ? (
            <>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div className="eyebrow">Preview</div>
                  <div style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>{selected.jobCompany ?? 'General'} · {selected.artifactType === 'resume' ? (selected.resumeVersionType === 'TAILORED' ? 'Tailored resume' : 'Master resume') : 'Cover letter'}</div>
                </div>
                <StatusPill status={STATUS_TO_PILL[selected.status]} />
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                {actionError && <div style={{ marginBottom: 12, padding: 10, background: 'var(--error-bg)', color: 'var(--error)', borderRadius: 8, fontSize: 12.5 }}>{actionError}</div>}
                <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-soft)', whiteSpace: 'pre-wrap' }}>{selected.preview || 'No preview available.'}</div>
              </div>
              <div style={{ padding: 14, borderTop: '1px solid var(--line-2)', display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} disabled={actioningKey === selectedKey} onClick={() => handleDecision(selected, 'reject')}>Reject</button>
                <button className="btn btn-primary btn-sm" style={{ flex: 1.4, justifyContent: 'center' }} disabled={actioningKey === selectedKey} onClick={() => handleDecision(selected, 'approve')}>
                  {actioningKey === selectedKey ? 'Working…' : `Approve for ${selected.jobCompany ?? 'General'}`}
                </button>
              </div>
            </>
          ) : (
            <div style={{ padding: 24, fontSize: 13, color: 'var(--text-muted)' }}>Select an artifact to preview it.</div>
          )}
        </div>

      </div>
    </>
  )
}
