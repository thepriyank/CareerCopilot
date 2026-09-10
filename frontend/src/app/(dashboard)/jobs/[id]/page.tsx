'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { Chip } from '@/components/ui/Chip'
import { Icon } from '@/components/ui/Icon'
import { jobs as jobsApi, masterResume as masterResumeApi, downloadFile, ApiError } from '@/lib/api'
import type { JobPosting, MatchResult, SkillGapReport, GeneratedCoverLetter, GeneratedResumeVersion } from '@/types'

const FIT_LABEL: Record<string, string> = {
  'remote-ok': 'Remote-friendly',
  'location-match': 'Location matches',
  'location-mismatch': 'Location mismatch',
  'within-range': 'Within your range',
  'below-range': 'Below your range',
  'above-range': 'Above your range',
  unknown: 'Not enough data',
}

function Section({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="eyebrow">{title}</div>
        {action}
      </div>
      {children}
    </div>
  )
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()

  const [job, setJob] = useState<JobPosting | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [matchResult, setMatchResult] = useState<MatchResult | null>(null)
  const [matching, setMatching] = useState(false)
  const [matchError, setMatchError] = useState('')

  const [skillGap, setSkillGap] = useState<{ existing: string[]; supportedByResume: string[]; gaps: string[] } | null>(null)
  const [checkingSkills, setCheckingSkills] = useState(false)
  const [skillError, setSkillError] = useState('')

  const [coverLetter, setCoverLetter] = useState<GeneratedCoverLetter | null>(null)
  const [generatingLetter, setGeneratingLetter] = useState(false)
  const [letterError, setLetterError] = useState('')
  const [downloadingLetterPdf, setDownloadingLetterPdf] = useState(false)

  const [tailoredResume, setTailoredResume] = useState<GeneratedResumeVersion | null>(null)
  const [tailoring, setTailoring] = useState(false)
  const [tailorError, setTailorError] = useState('')
  const [downloadingTailoredPdf, setDownloadingTailoredPdf] = useState(false)

  // Adding a "missing" skill the candidate actually has but forgot to list —
  // see the confirm dialog rendered at the bottom of this component.
  const [skillToAdd, setSkillToAdd] = useState<string | null>(null)
  const [addingSkill, setAddingSkill] = useState(false)
  const [addSkillError, setAddSkillError] = useState('')

  useEffect(() => {
    Promise.all([
      jobsApi.get(id),
      jobsApi.getMatch(id).catch(() => ({ matchResult: null })),
      jobsApi.getSkillGap(id).catch(() => ({ skillGapReport: null, existing: [], supportedByResume: [] })),
      jobsApi.getCoverLetter(id).catch(() => ({ coverLetter: null })),
      jobsApi.getTailoredResume(id).catch(() => ({ tailoredResume: null })),
    ])
      .then(([jobRes, matchRes, skillGapRes, letterRes, tailorRes]) => {
        setJob(jobRes.job)
        setMatchResult(matchRes.matchResult)
        if (skillGapRes.skillGapReport) {
          setSkillGap({
            existing: skillGapRes.existing,
            supportedByResume: skillGapRes.supportedByResume,
            gaps: skillGapRes.skillGapReport.missingSkills,
          })
        }
        setCoverLetter(letterRes.coverLetter)
        setTailoredResume(tailorRes.tailoredResume)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load this job'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleComputeMatch() {
    setMatching(true)
    setMatchError('')
    try {
      const res = await jobsApi.computeMatch(id)
      setMatchResult(res.matchResult)
    } catch (err) {
      setMatchError(err instanceof ApiError ? err.message : 'Could not compute a match score')
    } finally {
      setMatching(false)
    }
  }

  async function handleCheckSkillGap() {
    setCheckingSkills(true)
    setSkillError('')
    try {
      const res = await jobsApi.computeSkillGap(id)
      setSkillGap({ existing: res.existing, supportedByResume: res.supportedByResume, gaps: res.skillGapReport.missingSkills })
    } catch (err) {
      setSkillError(err instanceof ApiError ? err.message : 'Could not check skill gaps')
    } finally {
      setCheckingSkills(false)
    }
  }

  // Adds a skill flagged as "missing" straight onto the candidate's master
  // resume — for when the gap is really just an omission (they have the
  // skill, they just never listed it) rather than a real gap. Re-runs match
  // + skill-gap afterward so this job's own view reflects it immediately.
  async function handleAddSkillToResume(skill: string) {
    setAddingSkill(true)
    setAddSkillError('')
    try {
      const { masterResume } = await masterResumeApi.get()
      if (!masterResume) {
        throw new Error('Could not find your master resume')
      }
      const content = masterResume.content as { skills?: { id: string; name: string }[] }
      const existingSkills = content.skills ?? []
      const alreadyListed = existingSkills.some((s) => s.name.trim().toLowerCase() === skill.trim().toLowerCase())
      if (!alreadyListed) {
        const updatedSkills = [...existingSkills, { id: `skill-${Date.now()}`, name: skill }]
        await masterResumeApi.update(masterResume.id, { content: { ...content, skills: updatedSkills } })
      }
      await Promise.all([handleComputeMatch(), skillGap ? handleCheckSkillGap() : Promise.resolve()])
      setSkillToAdd(null)
    } catch (err) {
      setAddSkillError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Could not add this skill to your resume')
    } finally {
      setAddingSkill(false)
    }
  }

  async function handleGenerateCoverLetter() {
    setGeneratingLetter(true)
    setLetterError('')
    try {
      const res = await jobsApi.generateCoverLetter(id)
      setCoverLetter(res.coverLetter)
    } catch (err) {
      setLetterError(err instanceof ApiError ? err.message : 'Could not generate a cover letter')
    } finally {
      setGeneratingLetter(false)
    }
  }

  async function handleDownloadLetterPdf() {
    setDownloadingLetterPdf(true)
    try {
      await downloadFile(`/api/jobs/${id}/cover-letter/pdf`, 'cover-letter.pdf')
    } catch (err) {
      setLetterError(err instanceof ApiError ? err.message : 'Could not download the PDF')
    } finally {
      setDownloadingLetterPdf(false)
    }
  }

  async function handleGenerateTailoredResume() {
    setTailoring(true)
    setTailorError('')
    try {
      const res = await jobsApi.generateTailoredResume(id)
      setTailoredResume(res.tailoredResume)
    } catch (err) {
      setTailorError(err instanceof ApiError ? err.message : 'Could not tailor the resume')
    } finally {
      setTailoring(false)
    }
  }

  async function handleDownloadTailoredPdf() {
    setDownloadingTailoredPdf(true)
    try {
      await downloadFile(`/api/jobs/${id}/tailor/pdf`, 'tailored-resume.pdf')
    } catch (err) {
      setTailorError(err instanceof ApiError ? err.message : 'Could not download the PDF')
    } finally {
      setDownloadingTailoredPdf(false)
    }
  }

  if (loading) {
    return (
      <>
        <Topbar eyebrow="Job" title="Loading…" />
        <div style={{ padding: 24 }} className="mono">Loading…</div>
      </>
    )
  }

  if (error || !job) {
    return (
      <>
        <Topbar eyebrow="Job" title="Not found" />
        <div style={{ padding: 24, background: 'var(--error-bg)', color: 'var(--error)', margin: 24, borderRadius: 10 }}>
          {error || 'Job not found'}
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar
        eyebrow={`${job.company || 'Unknown company'}${job.location ? ' · ' + job.location : ''}`}
        title={job.title}
        right={job.url ? <a href={job.url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm"><Icon.Eye size={12} /> Original posting</a> : undefined}
      />
      <div className="grid-stack-scroll" style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1.1fr', overflow: 'hidden' }}>
        {/* Left: job description */}
        <div style={{ borderRight: '1px solid var(--line-2)', overflow: 'auto', padding: 24, background: 'var(--paper)' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            <Chip tone="ink">{job.source}</Chip>
            {job.experienceLevel && <Chip>{job.experienceLevel}</Chip>}
            {job.isRemote && <Chip tone="match" icon={<Icon.Check size={10} />}>Remote</Chip>}
          </div>
          {job.salary && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>{job.salary}</div>}
          <div className="eyebrow" style={{ marginBottom: 8 }}>Job description</div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-soft)', whiteSpace: 'pre-wrap' }}>{job.description}</div>
        </div>

        {/* Right: match / skill-gap / cover letter */}
        <div style={{ overflow: 'auto', padding: 24, background: 'var(--paper-2)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Section
            title="Match"
            action={<button className="btn btn-secondary btn-sm" onClick={handleComputeMatch} disabled={matching}><Icon.Sparkle size={12} /> {matching ? 'Scoring…' : matchResult ? 'Recompute' : 'Compute match'}</button>}
          >
            {matchError && <div style={{ fontSize: 12, color: 'var(--error)' }}>{matchError}</div>}
            {matchResult ? (
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <ScoreRing value={matchResult.score} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {matchResult.rationale.matchedSkills.map((s) => <Chip key={s} tone="match" icon={<Icon.Check size={10} />}>{s}</Chip>)}
                    {matchResult.rationale.missingSkills.map((s) => (
                      <Chip key={s} tone="missing" onClick={() => setSkillToAdd(s)} title="Have this skill? Add it to your resume">+ {s}</Chip>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {FIT_LABEL[matchResult.rationale.locationFit]} · {FIT_LABEL[matchResult.rationale.salaryFit]}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Not scored yet. Requires a master resume.</div>
            )}
          </Section>

          <Section
            title="Skill gap"
            action={<button className="btn btn-secondary btn-sm" onClick={handleCheckSkillGap} disabled={checkingSkills}><Icon.Sparkle size={12} /> {checkingSkills ? 'Checking…' : skillGap ? 'Recheck' : 'Check skill gaps'}</button>}
          >
            {skillError && <div style={{ fontSize: 12, color: 'var(--error)' }}>{skillError}</div>}
            {skillGap ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>On your resume</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {skillGap.existing.map((s) => <Chip key={s} tone="match" icon={<Icon.Check size={10} />}>{s}</Chip>)}
                    {skillGap.supportedByResume.map((s) => <Chip key={s} tone="match">{s}</Chip>)}
                    {skillGap.existing.length === 0 && skillGap.supportedByResume.length === 0 && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>None found</span>
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Real gaps</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {skillGap.gaps.length > 0
                      ? skillGap.gaps.map((s) => (
                          <Chip key={s} tone="missing" onClick={() => setSkillToAdd(s)} title="Have this skill? Add it to your resume">+ {s}</Chip>
                        ))
                      : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No gaps found</span>}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Not checked yet. Requires a master resume.</div>
            )}
          </Section>

          <Section
            title="Cover letter"
            action={
              <div style={{ display: 'flex', gap: 6 }}>
                {coverLetter && (
                  <button className="btn btn-ghost btn-sm" onClick={handleDownloadLetterPdf} disabled={downloadingLetterPdf}>
                    <Icon.Doc size={12} /> {downloadingLetterPdf ? 'Preparing…' : 'PDF'}
                  </button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={handleGenerateCoverLetter} disabled={generatingLetter}>
                  <Icon.Sparkle size={12} /> {generatingLetter ? 'Writing…' : coverLetter ? 'Regenerate' : 'Generate cover letter'}
                </button>
              </div>
            }
          >
            {letterError && <div style={{ fontSize: 12, color: 'var(--error)' }}>{letterError}</div>}
            {coverLetter ? (
              <div className="doc" style={{ fontSize: 13, lineHeight: 1.6 }}>
                {coverLetter.content.letter.greeting && <p>{coverLetter.content.letter.greeting}</p>}
                <p>{coverLetter.content.letter.opening}</p>
                <p>{coverLetter.content.letter.profile_intro}</p>
                {coverLetter.content.letter.achievements?.map((a, i) => (
                  <p key={i}><strong>{a.lead}</strong> — {a.impact}</p>
                ))}
                {coverLetter.content.letter.closing && <p>{coverLetter.content.letter.closing}</p>}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No cover letter yet. Requires a master resume.</div>
            )}
          </Section>

          <Section
            title="Tailored resume"
            action={
              <div style={{ display: 'flex', gap: 6 }}>
                {tailoredResume && (
                  <button className="btn btn-ghost btn-sm" onClick={handleDownloadTailoredPdf} disabled={downloadingTailoredPdf}>
                    <Icon.Doc size={12} /> {downloadingTailoredPdf ? 'Preparing…' : 'PDF'}
                  </button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={handleGenerateTailoredResume} disabled={tailoring}>
                  <Icon.Sparkle size={12} /> {tailoring ? 'Tailoring…' : tailoredResume ? 'Re-tailor' : 'Tailor resume'}
                </button>
              </div>
            }
          >
            {tailorError && <div style={{ fontSize: 12, color: 'var(--error)' }}>{tailorError}</div>}
            {tailoredResume ? (
              <div className="doc" style={{ fontSize: 13, lineHeight: 1.6 }}>
                {tailoredResume.content.summary && <p>{tailoredResume.content.summary}</p>}
                {tailoredResume.content.experience.map((exp, i) => (
                  <div key={i} style={{ marginTop: 10 }}>
                    <strong>{exp.title} · {exp.company}</strong>
                    <ul>
                      {exp.bullets.map((b, j) => <li key={j}>{b}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Not tailored yet. Requires a master resume.</div>
            )}
          </Section>
        </div>
      </div>

      {skillToAdd && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'oklch(0.2 0.02 262 / 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}
          onClick={() => !addingSkill && setSkillToAdd(null)}
        >
          <div className="card" style={{ padding: 22, maxWidth: 360, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Missing skill</div>
            <div className="serif" style={{ fontSize: 18, marginBottom: 8 }}>Add &ldquo;{skillToAdd}&rdquo; to your resume?</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
              If you already have this skill and just forgot to list it, adding it here updates your master resume — this job&rsquo;s match and skill gap will refresh right away.
            </div>
            {addSkillError && <div style={{ fontSize: 12, color: 'var(--error)', marginBottom: 12 }}>{addSkillError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSkillToAdd(null)} disabled={addingSkill}>Cancel</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => handleAddSkillToResume(skillToAdd)} disabled={addingSkill}>
                {addingSkill ? 'Adding…' : 'Add to resume'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
