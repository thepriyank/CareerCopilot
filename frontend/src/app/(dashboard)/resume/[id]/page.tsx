'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { StatusPill } from '@/components/ui/StatusPill'
import { AiBadge } from '@/components/ui/AiBadge'
import { Icon } from '@/components/ui/Icon'
import { resumes as resumesApi } from '@/lib/api'
import type { ExtractedEntities } from '@/types'

export default function ResumeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [parsed, setParsed] = useState<ExtractedEntities | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    resumesApi.get(id)
      .then(data => {
        setParsed(data.parsedResume?.extractedEntities ?? null)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }, [id])

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-2)' }}>
      <div className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>loading resume…</div>
    </div>
  )

  if (error) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-2)' }}>
      <div style={{ padding: 24, background: 'var(--error-bg)', borderRadius: 12, fontSize: 13, color: 'var(--error)', maxWidth: 400 }}>{error}</div>
    </div>
  )

  const contact = parsed?.contact ?? {}
  const name = contact.name ?? 'Your Resume'

  return (
    <>
      <Topbar
        eyebrow="Master resume"
        title={name}
        right={
          <>
            <StatusPill status="reviewed" />
            <button className="btn btn-secondary btn-sm"><Icon.Eye size={13} /> View diff</button>
            <button className="btn btn-primary btn-sm"><Icon.Check size={13} /> Approve master</button>
          </>
        }
      />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '200px 1fr 300px', overflow: 'hidden' }}>

        {/* Outline sidebar */}
        <div style={{ borderRight: '1px solid var(--line-2)', padding: '20px 16px', background: 'var(--paper)', overflow: 'auto' }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Sections</div>
          {['Summary', 'Experience', 'Education', 'Skills'].map((s, i) => (
            <div key={s} style={{ padding: '8px 10px', borderRadius: 6, fontSize: 13, marginBottom: 2, background: i === 0 ? 'var(--ink-100)' : 'transparent', color: i === 0 ? 'var(--ink-900)' : 'var(--text-soft)', cursor: 'pointer' }}>{s}</div>
          ))}
        </div>

        {/* Document canvas */}
        <div style={{ overflow: 'auto', padding: 32, background: 'var(--paper-2)' }}>
          <div className="doc" style={{ maxWidth: 680, margin: '0 auto' }}>
            <h1>{contact.name ?? 'Maya Kapoor'}</h1>
            <div className="meta" style={{ marginTop: 4 }}>
              {[contact.location, contact.email, contact.phone].filter(Boolean).join(' · ')}
            </div>

            {parsed?.summary && (
              <>
                <h2>Summary</h2>
                <p style={{ fontSize: 13, lineHeight: 1.6 }}>{parsed.summary}</p>
              </>
            )}

            {parsed?.experience?.length ? (
              <>
                <h2>Experience</h2>
                {parsed.experience.map((exp, i) => (
                  <div key={i} style={{ marginTop: 12 }}>
                    <h3>{exp.company} <span className="meta" style={{ float: 'right', fontWeight: 400 }}>{exp.startDate} – {exp.endDate ?? 'Present'}</span></h3>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 4 }}>{exp.title}</div>
                    <ul>
                      {exp.bullets.map((b, j) => <li key={j}>{b}</li>)}
                    </ul>
                  </div>
                ))}
              </>
            ) : (
              <>
                <h2>Experience</h2>
                <h3>Stripe — Senior Product Designer <span className="meta" style={{ float: 'right', fontWeight: 400 }}>2022 – Present</span></h3>
                <ul>
                  <li>Led the <span className="ai-edit">workspace-navigation rebuild</span> for Stripe Dashboard.</li>
                  <li><span className="del">Improved performance metrics</span> <span className="ins">Cut TTI by 1.4s on p75 across the dashboard shell.</span></li>
                </ul>
              </>
            )}

            {parsed?.education?.length ? (
              <>
                <h2>Education</h2>
                {parsed.education.map((edu, i) => (
                  <div key={i} style={{ marginTop: 10 }}>
                    <h3>{edu.institution} <span className="meta" style={{ float: 'right', fontWeight: 400 }}>{edu.endDate}</span></h3>
                    <div style={{ fontSize: 12.5 }}>{edu.degree} {edu.field ? `· ${edu.field}` : ''}</div>
                  </div>
                ))}
              </>
            ) : null}

            {parsed?.skills?.length ? (
              <>
                <h2>Skills</h2>
                <div style={{ fontSize: 12.5, lineHeight: 1.7 }}>{parsed.skills.map(s => s.name).join(' · ')}</div>
              </>
            ) : null}
          </div>
        </div>

        {/* AI suggestions */}
        <div style={{ borderLeft: '1px solid var(--line-2)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--paper)' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AiBadge label="3 suggestions" />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ready to review</span>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { section: 'Summary', why: 'Generic opener. Reframed around workspace tooling which appears in 8 of your saved roles.', before: '6+ years of experience designing for high-growth tech companies', after: 'Senior product designer who turns dense developer workflows into calm, fast tools.' },
              { section: 'Stripe · Bullet 2', why: 'Weak impact statement. Added the p75 metric from your Stripe performance review.', before: 'Improved performance metrics across the dashboard', after: 'Cut TTI by 1.4s on p75 across the dashboard shell.' },
              { section: 'Notion · Bullet 1', why: 'Added scope. "~60% of teams" is in your Notion impact doc.', before: 'Designed the database block surface for teams.', after: 'Designed the database block surface used by ~60% of teams during their first week.' },
            ].map((s, i) => (
              <div key={i} className="card" style={{ padding: 14 }}>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.08, marginBottom: 8 }}>{s.section}</div>
                <div className="del" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>{s.before}</div>
                <div className="ins" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>{s.after}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4 }}>{s.why}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>Accept</button>
                  <button className="btn btn-secondary btn-sm">Edit</button>
                  <button className="btn btn-ghost btn-sm">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  )
}
