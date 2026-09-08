'use client'

import { useState, useMemo } from 'react'
import { GeneratedResumeVersion, ExtractedEntities, WorkExperience } from '@/types'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { masterResume as masterResumeApi, approvals as approvalsApi, downloadFile, ApiError } from '@/lib/api'
import { useRouter } from 'next/navigation'

interface MasterResumeEditorProps {
  masterResume: GeneratedResumeVersion
  onUpdate?: (updated: GeneratedResumeVersion) => void
}

export default function MasterResumeEditor({ masterResume, onUpdate }: MasterResumeEditorProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const [approveError, setApproveError] = useState('')
  
  const [entities, setEntities] = useState<ExtractedEntities>(masterResume.content as ExtractedEntities)

  const [regenState, setRegenState] = useState<{expIdx: number, bulletIdx: number, instruction: string, loading: boolean, error?: string} | null>(null)

  const sourceEntities = useMemo(() => {
    if (!masterResume.source?.extractedEntities) return null
    if (typeof masterResume.source.extractedEntities === 'string') {
      try {
        return JSON.parse(masterResume.source.extractedEntities) as ExtractedEntities
      } catch {
        return null
      }
    }
    return masterResume.source.extractedEntities as ExtractedEntities
  }, [masterResume.source])

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      const result = await masterResumeApi.update(masterResume.id, {
        content: entities,
      })
      onUpdate?.(result.masterResume)
      setSaveMsg('Saved!')
      setIsEditing(false)
    } catch {
      setSaveMsg('Save failed.')
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(''), 3000)
    }
  }

  const handleApprove = async () => {
    setApproving(true)
    setApproveError('')
    try {
      const result = await approvalsApi.approve('resume', masterResume.id)
      if (result.resume) onUpdate?.(result.resume as GeneratedResumeVersion)
      router.push('/dashboard') // Or to next step
    } catch (err) {
      setApproveError(err instanceof ApiError ? err.message : 'Could not approve this resume')
    } finally {
      setApproving(false)
    }
  }

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true)
    setDownloadError('')
    try {
      await downloadFile(`/api/resume/master/${masterResume.id}/pdf`, 'master-resume.pdf')
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : 'Could not download the PDF')
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handleCancel = () => {
    setEntities(masterResume.content as ExtractedEntities)
    setIsEditing(false)
  }

  const handleRegenerate = async (expIdx: number, bulletIdx: number) => {
    if (!regenState || !regenState.instruction.trim()) return
    setRegenState(prev => prev ? { ...prev, loading: true, error: undefined } : null)

    const exp = entities.experience[expIdx]
    const currentText = exp.bullets[bulletIdx]
    
    const sourceExp = sourceEntities?.experience?.find(e => e.id === exp.id || e.company === exp.company)
    const originalText = sourceExp?.bullets?.[bulletIdx] || currentText

    try {
      const res = await masterResumeApi.regenerate(masterResume.id, {
        originalText,
        currentText,
        instruction: regenState.instruction
      })

      const newExp = [...entities.experience]
      newExp[expIdx].bullets[bulletIdx] = res.enhancedText
      const newEntities = { ...entities, experience: newExp }
      setEntities(newEntities)
      
      // Auto save after regenerate
      const updated = await masterResumeApi.update(masterResume.id, { content: newEntities })
      onUpdate?.(updated.masterResume)

      setRegenState(null)
    } catch (err) {
      console.error(err)
      const message = err instanceof ApiError ? err.message : 'Regeneration failed. Please try again.'
      setRegenState(prev => prev ? { ...prev, loading: false, error: message } : null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {entities.contact?.name ?? 'Master Resume'}
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              masterResume.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {masterResume.status}
            </span>
            <span className="text-xs text-slate-400">
              {masterResume.updatedAt
                ? new Date(masterResume.updatedAt).toLocaleDateString()
                : ''}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {downloadError && <span className="text-sm text-red-600">{downloadError}</span>}
          {saveMsg && <span className="text-sm text-green-600">{saveMsg}</span>}
          <Button size="sm" loading={downloadingPdf} onClick={handleDownloadPdf} variant="ghost">
            Download PDF
          </Button>
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
              Edit Content
            </Button>
          )}
        </div>
      </div>

      {/* Summary */}
      <Card title="Summary">
        {isEditing ? (
          <textarea
            className="w-full border-slate-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm p-2 border min-h-[100px]"
            value={entities.summary || ''}
            onChange={(e) => setEntities({ ...entities, summary: e.target.value })}
          />
        ) : (
          <div className="space-y-2">
            {sourceEntities?.summary && sourceEntities.summary !== entities.summary && (
              <div className="bg-slate-50 p-3 rounded text-sm text-slate-500 line-through decoration-slate-300">
                {sourceEntities.summary}
              </div>
            )}
            <div className="bg-primary-50 p-3 rounded text-sm text-slate-900 border border-primary-100">
              {entities.summary || '-'}
            </div>
          </div>
        )}
      </Card>

      {/* Experience */}
      <Card title="Work Experience">
        <div className="space-y-8">
          {(entities.experience as WorkExperience[]).map((exp, expIdx) => {
            const sourceExp = sourceEntities?.experience?.find(e => e.id === exp.id || e.company === exp.company)
            
            return (
              <div key={exp.id || expIdx} className="border-l-2 border-primary-200 pl-4 relative">
                {isEditing && (
                  <button
                    className="absolute top-0 right-0 text-red-500 text-xs font-semibold hover:underline"
                    onClick={() => {
                      const newExp = [...entities.experience]
                      newExp.splice(expIdx, 1)
                      setEntities({ ...entities, experience: newExp })
                    }}
                  >
                    Remove Role
                  </button>
                )}
                
                <div className="flex items-start justify-between mb-4">
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
                        <p className="font-semibold text-slate-900 text-base">{exp.title}</p>
                        <p className="text-primary-700 font-medium text-sm">{exp.company}</p>
                      </>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 shrink-0 ml-4 flex flex-col gap-1 items-end">
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
                      <span className="bg-slate-100 px-2 py-1 rounded font-medium">{exp.startDate} – {exp.endDate ?? (exp.current ? 'Present' : '')}</span>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <textarea
                    className="mt-2 w-full text-sm text-slate-700 border p-2 rounded min-h-[150px]"
                    placeholder="Bullets (one per line)"
                    value={(exp.bullets || []).join('\n')}
                    onChange={(e) => {
                      const newExp = [...entities.experience]
                      newExp[expIdx] = { ...newExp[expIdx], bullets: e.target.value.split('\n') }
                      setEntities({ ...entities, experience: newExp })
                    }}
                  />
                ) : (
                  <div className="space-y-3 mt-4">
                    {exp.bullets?.map((bullet, bulletIdx) => {
                      const originalBullet = sourceExp?.bullets?.[bulletIdx]
                      const isEditingBullet = regenState?.expIdx === expIdx && regenState?.bulletIdx === bulletIdx
                      
                      return (
                        <div key={bulletIdx} className="space-y-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Original */}
                            <div className="bg-slate-50 p-3 rounded-md text-sm text-slate-500 line-through decoration-slate-300 border border-slate-100">
                              <span className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Original</span>
                              {originalBullet || 'No original text'}
                            </div>
                            
                            {/* Enhanced */}
                            <div className="bg-white p-3 rounded-md text-sm text-slate-800 border-2 border-primary-100 relative group shadow-sm transition-all hover:shadow hover:border-primary-300">
                              <span className="block text-xs font-semibold text-primary-600 mb-1 uppercase tracking-wider flex items-center gap-1">
                                <span>Enhanced</span>
                                <span className="text-lg">✨</span>
                              </span>
                              {bullet}
                              
                              <button 
                                onClick={() => setRegenState({expIdx, bulletIdx, instruction: '', loading: false})} 
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 px-2 py-1 bg-white border border-slate-200 rounded shadow-sm text-xs text-slate-600 hover:text-primary-600 hover:border-primary-200 transition-all"
                              >
                                🪄 Regenerate
                              </button>
                            </div>
                          </div>

                          {/* Regenerate Input */}
                          {isEditingBullet && (
                            <div className="md:ml-[50%] space-y-1">
                              <div className="flex gap-2 items-center bg-primary-50 p-2 rounded-md border border-primary-200">
                                <input
                                  autoFocus
                                  disabled={regenState.loading}
                                  placeholder="e.g. Make it sound more senior..."
                                  className="flex-1 border-slate-300 p-1.5 rounded text-sm focus:ring-primary-500 focus:border-primary-500 shadow-sm"
                                  value={regenState.instruction}
                                  onChange={(e) => setRegenState({...regenState, instruction: e.target.value})}
                                  onKeyDown={(e) => e.key === 'Enter' && handleRegenerate(expIdx, bulletIdx)}
                                />
                                <Button
                                  size="sm"
                                  loading={regenState.loading}
                                  onClick={() => handleRegenerate(expIdx, bulletIdx)}
                                >
                                  Go
                                </Button>
                                <button
                                  onClick={() => setRegenState(null)}
                                  className="text-slate-400 hover:text-slate-600 px-1"
                                >
                                  ✕
                                </button>
                              </div>
                              {regenState.error && (
                                <div className="text-xs text-red-600 px-1">{regenState.error}</div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* Proceed CTA */}
      {!isEditing && masterResume.status !== 'APPROVED' && (
        <div className="mt-12 flex flex-col items-center gap-2 pb-8">
          <Button size="lg" loading={approving} onClick={handleApprove} className="px-8 py-3 text-lg shadow-md">
            Approve Master Resume
          </Button>
          {approveError && <div className="text-sm text-red-600">{approveError}</div>}
        </div>
      )}
    </div>
  )
}
