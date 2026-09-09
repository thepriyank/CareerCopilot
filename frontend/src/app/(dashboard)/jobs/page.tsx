'use client'

import { useEffect, useMemo, useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Chip } from '@/components/ui/Chip'
import { Icon } from '@/components/ui/Icon'
import { jobs as jobsApi } from '@/lib/api'
import { ApiError } from '@/lib/api'
import { ExperienceLevel, JobPosting } from '@/types'
import Link from 'next/link'

const TIER_LABEL: Record<ExperienceLevel, string> = {
  intern: 'Intern',
  entry: 'Entry',
  mid: 'Mid',
  senior: 'Senior',
}

interface NewJobForm {
  title: string
  company: string
  location: string
  url: string
  description: string
}

const EMPTY_FORM: NewJobForm = { title: '', company: '', location: '', url: '', description: '' }

export default function JobBoardPage() {
  const [jobList, setJobList] = useState<JobPosting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [sourceFilter, setSourceFilter] = useState<string | null>(null)
  const [tierFilter, setTierFilter] = useState<ExperienceLevel | null>(null)

  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState<NewJobForm>(EMPTY_FORM)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  const [needsMasterResume, setNeedsMasterResume] = useState(false)

  async function fetchJobs() {
    try {
      const res = await jobsApi.list()
      setJobList(res.jobs)
      setNeedsMasterResume(res.needsMasterResume)
      setError('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJobs()
  }, [])

  const sources = useMemo(() => [...new Set(jobList.map((j) => j.source))].sort(), [jobList])
  const tiers = useMemo(
    () => [...new Set(jobList.map((j) => j.experienceLevel).filter((t): t is ExperienceLevel => !!t))],
    [jobList]
  )

  const filtered = jobList.filter(
    (j) => (!sourceFilter || j.source === sourceFilter) && (!tierFilter || j.experienceLevel === tierFilter)
  )

  async function handleAddJob(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.description.trim()) return
    setAdding(true)
    setAddError('')
    try {
      await jobsApi.create({
        title: form.title.trim(),
        company: form.company.trim() || undefined,
        location: form.location.trim() || undefined,
        url: form.url.trim() || undefined,
        description: form.description.trim(),
      })
      setForm(EMPTY_FORM)
      setShowAddForm(false)
      await fetchJobs()
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : 'Could not add this job')
    } finally {
      setAdding(false)
    }
  }

  return (
    <>
      <Topbar
        eyebrow="Job match board"
        title="Your jobs"
        right={
          <>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{filtered.length} job{filtered.length === 1 ? '' : 's'}</div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm((s) => !s)}>
              <Icon.Plus size={13} /> Add job
            </button>
          </>
        }
      />
      <div className="grid-stack-scroll" style={{ flex: 1, display: 'grid', gridTemplateColumns: '240px 1fr', overflow: 'hidden' }}>
        {/* Filters */}
        <div style={{ borderRight: '1px solid var(--line-2)', padding: 20, background: 'var(--paper)', overflow: 'auto' }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Source</div>
          <div
            onClick={() => setSourceFilter(null)}
            style={{ padding: '8px 10px', borderRadius: 6, fontSize: 13, marginBottom: 2, background: !sourceFilter ? 'var(--accent-subtle)' : 'transparent', color: !sourceFilter ? 'var(--accent-text)' : 'var(--text-soft)', fontWeight: !sourceFilter ? 500 : 400, cursor: 'pointer' }}
          >
            All · {jobList.length}
          </div>
          {sources.map((s) => (
            <div
              key={s}
              onClick={() => setSourceFilter(s)}
              style={{ padding: '8px 10px', borderRadius: 6, fontSize: 13, marginBottom: 2, background: sourceFilter === s ? 'var(--accent-subtle)' : 'transparent', color: sourceFilter === s ? 'var(--accent-text)' : 'var(--text-soft)', fontWeight: sourceFilter === s ? 500 : 400, cursor: 'pointer', textTransform: 'capitalize' }}
            >
              {s} · {jobList.filter((j) => j.source === s).length}
            </div>
          ))}

          {tiers.length > 0 && (
            <>
              <div className="eyebrow" style={{ marginTop: 18, marginBottom: 10 }}>Level</div>
              <div
                onClick={() => setTierFilter(null)}
                style={{ padding: '6px 10px', fontSize: 13, marginBottom: 2, color: !tierFilter ? 'var(--accent-text)' : 'var(--text-soft)', fontWeight: !tierFilter ? 500 : 400, cursor: 'pointer' }}
              >
                All levels
              </div>
              {tiers.map((t) => (
                <div
                  key={t}
                  onClick={() => setTierFilter(t)}
                  style={{ padding: '6px 10px', fontSize: 13, color: tierFilter === t ? 'var(--accent-text)' : 'var(--text-soft)', fontWeight: tierFilter === t ? 500 : 400, cursor: 'pointer' }}
                >
                  {TIER_LABEL[t]}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Job grid */}
        <div style={{ overflow: 'auto', padding: 24, background: 'var(--paper-2)' }}>
          {showAddForm && (
            <form onSubmit={handleAddJob} className="card" style={{ padding: 18, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="eyebrow">Paste a job description</div>
                {/* A close affordance that doesn't depend on scrolling
                    past the whole form first — on a phone, the Cancel
                    button below can end up hidden behind the on-screen
                    keyboard once a field is focused. */}
                <button type="button" onClick={() => setShowAddForm(false)} aria-label="Close" style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>
                  <Icon.X size={14} />
                </button>
              </div>
              {addError && <div style={{ fontSize: 12, color: 'var(--error)' }}>{addError}</div>}
              <div className="grid-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input placeholder="Job title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line-2)', fontSize: 13 }} />
                <input placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line-2)', fontSize: 13 }} />
                <input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line-2)', fontSize: 13 }} />
                <input placeholder="Posting URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line-2)', fontSize: 13 }} />
              </div>
              <textarea
                placeholder="Paste the full job description *"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
                style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line-2)', fontSize: 13, minHeight: 120, fontFamily: 'inherit' }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAddForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={adding}>{adding ? 'Adding…' : 'Add job'}</button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</div>
          ) : error ? (
            <div style={{ padding: 14, background: 'var(--error-bg)', borderRadius: 10, fontSize: 13, color: 'var(--error)' }}>{error}</div>
          ) : filtered.length === 0 && needsMasterResume ? (
            <div className="card" style={{ padding: 32, textAlign: 'center' }}>
              <div className="serif" style={{ fontSize: 18, marginBottom: 6 }}>Generate your master résumé first</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                We match new postings to you automatically, twice a day — once your master résumé exists, matched jobs will start appearing here on their own.
              </div>
              <Link href="/resume/upload" className="btn btn-primary btn-sm">
                <Icon.Sparkle size={12} /> Go to résumé
              </Link>
            </div>
          ) : filtered.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center' }}>
              <div className="serif" style={{ fontSize: 18, marginBottom: 6 }}>No matches yet</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                We check for new postings and match them to your résumé automatically, twice a day. You can also paste a specific job description below.
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(true)}>
                <Icon.Plus size={13} /> Add job
              </button>
            </div>
          ) : (
            <div className="grid-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              {filtered.map((job) => (
                <div key={job.id} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 9, background: 'var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 20, flexShrink: 0 }}>
                      {(job.company || job.title)[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{job.company || 'Unknown company'}{job.location ? ` · ${job.location}` : ''}</div>
                      <div className="serif" style={{ fontSize: 17, marginTop: 2 }}>{job.title}</div>
                      {job.salary && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{job.salary}</div>}
                    </div>
                    {job.matchScore != null && (
                      <div
                        className="mono"
                        style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-text)', background: 'var(--accent-subtle)', borderRadius: 999, padding: '4px 9px', flexShrink: 0 }}
                        title="How well this job matches your résumé"
                      >
                        {job.matchScore}% match
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    <Chip tone="ink">{job.source}</Chip>
                    {job.experienceLevel && <Chip tone="default">{TIER_LABEL[job.experienceLevel]}</Chip>}
                    {job.isRemote && <Chip tone="match" icon={<Icon.Check size={10} />}>Remote</Chip>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                    <Link href={`/jobs/${job.id}`} className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                      <Icon.Sparkle size={12} /> View job
                    </Link>
                    {job.url && (
                      <a href={job.url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ justifyContent: 'center' }}>
                        <Icon.Eye size={12} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
