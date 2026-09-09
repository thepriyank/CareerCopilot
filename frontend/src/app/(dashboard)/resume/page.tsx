'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Topbar } from '@/components/layout/Topbar'
import { StatusPill } from '@/components/ui/StatusPill'
import { Icon } from '@/components/ui/Icon'
import { resumes as resumesApi } from '@/lib/api'

interface ResumeFile { id: string; fileName: string; uploadedAt: string }

export default function ResumePage() {
  const [files, setFiles] = useState<ResumeFile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    resumesApi.list()
      .then((data: { resumes: ResumeFile[] }) => { setFiles(data.resumes ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <>
      <Topbar
        eyebrow="Resume workspace"
        title="Master CV"
        right={
          <>
            <StatusPill status="reviewed" />
            <Link href="/resume/upload" className="btn btn-secondary btn-sm"><Icon.Upload size={13} /> Upload new</Link>
            <button className="btn btn-primary btn-sm"><Icon.Check size={13} /> Approve master</button>
          </>
        }
      />
      <div style={{ flex: 1, overflow: 'auto', padding: 28, background: 'var(--paper-2)' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)' }}>
            <div className="mono" style={{ fontSize: 12 }}>loading…</div>
          </div>
        ) : files.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
            <Icon.Doc size={32} color="var(--ink-300)" />
            <div className="serif" style={{ fontSize: 24, marginTop: 16 }}>No resume yet</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.55 }}>
              Drop a PDF or DOCX to start. We&rsquo;ll detect sections, normalise skills, and prepare your master.
            </div>
            <div style={{ marginTop: 20 }}>
              <Link href="/resume/upload" className="btn btn-primary">Upload resume</Link>
            </div>
          </div>
        ) : (
          <div className="grid-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {files.map(f => (
              <Link key={f.id} href={`/resume/${f.id}`} style={{ textDecoration: 'none' }}>
                <div className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 9, background: 'var(--ink-100)', color: 'var(--ink-900)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon.Doc size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.fileName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{new Date(f.uploadedAt).toLocaleDateString()}</div>
                  </div>
                  <Icon.ChevronR size={14} color="var(--text-muted)" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
