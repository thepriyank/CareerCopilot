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
