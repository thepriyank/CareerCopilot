import fs from 'fs'
import path from 'path'
import { config } from '../../config'
import { logger } from '../../utils/logger'

const uploadDir = path.resolve(process.cwd(), config.upload.uploadDir)

export function getFilePath(filename: string): string {
  return path.join(uploadDir, filename)
}

export function getFileUrl(filename: string): string {
  // Returns a relative URL path; the Express static middleware serves /uploads
  return `/uploads/${filename}`
}

export function deleteFile(filename: string): void {
  const filePath = path.join(uploadDir, filename)
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch (err) {
    logger.warn(`Failed to delete file ${filename}`, { err })
  }
}

export function filenameFromUrl(fileUrl: string): string {
  return path.basename(fileUrl)
}
