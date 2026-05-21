'use client'

import { useState, useCallback } from 'react'
import { resumes as resumesApi, ApiError } from '@/lib/api'
import { ResumeFile, ParsedResume } from '@/types'

export type UploadStatus = 'idle' | 'uploading' | 'parsing' | 'done' | 'error'

export interface UploadState {
  status: UploadStatus
  progress: number
  resumeFile: ResumeFile | null
  parsedResume: ParsedResume | null
  error: string | null
}

const initialState: UploadState = {
  status: 'idle',
  progress: 0,
  resumeFile: null,
  parsedResume: null,
  error: null,
}

export function useResumeUpload() {
  const [state, setState] = useState<UploadState>(initialState)

  const upload = useCallback(async (file: File) => {
    setState({ ...initialState, status: 'uploading', progress: 20 })
    try {
      setState((s) => ({ ...s, progress: 40, status: 'uploading' }))
      const { resumeFile, parsedResume } = await resumesApi.upload(file)
      setState({
        status: 'done',
        progress: 100,
        resumeFile,
        parsedResume,
        error: null,
      })
      return { resumeFile, parsedResume }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Upload failed. Please try again.'
      setState({ ...initialState, status: 'error', error: message })
      return null
    }
  }, [])

  const reset = useCallback(() => setState(initialState), [])

  return { ...state, upload, reset }
}
