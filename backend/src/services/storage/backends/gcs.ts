/**
 * Google Cloud Storage backend — active once `GCS_BUCKET_NAME` is set (see
 * fileStorage.ts's backend-selection logic). Credentials resolve the same
 * way the `@google-cloud/storage` SDK always does: `GCS_KEY_FILE` (a
 * service-account JSON key path) or `GCS_CREDENTIALS_JSON` (the key inlined
 * — for a PaaS target with no persistent filesystem to put a key file on)
 * if set, otherwise Application Default Credentials (e.g. already running
 * on GCP infra, or `gcloud auth application-default login` locally).
 *
 * Objects are written under a fixed prefix so a bucket can be shared with
 * other things later without key collisions. Final layout:
 * `resume/{userId}/{uuid}{extension}` — the `{userId}/...` part is already
 * baked into the key by fileStorage.ts (shared with the local-disk
 * backend), this prefix just adds the `resume/` root folder on top so the
 * bucket stays organized if other file types land in it later.
 */

import path from 'path'
import { Storage } from '@google-cloud/storage'
import { config } from '../../../config'
import { StorageBackend } from './types'

const OBJECT_PREFIX = 'resume/'

let client: Storage | null = null

function getClient(): Storage {
  if (client) return client
  const { projectId, keyFile, credentialsJson } = config.gcs
  client = new Storage({
    ...(projectId && { projectId }),
    // Resolved against process.cwd() explicitly (same convention as
    // localDisk.ts's uploadDir) rather than trusting the SDK to interpret a
    // relative GCS_KEY_FILE the same way regardless of where the process
    // happens to be started from.
    ...(keyFile && { keyFilename: path.resolve(process.cwd(), keyFile) }),
    ...(credentialsJson && { credentials: JSON.parse(credentialsJson) }),
  })
  return client
}

function objectName(key: string): string {
  return `${OBJECT_PREFIX}${key}`
}

export const gcsBackend: StorageBackend = {
  async write(key, data) {
    const bucket = getClient().bucket(config.gcs.bucketName)
    await bucket.file(objectName(key)).save(data, { resumable: false })
  },

  async read(key) {
    const bucket = getClient().bucket(config.gcs.bucketName)
    const [data] = await bucket.file(objectName(key)).download()
    return data
  },

  async delete(key) {
    try {
      await getClient().bucket(config.gcs.bucketName).file(objectName(key)).delete()
    } catch (err) {
      if ((err as { code?: number }).code !== 404) throw err
    }
  },
}
