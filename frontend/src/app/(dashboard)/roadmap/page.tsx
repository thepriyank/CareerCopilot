'use client'

import { useEffect, useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Icon } from '@/components/ui/Icon'
import { skillGaps as skillGapsApi, masterResume as masterResumeApi, ApiError } from '@/lib/api'
import type { AggregatedGap } from '@/types'

function courseSearchUrl(skill: string) {
  return `https://www.udemy.com/courses/search/?q=${encodeURIComponent(skill)}`
}

const TIER_LABEL: Record<AggregatedGap['tier'], string> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
}

export default function RoadmapPage() {
  const [gaps, setGaps] = useState<AggregatedGap[]>([])
  const [savedGoals, setSavedGoals] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)
  const [savingGoal, setSavingGoal] = useState<string | null>(null)
  const [markingAchieved, setMarkingAchieved] = useState<string | null>(null)

  async function refreshGaps() {
    const res = await skillGapsApi.list()
    setGaps(res.gaps)
    setSavedGoals(res.savedGoals)
    setSelectedSkill((prev) => (prev && res.gaps.some((g) => g.skill === prev) ? prev : res.gaps[0]?.skill ?? null))
  }

  useEffect(() => {
    refreshGaps()
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load your skill gaps'))
      .finally(() => setLoading(false))
  }, [])

  async function handleMarkGoal(skill: string) {
    setSavingGoal(skill)
    setError('')
    try {
      await skillGapsApi.markGoal(skill)
      setSavedGoals((prev) => [...prev, skill])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this goal')
    } finally {
      setSavingGoal(null)
    }
  }

  // "Achieved" covers a skill learned anywhere — our own course link,
  // something else entirely, or just a resume omission the candidate is
  // now correcting. Either way the fix is the same: it belongs on the
  // master resume, which is also what future match/skill-gap runs read —
  // and the backend excludes anything already there when aggregating this
  // roadmap, so the gap shrinks immediately instead of waiting for every
  // affected job to be rechecked individually.
  async function handleMarkAchieved(skill: string) {
    setMarkingAchieved(skill)
    setError('')
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
      await refreshGaps()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Could not mark this skill as achieved')
    } finally {
      setMarkingAchieved(null)
    }
  }

  const top = gaps.find((g) => g.skill === selectedSkill) ?? gaps[0] ?? null
  const jobCount = top ? top.frequency : 0

  if (loading) {
    return (
      <>
        <Topbar eyebrow="Skill roadmap" title="Close the gap to your target roles" />
        <div style={{ padding: 24 }} className="mono">Loading…</div>
      </>
    )
  }

  return (
    <>
      <Topbar
        eyebrow="Skill roadmap"
        title="Close the gap to your target roles"
        right={<div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Based on <strong style={{ color: 'var(--text)' }}>{gaps.length} identified gaps</strong></div>}
      />
      <div style={{ flex: 1, overflow: 'auto', padding: 28, background: 'var(--paper-2)' }}>
        {error && <div style={{ marginBottom: 16, padding: 14, background: 'var(--error-bg)', color: 'var(--error)', borderRadius: 10 }}>{error}</div>}

        {gaps.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            No skill gaps yet — run a skill-gap check from a job&rsquo;s detail page to start building your roadmap.
          </div>
        ) : (
          <div className="grid-stack" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20 }}>

            {/* Hero gap */}
            {top && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div className="eyebrow">Top gap</div>
                    <div className="serif" style={{ fontSize: 32, marginTop: 4 }}>{top.skill}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                      Missing in {jobCount} of your scored {jobCount === 1 ? 'job' : 'jobs'} · ranked {TIER_LABEL[top.tier]}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 80, height: 80, position: 'relative' }}>
                      <svg width={80} height={80} style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx={40} cy={40} r={34} stroke="var(--paper-3)" strokeWidth="6" fill="none" />
                        <circle cx={40} cy={40} r={34} stroke="var(--gap)" strokeWidth="6" fill="none"
                          strokeDasharray={2 * Math.PI * 34} strokeDashoffset={2 * Math.PI * 34 * (1 - top.weight / 100)} strokeLinecap="round" />
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="display" style={{ fontSize: 26 }}>{top.weight}</span>
                        <span className="mono" style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.1 }}>impact</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={markingAchieved === top.skill}
                        onClick={() => handleMarkAchieved(top.skill)}
                        title="Already have this skill? Add it to your resume and shrink this gap"
                      >
                        <Icon.Check size={12} /> {markingAchieved === top.skill ? 'Updating…' : 'Mark as achieved'}
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={savedGoals.includes(top.skill) || savingGoal === top.skill}
                        onClick={() => handleMarkGoal(top.skill)}
                      >
                        {savedGoals.includes(top.skill) ? 'Saved as goal' : savingGoal === top.skill ? 'Saving…' : 'Mark as goal'}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="eyebrow" style={{ marginTop: 22, marginBottom: 10 }}>Find a course</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                  <div style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.08 }}>Udemy search</div>
                      <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>{top.skill} courses</div>
                    </div>
                    <a href={courseSearchUrl(top.skill)} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                      Open <Icon.ChevronR size={12} />
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* All gaps */}
            <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="eyebrow">All identified gaps</div>
              {gaps.map((g) => (
                <div
                  key={g.skill}
                  onClick={() => setSelectedSkill(g.skill)}
                  className="row-stack"
                  style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 80px 16px', gap: 10, alignItems: 'center', padding: '8px 4px', borderBottom: '1px solid var(--line-2)', cursor: 'pointer', background: selectedSkill === g.skill ? 'var(--paper-2)' : 'transparent', borderRadius: 6 }}
                >
                  <span style={{ fontSize: 13.5 }}>{g.skill}</span>
                  <div className="score-bar"><i style={{ width: g.weight + '%' }} /></div>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.08 }}>{TIER_LABEL[g.tier]}</span>
                  <Icon.ChevronR size={14} color="var(--text-muted)" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
