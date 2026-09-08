/**
 * Uploaded-file storage — now backend-swappable (2026-09-07 architecture
 * hardening, phase 1). Previously always local disk, which silently loses
 * every uploaded résumé on redeploy for any platform with ephemeral/
 * per-instance disk (most PaaS), and can't be seen across instances. The
 * backend (local disk vs. GCS) is selected once, below; every caller keeps
 * using the same four functions regardless of which is active — see
 * `backends/types.ts`'s `StorageBackend` interface.
 *
 * Encryption is unchanged and happens at THIS layer, above the backend —
 * a backend only ever sees/returns already-encrypted bytes, so switching
 * backends never touches the encrypted-at-rest guarantee.
 *
 * Keys are `{userId}/{uuid}{extension}` (2026-09-07 — one consistent,
 * predictable layout per user, on either backend: `uploads/{userId}/...`
 * locally, `resume/{userId}/...` in GCS — see backends/gcs.ts's prefix).
 * Authorization is enforced above this layer, not by the key shape itself:
 * every caller already loads the owning `ResumeFile` row scoped to
 * `req.userId` before ever touching a key (see resume.routes.ts), so a
 * candidate can never reach another user's key through this API regardless
 * of how predictable the path is.
 */

import { v4 as uuidv4 } from 'uuid'
import { config } from '../../config'
import { logger } from '../../utils/logger'
import { encryptBuffer, decryptBuffer } from '../../utils/encryption'
import { StorageBackend } from './backends/types'
import { localDiskBackend } from './backends/localDisk'
import { gcsBackend } from './backends/gcs'

function backend(): StorageBackend {
  return config.gcs.bucketName ? gcsBackend : localDiskBackend
}

export function getFileUrl(filename: string): string {
  // Historically a static-served path; now just the storage key
  // (`{userId}/{uuid}{extension}` — see this file's header comment) on
  // either backend. Files are encrypted at rest and only reachable via the
  // authenticated download route (GET /api/resumes/file/:fileId), never
  // served directly.
  return filename
}

/** Encrypts `buffer` and writes it under a fresh per-user key; returns that key. */
export async function saveEncryptedFile(buffer: Buffer, extension: string, userId: string): Promise<string> {
  const filename = `${userId}/${uuidv4()}${extension}`
  await backend().write(filename, encryptBuffer(buffer))
  return filename
}

/** Reads and decrypts a file previously written by saveEncryptedFile. */
export async function readDecryptedFile(filename: string): Promise<Buffer> {
  const encrypted = await backend().read(filename)
  return decryptBuffer(encrypted)
}

export async function deleteFile(filename: string): Promise<void> {
  try {
    await backend().delete(filename)
  } catch (err) {
    logger.warn(`Failed to delete file ${filename}`, { err: (err as Error).message })
  }
}

/**
 * True identity now — `fileUrl` IS the storage key (see getFileUrl), and
 * that key deliberately contains a `/` (the userId segment) as of
 * 2026-09-07. Kept as a named function rather than inlined at call sites
 * so `readDecryptedFile(filenameFromUrl(file.fileUrl))` still reads as
 * "turn the stored URL back into a storage key" — stripping path
 * separators here (the pre-2026-09-07 behavior) would silently truncate
 * every key down to its filename and drop the user's folder.
 */
export function filenameFromUrl(fileUrl: string): string {
  return fileUrl
}
