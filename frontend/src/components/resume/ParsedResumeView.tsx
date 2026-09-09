'use client'

import { useState } from 'react'
import { ParsedResume, ExtractedEntities, ConfidenceScores, WorkExperience, Education, Skill, Project, Certification } from '@/types'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { resumes as resumesApi } from '@/lib/api'

interface ParsedResumeViewProps {
  parsedResume: ParsedResume
  onUpdate?: (updated: ParsedResume) => void
}

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const cls =
    score >= 0.8
      ? 'bg-green-100 text-green-800'
      : score >= 0.5
        ? 'bg-amber-100 text-amber-800'
        : 'bg-red-100 text-red-800'
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {pct}% confidence
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        {title}
      </h3>
      {children}
    </section>
  )
}

export default function ParsedResumeView({ parsedResume, onUpdate }: ParsedResumeViewProps) {
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  
  const [entities, setEntities] = useState<ExtractedEntities>(parsedResume.extractedEntities as ExtractedEntities)

  const scores = parsedResume.confidenceScores as ConfidenceScores

  if (parsedResume.status === 'PROCESSING') {
    return (
      <div className="text-center py-12 text-slate-500">
        <div className="text-4xl mb-3">⚙️</div>
        <p>Parsing your resume…</p>
      </div>
    )
  }

  if (parsedResume.status === 'FAILED' || parsedResume.status === 'REVIEW_NEEDED') {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">{parsedResume.status === 'FAILED' ? '❌' : '⚠️'}</div>
        <p className="text-slate-700 font-medium mb-2">
          {parsedResume.status === 'FAILED'
            ? 'Parsing failed'
            : 'Could not extract text from this file'}
        </p>
        <p className="text-sm text-slate-500">
          This may be an image-based PDF. Please upload a text-based PDF or DOCX.
        </p>
      </div>
    )
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      const result = await resumesApi.updateParsed(parsedResume.id, {
        extractedEntities: entities,
      })
      onUpdate?.(result.parsedResume)
      setSaveMsg('Saved!')
      setIsEditing(false)
    } catch {
      setSaveMsg('Save failed.')
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(''), 3000)
    }
  }

  const handleCancel = () => {
    setEntities(parsedResume.extractedEntities as ExtractedEntities)
    setIsEditing(false)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {entities.contact?.name ?? 'Parsed Resume'}
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <ConfidenceBadge score={scores.overall ?? 0} />
            <span className="text-xs text-slate-400">
              {parsedResume.updatedAt
                ? new Date(parsedResume.updatedAt).toLocaleDateString()
                : ''}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saveMsg && <span className="text-sm text-green-600">{saveMsg}</span>}
          {isEditing ? (
            <>
              <Button size="sm" onClick={handleCancel} variant="ghost">
                Cancel
              </Button>
              <Button size="sm" loading={saving} onClick={handleSave} variant="primary">
                Save changes
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => setIsEditing(true)} variant="outline">
              Edit Resume
            </Button>
          )}
        </div>
      </div>

      {/* Contact info */}
      <Card title="Contact Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {['name', 'email', 'phone', 'location', 'linkedin', 'website'].map((field) => (
            <div key={field}>
              <label className="block text-slate-500 font-medium capitalize mb-1">{field}</label>
              {isEditing ? (
                <input
                  type="text"
                  className="w-full border-slate-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm p-2 border"
                  value={entities.contact?.[field as keyof typeof entities.contact] || ''}
                  onChange={(e) => setEntities({
                    ...entities,
                    contact: { ...entities.contact, [field]: e.target.value }
                  })}
                />
              ) : (
                <div className="text-slate-900 break-all py-2">{entities.contact?.[field as keyof typeof entities.contact] || '-'}</div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Summary */}
      <Card title="Summary">
        {isEditing ? (
          <textarea
            className="w-full border-slate-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm p-2 border min-h-[100px]"
            value={entities.summary || ''}
            onChange={(e) => setEntities({ ...entities, summary: e.target.value })}
          />
        ) : (
          <p className="text-sm text-slate-700 leading-relaxed">{entities.summary || '-'}</p>
        )}
      </Card>

      {/* Experience */}
      <Card title="Work Experience">
        <div className="space-y-6">
          {(entities.experience as WorkExperience[]).map((exp, expIdx) => (
            <div key={exp.id || expIdx} className="border-l-2 border-primary-200 pl-4 relative">
              {isEditing && (
                <button
                  className="absolute top-0 right-0 text-red-500 text-xs font-semibold"
                  onClick={() => {
                    const newExp = [...entities.experience]
                    newExp.splice(expIdx, 1)
                    setEntities({ ...entities, experience: newExp })
                  }}
                >
                  Remove
                </button>
              )}
              <div className="flex items-start justify-between">
                <div className="w-full max-w-lg space-y-2">
                  {isEditing ? (
                    <>
                      <input
                        className="w-full font-semibold text-slate-900 text-sm border p-1 rounded"
                        value={exp.title || ''}
                        placeholder="Job Title"
                        onChange={(e) => {
                          const newExp = [...entities.experience]
                          newExp[expIdx] = { ...newExp[expIdx], title: e.target.value }
                          setEntities({ ...entities, experience: newExp })
                        }}
                      />
                      <input
                        className="w-full text-slate-600 text-sm border p-1 rounded"
                        value={exp.company || ''}
                        placeholder="Company"
                        onChange={(e) => {
                          const newExp = [...entities.experience]
                          newExp[expIdx] = { ...newExp[expIdx], company: e.target.value }
                          setEntities({ ...entities, experience: newExp })
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-slate-900 text-sm">{exp.title}</p>
                      <p className="text-slate-600 text-sm">{exp.company}</p>
                    </>
                  )}
                </div>
                <div className="text-xs text-slate-400 shrink-0 ml-4 flex flex-col gap-1 items-end">
                  {isEditing ? (
                    <>
                      <input
                        className="w-24 border p-1 rounded"
                        placeholder="Start Date"
                        value={exp.startDate || ''}
                        onChange={(e) => {
                          const newExp = [...entities.experience]
                          newExp[expIdx] = { ...newExp[expIdx], startDate: e.target.value }
                          setEntities({ ...entities, experience: newExp })
                        }}
                      />
                      <input
                        className="w-24 border p-1 rounded"
                        placeholder="End Date"
                        value={exp.endDate || ''}
                        onChange={(e) => {
                          const newExp = [...entities.experience]
                          newExp[expIdx] = { ...newExp[expIdx], endDate: e.target.value }
                          setEntities({ ...entities, experience: newExp })
                        }}
                      />
                    </>
                  ) : (
                    <span>{exp.startDate} – {exp.endDate ?? (exp.current ? 'Present' : '')}</span>
                  )}
                </div>
              </div>
              
              {isEditing ? (
                <div className="mt-2 w-full max-w-lg">
                  <input
                    className="w-full text-xs text-slate-400 border p-1 rounded"
                    placeholder="Location"
                    value={exp.location || ''}
                    onChange={(e) => {
                      const newExp = [...entities.experience]
                      newExp[expIdx] = { ...newExp[expIdx], location: e.target.value }
                      setEntities({ ...entities, experience: newExp })
                    }}
                  />
                </div>
              ) : (
                exp.location && <p className="text-xs text-slate-400 mt-0.5">{exp.location}</p>
              )}

              {isEditing ? (
                <textarea
                  className="mt-2 w-full text-sm text-slate-700 border p-2 rounded min-h-[100px]"
                  placeholder="Bullets (one per line)"
                  value={(exp.bullets || []).join('\n')}
                  onChange={(e) => {
                    const newExp = [...entities.experience]
                    newExp[expIdx] = { ...newExp[expIdx], bullets: e.target.value.split('\n') }
                    setEntities({ ...entities, experience: newExp })
                  }}
                />
              ) : (
                exp.bullets?.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {exp.bullets.filter(b => b.trim() !== '').map((b, i) => (
                      <li key={i} className="text-sm text-slate-700 flex gap-2">
                        <span className="text-slate-400 shrink-0">•</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </div>
          ))}
          {isEditing && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEntities({
                  ...entities,
                  experience: [...entities.experience, { id: Date.now().toString(), title: '', company: '', bullets: [] }]
                })
              }}
            >
              + Add Experience
            </Button>
          )}
        </div>
      </Card>

      {/* Education */}
      <Card title="Education">
        <div className="space-y-4">
          {(entities.education as Education[]).map((edu, eduIdx) => (
            <div key={edu.id || eduIdx} className="relative">
              {isEditing && (
                <button
                  className="absolute top-0 right-0 text-red-500 text-xs font-semibold"
                  onClick={() => {
                    const newEdu = [...entities.education]
                    newEdu.splice(eduIdx, 1)
                    setEntities({ ...entities, education: newEdu })
                  }}
                >
                  Remove
                </button>
              )}
              {isEditing ? (
                <div className="space-y-2 max-w-lg">
                  <input
                    className="w-full font-semibold text-slate-900 text-sm border p-1 rounded"
                    value={edu.institution || ''}
                    placeholder="Institution"
                    onChange={(e) => {
                      const newEdu = [...entities.education]
                      newEdu[eduIdx] = { ...newEdu[eduIdx], institution: e.target.value }
                      setEntities({ ...entities, education: newEdu })
                    }}
                  />
                  <div className="flex gap-2">
                    <input
                      className="w-1/2 text-slate-600 text-sm border p-1 rounded"
                      value={edu.degree || ''}
                      placeholder="Degree"
                      onChange={(e) => {
                        const newEdu = [...entities.education]
                        newEdu[eduIdx] = { ...newEdu[eduIdx], degree: e.target.value }
                        setEntities({ ...entities, education: newEdu })
                      }}
                    />
                    <input
                      className="w-1/2 text-slate-600 text-sm border p-1 rounded"
                      value={edu.field || ''}
                      placeholder="Field of Study"
                      onChange={(e) => {
                        const newEdu = [...entities.education]
                        newEdu[eduIdx] = { ...newEdu[eduIdx], field: e.target.value }
                        setEntities({ ...entities, education: newEdu })
                      }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      className="w-1/3 text-xs text-slate-400 border p-1 rounded"
                      placeholder="Start Date"
                      value={edu.startDate || ''}
                      onChange={(e) => {
                        const newEdu = [...entities.education]
                        newEdu[eduIdx] = { ...newEdu[eduIdx], startDate: e.target.value }
                        setEntities({ ...entities, education: newEdu })
                      }}
                    />
                    <input
                      className="w-1/3 text-xs text-slate-400 border p-1 rounded"
                      placeholder="End Date"
                      value={edu.endDate || ''}
                      onChange={(e) => {
                        const newEdu = [...entities.education]
                        newEdu[eduIdx] = { ...newEdu[eduIdx], endDate: e.target.value }
                        setEntities({ ...entities, education: newEdu })
                      }}
                    />
                    <input
                      className="w-1/3 text-xs text-slate-500 border p-1 rounded"
                      placeholder="GPA"
                      value={edu.gpa || ''}
                      onChange={(e) => {
                        const newEdu = [...entities.education]
                        newEdu[eduIdx] = { ...newEdu[eduIdx], gpa: e.target.value }
                        setEntities({ ...entities, education: newEdu })
                      }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <p className="font-semibold text-slate-900 text-sm">{edu.institution}</p>
                  <p className="text-slate-600 text-sm">
                    {[edu.degree, edu.field].filter(Boolean).join(', ')}
                  </p>
                  {(edu.startDate || edu.endDate) && (
                    <p className="text-xs text-slate-400">
                      {edu.startDate} – {edu.endDate}
                    </p>
                  )}
                  {edu.gpa && <p className="text-xs text-slate-500">GPA: {edu.gpa}</p>}
                </>
              )}
            </div>
          ))}
          {isEditing && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEntities({
                  ...entities,
                  education: [...entities.education, { id: Date.now().toString(), institution: '' }]
                })
              }}
            >
              + Add Education
            </Button>
          )}
        </div>
      </Card>

      {/* Skills */}
      <Card title={`Skills (${(entities.skills || []).length})`}>
        {isEditing ? (
          <textarea
            className="w-full border-slate-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm p-2 border min-h-[60px]"
            placeholder="Comma separated skills"
            value={(entities.skills || []).map(s => s.name).join(', ')}
            onChange={(e) => {
              const skillsArray = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
              setEntities({
                ...entities,
                skills: skillsArray.map((s, i) => ({ id: i.toString(), name: s }))
              })
            }}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {(entities.skills as Skill[])?.map((skill) => (
              <span
                key={skill.id || skill.name}
                className="bg-slate-100 text-slate-700 text-xs font-medium px-2.5 py-1 rounded-full"
              >
                {skill.name}
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* Projects */}
      {((entities.projects?.length ?? 0) > 0 || isEditing) && (
        <Card title="Projects">
          <div className="space-y-4">
            {(entities.projects || []).map((proj, pIdx) => (
              <div key={proj.id || pIdx} className="relative">
                {isEditing && (
                  <button
                    className="absolute top-0 right-0 text-red-500 text-xs font-semibold"
                    onClick={() => {
                      const newProj = [...entities.projects]
                      newProj.splice(pIdx, 1)
                      setEntities({ ...entities, projects: newProj })
                    }}
                  >
                    Remove
                  </button>
                )}
                {isEditing ? (
                  <div className="space-y-2 max-w-lg">
                    <input
                      className="w-full font-semibold text-slate-900 text-sm border p-1 rounded"
                      value={proj.name || ''}
                      placeholder="Project Name"
                      onChange={(e) => {
                        const newProj = [...entities.projects]
                        newProj[pIdx] = { ...newProj[pIdx], name: e.target.value }
                        setEntities({ ...entities, projects: newProj })
                      }}
                    />
                    <input
                      className="w-full text-slate-600 text-xs border p-1 rounded"
                      value={proj.url || ''}
                      placeholder="URL"
                      onChange={(e) => {
                        const newProj = [...entities.projects]
                        newProj[pIdx] = { ...newProj[pIdx], url: e.target.value }
                        setEntities({ ...entities, projects: newProj })
                      }}
                    />
                    <textarea
                      className="w-full text-slate-600 text-sm border p-1 rounded"
                      value={proj.description || ''}
                      placeholder="Description"
                      onChange={(e) => {
                        const newProj = [...entities.projects]
                        newProj[pIdx] = { ...newProj[pIdx], description: e.target.value }
                        setEntities({ ...entities, projects: newProj })
                      }}
                    />
                  </div>
                ) : (
                  <>
                    <p className="font-semibold text-slate-900 text-sm">
                      {proj.name}
                      {proj.url && (
                        <a
                          href={proj.url}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-2 text-primary-600 text-xs hover:underline"
                        >
                          ↗ link
                        </a>
                      )}
                    </p>
                    <p className="text-sm text-slate-600 mt-0.5">{proj.description}</p>
                    {proj.technologies?.length ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {proj.technologies.map((t) => (
                          <span key={t} className="bg-primary-50 text-primary-700 text-xs px-2 py-0.5 rounded-full">
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ))}
            {isEditing && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEntities({
                    ...entities,
                    projects: [...(entities.projects || []), { id: Date.now().toString(), name: '', description: '' }]
                  })
                }}
              >
                + Add Project
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Certifications */}
      {((entities.certifications?.length ?? 0) > 0 || isEditing) && (
        <Card title="Certifications">
          <ul className="space-y-2">
            {(entities.certifications || []).map((cert, cIdx) => (
              <li key={cert.id || cIdx} className="text-sm text-slate-700 relative">
                {isEditing && (
                  <button
                    className="absolute top-0 right-0 text-red-500 text-xs font-semibold"
                    onClick={() => {
                      const newCert = [...entities.certifications]
                      newCert.splice(cIdx, 1)
                      setEntities({ ...entities, certifications: newCert })
                    }}
                  >
                    Remove
                  </button>
                )}
                {isEditing ? (
                  <div className="space-y-2 max-w-lg">
                    <input
                      className="w-full font-semibold text-slate-900 text-sm border p-1 rounded"
                      value={cert.name || ''}
                      placeholder="Certification Name"
                      onChange={(e) => {
                        const newCert = [...entities.certifications]
                        newCert[cIdx] = { ...newCert[cIdx], name: e.target.value }
                        setEntities({ ...entities, certifications: newCert })
                      }}
                    />
                    <div className="flex gap-2">
                      <input
                        className="w-1/2 text-slate-600 text-sm border p-1 rounded"
                        value={cert.issuer || ''}
                        placeholder="Issuer"
                        onChange={(e) => {
                          const newCert = [...entities.certifications]
                          newCert[cIdx] = { ...newCert[cIdx], issuer: e.target.value }
                          setEntities({ ...entities, certifications: newCert })
                        }}
                      />
                      <input
                        className="w-1/2 text-slate-400 text-sm border p-1 rounded"
                        value={cert.date || ''}
                        placeholder="Date"
                        onChange={(e) => {
                          const newCert = [...entities.certifications]
                          newCert[cIdx] = { ...newCert[cIdx], date: e.target.value }
                          setEntities({ ...entities, certifications: newCert })
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="font-medium">{cert.name}</span>
                    {cert.issuer && <span className="text-slate-500"> — {cert.issuer}</span>}
                    {cert.date && <span className="text-slate-400"> ({cert.date})</span>}
                  </>
                )}
              </li>
            ))}
          </ul>
          {isEditing && (
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => {
                setEntities({
                  ...entities,
                  certifications: [...(entities.certifications || []), { id: Date.now().toString(), name: '' }]
                })
              }}
            >
              + Add Certification
            </Button>
          )}
        </Card>
      )}

      {/* Proceed CTA */}
      {!isEditing && scores.overall >= 0.6 && (
        <div className="mt-8 flex justify-center">
          <Button size="lg" onClick={() => window.location.href = '/onboarding'}>
            Looks good, proceed to onboarding →
          </Button>
        </div>
      )}
    </div>
  )
}
