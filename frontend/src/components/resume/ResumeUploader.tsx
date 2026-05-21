'use client'

import { useCallback, useState, DragEvent, ChangeEvent } from 'react'
import Button from '@/components/ui/Button'

interface ResumeUploaderProps {
  onUpload: (file: File) => void
  uploading?: boolean
  progress?: number
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const ACCEPTED_EXTENSIONS = '.pdf,.docx'

export default function ResumeUploader({
  onUpload,
  uploading = false,
  progress = 0,
}: ResumeUploaderProps) {
  const [dragOver, setDragOver] = useState(false)
  const [fileError, setFileError] = useState('')

  const validateAndUpload = useCallback(
    (file: File) => {
      setFileError('')
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setFileError('Only PDF and DOCX files are accepted.')
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        setFileError('File must be under 10 MB.')
        return
      }
      onUpload(file)
    },
    [onUpload]
  )

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) validateAndUpload(file)
    },
    [validateAndUpload]
  )

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) validateAndUpload(file)
    },
    [validateAndUpload]
  )

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={[
          'relative rounded-2xl border-2 border-dashed p-12 text-center transition-colors',
          dragOver
            ? 'border-primary-500 bg-primary-50'
            : 'border-slate-300 bg-white hover:border-primary-400 hover:bg-slate-50',
          uploading ? 'pointer-events-none opacity-60' : 'cursor-pointer',
        ].join(' ')}
      >
        {!uploading ? (
          <>
            <div className="text-5xl mb-4">📄</div>
            <p className="text-slate-700 font-medium text-base mb-1">
              Drop your resume here, or{' '}
              <label className="text-primary-600 cursor-pointer hover:underline">
                browse
                <input
                  type="file"
                  accept={ACCEPTED_EXTENSIONS}
                  onChange={handleChange}
                  className="sr-only"
                />
              </label>
            </p>
            <p className="text-slate-400 text-sm">PDF or DOCX up to 10 MB</p>
          </>
        ) : (
          <div className="space-y-3">
            <div className="text-5xl mb-2">⚙️</div>
            <p className="text-slate-700 font-medium">
              {progress < 50 ? 'Uploading…' : 'Parsing with AI…'}
            </p>
            <div className="mx-auto w-48 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-slate-400">{progress}%</p>
          </div>
        )}
      </div>

      {fileError && (
        <p className="mt-2 text-sm text-red-600 text-center">{fileError}</p>
      )}
    </div>
  )
}
