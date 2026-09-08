'use client'

import { useEffect, useState } from 'react'
import { GeneratedResumeVersion } from '@/types'
import { masterResume as masterResumeApi } from '@/lib/api'
import { Topbar } from '@/components/layout/Topbar'
import MasterResumeEditor from '@/components/resume/MasterResumeEditor'
import Button from '@/components/ui/Button'

export default function MasterResumePage() {
  const [masterResume, setMasterResume] = useState<GeneratedResumeVersion | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const fetchMasterResume = async () => {
    try {
      const res = await masterResumeApi.get()
      setMasterResume(res.masterResume)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch master resume')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMasterResume()
  }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    try {
      const res = await masterResumeApi.generate()
      setMasterResume(res.masterResume)
    } catch (err: any) {
      setError(err.message || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <Topbar eyebrow="Master Resume" title="Review & Enhance" />
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6 pb-24">
          
          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-md text-sm border border-red-200">
              {error}
            </div>
          )}

          {!masterResume && !generating && (
            <div className="text-center py-20 bg-white rounded-lg border border-slate-200 shadow-sm">
              <div className="text-4xl mb-4">✨</div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Enhance your resume</h3>
              <p className="text-slate-500 mb-6 max-w-md mx-auto">
                We will use your parsed resume and candidate profile to create an impact-focused, ATS-friendly Master Resume.
              </p>
              <Button size="lg" onClick={handleGenerate}>
                Generate Master Resume
              </Button>
            </div>
          )}

          {generating && (
            <div className="text-center py-20 bg-white rounded-lg border border-slate-200 shadow-sm">
              <div className="text-4xl mb-4 animate-pulse">⚙️</div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Enhancing your resume...</h3>
              <p className="text-slate-500 max-w-md mx-auto">
                Applying the STAR method to your experience and optimizing your summary. This takes about 10-20 seconds.
              </p>
            </div>
          )}

          {masterResume && !generating && (
             <MasterResumeEditor 
               masterResume={masterResume} 
               onUpdate={(updated) => setMasterResume(updated)} 
             />
          )}

        </div>
      </div>
    </div>
  )
}
