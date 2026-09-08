/**
 * Local-filesystem storage backend — the only backend until `GCS_BUCKET_NAME`
 * is set (see fileStorage.ts). Same directory/behavior as before this was
 * split into a backend interface, just async now (fs/promises) so the
 * interface can also accommodate a real network-backed implementation.
 */

import fs from 'fs/promises'
import path from 'path'
import { config } from '../../../config'
import { StorageBackend } from './types'

const uploadDir = path.resolve(process.cwd(), config.upload.uploadDir)

function filePath(key: string): string {
  return path.join(uploadDir, key)
}

export const localDiskBackend: StorageBackend = {
  async write(key, data) {
    // `key` is `{userId}/{uuid}{extension}` (see fileStorage.ts) — the
    // per-user subdirectory needs creating too, not just uploadDir itself.
    await fs.mkdir(path.dirname(filePath(key)), { recursive: true })
    await fs.writeFile(filePath(key), data)
  },

  async read(key) {
    return fs.readFile(filePath(key))
  },

  async delete(key) {
    try {
      await fs.unlink(filePath(key))
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
  },
}

/** Test-only escape hatch to the raw on-disk path — local-disk-specific, not part of the StorageBackend contract. */
export function localFilePath(key: string): string {
  return filePath(key)
}
