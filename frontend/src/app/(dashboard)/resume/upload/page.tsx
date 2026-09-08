'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { Icon } from '@/components/ui/Icon'
import { resumes as resumesApi } from '@/lib/api'

export default function ResumeUploadPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'parsing' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  async function handleFile(f: File) {
    setFile(f)
    setPhase('parsing')
    setProgress(0)
    setError(null)

    const tick = setInterval(() => setProgress(p => Math.min(p + 12, 85)), 300)
    try {
      const { resumeFile } = await resumesApi.upload(f)
      clearInterval(tick)
      setProgress(100)
      setPhase('done')
      // The real review/edit UI (with actual extracted entities and
      // confidence scores) lives on the resume detail page — this upload
      // step just needs to hand off the real resumeFile id, not fabricate
      // a second, fake preview here.
      router.push(`/resume/${resumeFile.id}`)
    } catch (err: unknown) {
      clearInterval(tick)
      setError(err instanceof Error ? err.message : 'Upload failed')
      setPhase('idle')
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  return (
    <>
      <Topbar
        eyebrow="Resume · Step 1 of 3"
        title="Bring your resume in"
      />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>

        {/* Left: dropzone */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, borderRight: '1px solid var(--line-2)', background: 'var(--paper)' }}>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              width: '100%', maxWidth: 420,
              padding: 40,
              borderRadius: 16,
              border: `2px dashed ${dragging ? 'var(--ink-700)' : 'var(--ink-300)'}`,
              background: dragging ? 'var(--ink-100)' : 'var(--surface)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 14, textAlign: 'center', cursor: 'pointer',
              transition: 'border-color .15s, background .15s',
            }}
          >
            <div style={{ width: 64, height: 64, borderRadius: 14, background: 'var(--ink-100)', color: 'var(--ink-900)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon.Upload size={28} />
            </div>
            <div>
              <div className="serif" style={{ fontSize: 22 }}>Drop your resume here</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>or click to browse</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="chip chip-ink">PDF</span>
              <span className="chip chip-ink">DOCX</span>
              <span className="chip">10 MB max</span>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />

          {file && phase === 'parsing' && (
            <div className="card" style={{ width: '100%', maxWidth: 420, padding: 14, marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon.Doc size={20} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Parsing… extracting sections</div>
                </div>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{progress}%</span>
              </div>
              <div className="score-bar" style={{ marginTop: 10 }}>
                <i style={{ width: progress + '%', transition: 'width .3s' }} />
              </div>
            </div>
          )}

          {error && (
            <div style={{ width: '100%', maxWidth: 420, marginTop: 16, padding: 14, background: 'var(--error-bg)', borderRadius: 10, fontSize: 13, color: 'var(--error)' }}>
              {error}
            </div>
          )}

          <div style={{ marginTop: 24, display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Icon.Check size={12} color="var(--sage-700)" /> Privacy-first</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Icon.Check size={12} color="var(--sage-700)" /> Never trains models</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Icon.Check size={12} color="var(--sage-700)" /> Encrypted at rest</span>
          </div>
        </div>

        {/* Right: status — the real review/edit UI lives on the resume detail page */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--paper-2)' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
            {phase === 'idle' && (
              <div>
                <Icon.Doc size={32} color="var(--ink-300)" />
                <div style={{ fontSize: 13, marginTop: 12 }}>Upload a resume to see the parsing results</div>
              </div>
            )}
            {phase === 'parsing' && (
              <div>
                <div className="mono" style={{ fontSize: 12 }}>Parsing your resume… {progress}%</div>
              </div>
            )}
            {phase === 'done' && (
              <div>
                <div style={{ fontSize: 13 }}>Parsed — taking you to your results…</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
