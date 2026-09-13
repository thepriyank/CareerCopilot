import multer, { FileFilterCallback } from 'multer'
import { Request } from 'express'
import { config } from '../config'

// Files are held in memory only — the route handler encrypts them before
// they ever touch disk (see services/storage/fileStorage.ts), and the
// plaintext buffer is used directly for parsing. Nothing plaintext is written.
const storage = multer.memoryStorage()

function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  const allowedMimeTypes = config.upload.allowedMimeTypes as unknown as string[]
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('INVALID_FILE_TYPE'))
  }
}

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.upload.maxFileSize },
}).single('file')

// PDF-only variant — for uploads that are never a resume DOCX, e.g. a
// LinkedIn "Save to PDF" profile export (see routes/linkedin.routes.ts).
function pdfFileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  if (file.mimetype === 'application/pdf') {
    cb(null, true)
  } else {
    cb(new Error('INVALID_FILE_TYPE'))
  }
}

export const pdfUploadMiddleware = multer({
  storage,
  fileFilter: pdfFileFilter,
  limits: { fileSize: config.upload.maxFileSize },
}).single('file')
