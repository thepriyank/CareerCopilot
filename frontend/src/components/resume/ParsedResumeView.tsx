'use client'

import { useState } from 'react'
import { ParsedResume, ExtractedEntities, ConfidenceScores, WorkExperience, Education, Skill } from '@/types'
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

  const entities = parsedResume.extractedEntities as ExtractedEntities
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
    } catch {
      setSaveMsg('Save failed.')
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(''), 3000)
    }
  }

  return (
    <div className="space-y-2">
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
          <Button size="sm" loading={saving} onClick={handleSave} variant="ghost">
            Save changes
          </Button>
        </div>
      </div>

      {/* Contact info */}
      <Card title="Contact Information">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {[
            { key: 'Email', value: entities.contact?.email },
            { key: 'Phone', value: entities.contact?.phone },
            { key: 'Location', value: entities.contact?.location },
            { key: 'LinkedIn', value: entities.contact?.linkedin },
            { key: 'Website', value: entities.contact?.website },
          ]
            .filter((item) => item.value)
            .map((item) => (
              <div key={item.key}>
                <dt className="text-slate-500 font-medium">{item.key}</dt>
                <dd className="text-slate-900 break-all">{item.value}</dd>
              </div>
            ))}
        </dl>
      </Card>

      {/* Summary */}
      {entities.summary && (
        <Card title="Summary">
          <p className="text-sm text-slate-700 leading-relaxed">{entities.summary}</p>
        </Card>
      )}

      {/* Experience */}
      {entities.experience?.length > 0 && (
        <Card title="Work Experience">
          <div className="space-y-5">
            {(entities.experience as WorkExperience[]).map((exp) => (
              <div key={exp.id} className="border-l-2 border-primary-200 pl-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{exp.title}</p>
                    <p className="text-slate-600 text-sm">{exp.company}</p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0 ml-4">
                    {exp.startDate} – {exp.endDate ?? (exp.current ? 'Present' : '')}
                  </span>
                </div>
                {exp.location && (
                  <p className="text-xs text-slate-400 mt-0.5">{exp.location}</p>
                )}
                {exp.bullets?.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {exp.bullets.map((b, i) => (
                      <li key={i} className="text-sm text-slate-700 flex gap-2">
                        <span className="text-slate-400 shrink-0">•</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Education */}
      {entities.education?.length > 0 && (
        <Card title="Education">
          <div className="space-y-3">
            {(entities.education as Education[]).map((edu) => (
              <div key={edu.id}>
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
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Skills */}
      {entities.skills?.length > 0 && (
        <Card title={`Skills (${entities.skills.length})`}>
          <div className="flex flex-wrap gap-2">
            {(entities.skills as Skill[]).map((skill) => (
              <span
                key={skill.id}
                className="bg-slate-100 text-slate-700 text-xs font-medium px-2.5 py-1 rounded-full"
              >
                {skill.name}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Certifications */}
      {entities.certifications?.length > 0 && (
        <Card title="Certifications">
          <ul className="space-y-1">
            {entities.certifications.map((cert) => (
              <li key={cert.id} className="text-sm text-slate-700">
                <span className="font-medium">{cert.name}</span>
                {cert.issuer && <span className="text-slate-500"> — {cert.issuer}</span>}
                {cert.date && <span className="text-slate-400"> ({cert.date})</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Projects */}
      {entities.projects?.length > 0 && (
        <Card title="Projects">
          <div className="space-y-3">
            {entities.projects.map((proj) => (
              <div key={proj.id}>
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
                {proj.technologies?.length && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {proj.technologies.map((t) => (
                      <span key={t} className="bg-primary-50 text-primary-700 text-xs px-2 py-0.5 rounded-full">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
