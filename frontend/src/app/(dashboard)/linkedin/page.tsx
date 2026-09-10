'use client'

import { useEffect, useRef, useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { StatusPill } from '@/components/ui/StatusPill'
import { AiBadge } from '@/components/ui/AiBadge'
import { Icon } from '@/components/ui/Icon'
import { linkedin as linkedinApi, ApiError } from '@/lib/api'
import type { LinkedInReviewReport, LinkedInSectionKey } from '@/types'

const SECTION_LABELS: Record<LinkedInSectionKey, string> = {
  headline: 'Headline',
  about: 'About',
  experience: 'Experience',
  skills: 'Skills',
}

const FIELD_PLACEHOLDERS: Record<LinkedInSectionKey, string> = {
  headline: 'e.g. Senior Backend Engineer @ Acme · Building payments infra',
  about: "Paste your LinkedIn 'About' section…",
  experience: 'Paste your role titles, companies, and dates…',
  skills: 'Comma-separated skills as they appear on your profile…',
}

export default function LinkedInPage() {
  const [fields, setFields] = useState<Record<LinkedInSectionKey, string>>({
    headline: '', about: '', experience: '', skills: '',
  })
  const [report, setReport] = useState<LinkedInReviewReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [activeSection, setActiveSection] = useState<LinkedInSectionKey>('headline')
  const [selectedRewrite, setSelectedRewrite] = useState(0)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    linkedinApi
      .getReview()
      .then((res) => {
        setReport(res.report)
        if (res.report) {
          const firstSection = (Object.keys(res.report.sections)[0] as LinkedInSectionKey | undefined) ?? 'headline'
          setActiveSection(firstSection)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleUploadPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return

    setExtracting(true)
    setExtractError('')
    try {
      const { extracted } = await linkedinApi.extractPdf(file)
      setFields({
        headline: extracted.headline,
        about: extracted.about,
        experience: extracted.experience,
        skills: extracted.skills,
      })
    } catch (err) {
      setExtractError(err instanceof ApiError ? err.message : 'Could not read this PDF')
    } finally {
      setExtracting(false)
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true)
    setError('')
    try {
      const res = await linkedinApi.review(fields)
      setReport(res.report)
      setSelectedRewrite(0)
      const firstSection = (Object.keys(res.report.sections)[0] as LinkedInSectionKey | undefined) ?? 'headline'
      setActiveSection(firstSection)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not analyze this profile')
    } finally {
      setAnalyzing(false)
    }
  }

  const sectionKeys = report ? (Object.keys(report.sections) as LinkedInSectionKey[]) : []
  const active = report?.sections[activeSection]
  const rewrites = report?.suggestions?.headlineRewrites ?? []
  const hasAnyInput = Object.values(fields).some((v) => v.trim())

  if (loading) {
    return (
      <>
        <Topbar eyebrow="LinkedIn review · MVP · feedback only" title="Your profile, read like a recruiter would" />
        <div style={{ padding: 24 }} className="mono">Loading…</div>
      </>
    )
  }

  return (
    <>
      <Topbar
        eyebrow="LinkedIn review · MVP · feedback only"
        title="Your profile, read like a recruiter would"
        right={
          <>
            {report && <StatusPill status="ai" />}
            <button className="btn btn-secondary btn-sm" onClick={handleAnalyze} disabled={analyzing || !hasAnyInput}>
              {analyzing ? 'Analyzing…' : report ? 'Re-run analysis' : 'Run analysis'}
            </button>
          </>
        }
      />
      <div className="grid-stack-scroll" style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>

        {/* Left: paste your profile */}
        <div style={{ borderRight: '1px solid var(--line-2)', overflow: 'auto', padding: 28, background: 'var(--paper)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="eyebrow">Paste your profile sections</div>
            <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()} disabled={extracting}>
              <Icon.Upload size={12} /> {extracting ? 'Reading PDF…' : 'Upload PDF export'}
            </button>
            <input ref={fileInputRef} type="file" accept="application/pdf" hidden onChange={handleUploadPdf} />
          </div>
          <div style={{ marginBottom: 14, padding: 12, background: 'var(--paper-2)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            On your own LinkedIn profile: <strong>More</strong> → <strong>Save to PDF</strong>. Upload that export here and we&rsquo;ll fill the fields below for you to review — we never fetch a profile URL directly (LinkedIn&rsquo;s terms don&rsquo;t allow that).
          </div>
          {(error || extractError) && <div style={{ marginBottom: 14, padding: 12, background: 'var(--error-bg)', color: 'var(--error)', borderRadius: 8, fontSize: 13 }}>{error || extractError}</div>}
          <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(Object.keys(SECTION_LABELS) as LinkedInSectionKey[]).map((key) => (
              <div key={key}>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.1, marginBottom: 6 }}>{key}</div>
                <textarea
                  value={fields[key]}
                  onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={FIELD_PLACEHOLDERS[key]}
                  rows={key === 'headline' ? 2 : 4}
                  style={{ width: '100%', border: '1px solid var(--line-2)', borderRadius: 8, padding: 10, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: 14, background: 'var(--info-bg)', borderRadius: 10, fontSize: 12.5, color: 'var(--info)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Icon.Bell size={14} />
            <div><strong>MVP scope</strong> — Jobmagnate doesn&rsquo;t post or edit LinkedIn directly. Paste your current profile, review the feedback, and update your profile manually.</div>
          </div>
        </div>

        {/* Right: feedback */}
        <div style={{ overflow: 'auto', padding: 28, background: 'var(--paper-2)' }}>
          {!report ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Paste at least one section and run analysis to see feedback.</div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div className="eyebrow">Feedback · {SECTION_LABELS[activeSection]}</div>
                {active && (
                  <div style={{ width: 64, height: 64, position: 'relative' }}>
                    <svg width={64} height={64} style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx={32} cy={32} r={26} stroke="var(--paper-3)" strokeWidth="5" fill="none" />
                      <circle cx={32} cy={32} r={26} stroke="var(--accent)" strokeWidth="5" fill="none"
                        strokeDasharray={2 * Math.PI * 26} strokeDashoffset={2 * Math.PI * 26 * (1 - active.score / 100)} strokeLinecap="round" />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="display" style={{ fontSize: 20 }}>{active.score}</span>
                      <span className="mono" style={{ fontSize: 8.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.1 }}>strength</span>
                    </div>
                  </div>
                )}
              </div>

              {active && (
                <div className="card" style={{ padding: 18, marginBottom: 14 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Narrative</div>
                  <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-soft)' }}>{active.narrative}</div>
                </div>
              )}

              {rewrites.length > 0 && (
                <div className="card" style={{ padding: 18, marginBottom: 14, borderColor: 'var(--ochre-200)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <AiBadge label={`${rewrites.length} rewrites`} />
                    <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Pick one to copy</span>
                  </div>
                  {rewrites.map((r, i) => (
                    <div
                      key={r.label + i}
                      onClick={() => setSelectedRewrite(i)}
                      style={{ padding: 12, background: selectedRewrite === i ? 'var(--ochre-100)' : 'var(--paper-2)', borderRadius: 8, marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}
                    >
                      <input type="radio" name="rw" checked={selectedRewrite === i} readOnly />
                      <div style={{ flex: 1 }}>
                        <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.08 }}>{r.label}</div>
                        <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.45 }}>{r.text}</div>
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(r.text) }}>Copy</button>
                    </div>
                  ))}
                </div>
              )}

              {sectionKeys.length > 1 && (
                <div style={{ marginTop: 22 }}>
                  <div className="eyebrow" style={{ marginBottom: 10 }}>Other sections</div>
                  <div className="row-stack" style={{ display: 'grid', gridTemplateColumns: `repeat(${sectionKeys.length - 1}, 1fr)`, gap: 10 }}>
                    {sectionKeys.filter((k) => k !== activeSection).map((k) => (
                      <div
                        key={k}
                        onClick={() => setActiveSection(k)}
                        style={{ padding: 12, background: 'var(--paper)', borderRadius: 10, border: '1px solid var(--line)', cursor: 'pointer' }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{SECTION_LABELS[k]}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                          <div className="score-bar" style={{ flex: 1 }}><i style={{ width: report!.sections[k]!.score + '%' }} /></div>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{report!.sections[k]!.score}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
