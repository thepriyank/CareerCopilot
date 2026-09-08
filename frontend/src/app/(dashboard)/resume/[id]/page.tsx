'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { StatusPill, PillStatus } from '@/components/ui/StatusPill'
import { resumes as resumesApi, masterResume as masterResumeApi } from '@/lib/api'
import type { ParsedResume } from '@/types'
import ParsedResumeView from '@/components/resume/ParsedResumeView'

export default function ResumeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [parsedResume, setParsedResume] = useState<ParsedResume | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enhancing, setEnhancing] = useState(false)
  const [enhanceError, setEnhanceError] = useState<string | null>(null)

  useEffect(() => {
    resumesApi.get(id)
      .then(data => {
        setParsedResume(data.parsedResume ?? null)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }, [id])

  const handleEnhance = async () => {
    setEnhancing(true)
    setEnhanceError(null)
    try {
      await masterResumeApi.generate()
      router.push('/master-resume')
    } catch (err: any) {
      setEnhanceError(err.message || 'Failed to generate master resume')
      setEnhancing(false)
    }
  }

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

  const name = (parsedResume?.extractedEntities as { contact?: { name?: string } } | undefined)?.contact?.name
  const pillStatus: PillStatus = parsedResume?.status === 'COMPLETED' ? 'reviewed' : 'draft'

  return (
    <>
      <Topbar
        eyebrow="Parsed resume"
        title={name ?? 'Your Resume'}
        right={
          <>
            <StatusPill status={pillStatus} />
            <button
              className="btn btn-primary btn-sm"
              onClick={handleEnhance}
              disabled={enhancing || !parsedResume || parsedResume.status !== 'COMPLETED'}
            >
              {enhancing ? (
                <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', marginRight: 4 }}>⟳</span> Enhancing…</>
              ) : (
                <>✨ Enhance to Master Resume</>
              )}
            </button>
          </>
        }
      />
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--paper-2)', padding: 32 }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          {enhanceError && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--error-bg)', borderRadius: 8, fontSize: 13, color: 'var(--error)' }}>
              {enhanceError}
            </div>
          )}
          {parsedResume ? (
            <ParsedResumeView parsedResume={parsedResume} onUpdate={setParsedResume} />
          ) : (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>No parsed resume found.</div>
          )}
        </div>
      </div>
    </>
  )
}
