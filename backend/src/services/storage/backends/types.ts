/**
 * Storage backend contract — deliberately tiny (three methods, byte keys
 * in/out) so the actual mechanism (local disk today, GCS once configured —
 * see fileStorage.ts) is swappable without any caller change. Encryption
 * happens above this layer (utils/encryption.ts) — a backend only ever
 * sees/returns already-encrypted bytes.
 */
export interface StorageBackend {
  write(key: string, data: Buffer): Promise<void>
  read(key: string): Promise<Buffer>
  /** Must not throw when the key is already gone — deleting twice is a no-op, not an error. */
  delete(key: string): Promise<void>
}
