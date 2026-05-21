'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { Icon } from '@/components/ui/Icon'
import { resumes as resumesApi } from '@/lib/api'

type ParseRow = { label: string; value: string; conf: number; warn?: boolean }

const MOCK_PARSE: ParseRow[] = [
  { label: 'Name',     value: 'Maya Kapoor',                    conf: 100 },
  { label: 'Headline', value: 'Senior Product Designer · ex-Stripe', conf: 94 },
  { label: 'Years',    value: '6.5 years',                      conf: 83 },
  { label: 'Skills',   value: '18 detected',                    conf: 88, warn: true },
  { label: 'Email',    value: 'maya@kapoor.studio',              conf: 96 },
  { label: 'Location', value: 'San Francisco',                   conf: 72 },
]

function confColor(c: number) {
  if (c >= 90) return 'var(--sage-700)'
  if (c >= 70) return 'var(--ink-700)'
  return 'var(--warning)'
}

export default function ResumeUploadPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'parsing' | 'review'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  async function handleFile(f: File) {
    setFile(f)
    setPhase('parsing')
    setProgress(0)
    setError(null)

    const tick = setInterval(() => setProgress(p => Math.min(p + 12, 85)), 300)
    try {
      await resumesApi.upload(f)
      clearInterval(tick)
      setProgress(100)
      setPhase('review')
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
        right={
          phase === 'review' && (
            <button className="btn btn-primary" onClick={() => router.push('/onboarding')}>
              Continue to onboarding →
            </button>
          )
        }
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

        {/* Right: parse review */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--paper-2)' }}>
          <div style={{ flex: 1, overflow: 'auto', padding: 32 }}>
            {phase === 'idle' && (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div>
                  <Icon.Doc size={32} color="var(--ink-300)" />
                  <div style={{ fontSize: 13, marginTop: 12 }}>Upload a resume to see the parsing results</div>
                </div>
              </div>
            )}

            {phase !== 'idle' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div className="eyebrow">Confirm what we found</div>
                  {phase === 'review' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>overall confidence</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sage-700)' }}>91%</span>
                    </div>
                  )}
                </div>

                <div className="card" style={{ overflow: 'hidden' }}>
                  {MOCK_PARSE.map(({ label, value, conf, warn }, i) => (
                    <div key={label} style={{ padding: '14px 18px', borderTop: i > 0 ? '1px solid var(--line-2)' : 'none' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 60px', gap: 12, alignItems: 'baseline' }}>
                        <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.1 }}>{label}</div>
                        <div style={{ fontSize: 14 }}>{phase === 'parsing' ? <span className="skeleton" style={{ display: 'inline-block', width: '60%', height: 14 }} /> : value}</div>
                        <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: confColor(conf), textAlign: 'right' }}>
                          {phase === 'parsing' ? '–' : `${conf}%`}
                        </div>
                      </div>
                      {warn && phase === 'review' && (
                        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Icon.Pencil size={11} /> Click to review manually
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {phase === 'review' && (
            <div style={{ padding: '14px 18px', borderTop: '1px solid var(--line)', background: 'var(--paper)', display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Edit fields</button>
              <button className="btn btn-primary" style={{ flex: 1.4, justifyContent: 'center' }} onClick={() => router.push('/onboarding')}>
                Looks right →
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
