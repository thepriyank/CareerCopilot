/**
 * AES-256-GCM encryption for small secrets stored at rest (currently: the
 * user's model-connection string in `User.settings`, which may hold a real
 * cloud API key). GCM's auth tag means a tampered payload fails to decrypt
 * loudly rather than silently returning garbage.
 *
 * Payload format: `<iv>:<authTag>:<ciphertext>`, each base64.
 */

import crypto from 'crypto'
import { config } from '../config'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96-bit IV, the recommended size for GCM
const KEY_LENGTH = 32 // AES-256

function getKey(): Buffer {
  if (!config.settingsEncryptionKey) {
    throw new Error('SETTINGS_ENCRYPTION_KEY is not configured on the server')
  }
  const key = Buffer.from(config.settingsEncryptionKey, 'hex')
  if (key.length !== KEY_LENGTH) {
    throw new Error('SETTINGS_ENCRYPTION_KEY must be 32 bytes, hex-encoded (64 hex characters)')
  }
  return key
}

export function isEncryptionConfigured(): boolean {
  return !!config.settingsEncryptionKey
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':')
}

export function decrypt(payload: string): string {
  const key = getKey()
  const parts = payload.split(':')
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted payload')
  }
  const [ivB64, authTagB64, ciphertextB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')
  const ciphertext = Buffer.from(ciphertextB64, 'base64')

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plaintext.toString('utf8')
}

const AUTH_TAG_LENGTH = 16

/**
 * Binary-safe sibling of encrypt/decrypt for file bytes (resume uploads).
 * Payload layout: `iv (12 bytes) | authTag (16 bytes) | ciphertext`, all raw —
 * no base64, since this stays on disk rather than going into a JSON column.
 */
export function encryptBuffer(plaintext: Buffer): Buffer {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext])
}

export function decryptBuffer(payload: Buffer): Buffer {
  if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Malformed encrypted payload')
  }
  const key = getKey()
  const iv = payload.subarray(0, IV_LENGTH)
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}
