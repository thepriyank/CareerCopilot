import fs from 'fs'
import {
  saveEncryptedFile,
  readDecryptedFile,
  deleteFile,
  filenameFromUrl,
  getFileUrl,
} from '../../src/services/storage/fileStorage'
import { localFilePath } from '../../src/services/storage/backends/localDisk'

// No GCS_BUCKET_NAME set in the test env, so the local-disk backend is
// active — these tests exercise that path directly via localFilePath.

const USER_ID = 'user-1'

describe('saveEncryptedFile/readDecryptedFile', () => {
  const written: string[] = []

  afterAll(async () => {
    for (const filename of written) await deleteFile(filename)
  })

  it('round-trips file bytes through storage encrypted, keyed under the user', async () => {
    const plaintext = Buffer.from('%PDF-1.4 fake resume content')
    const filename = await saveEncryptedFile(plaintext, '.pdf', USER_ID)
    written.push(filename)

    expect(filename).toMatch(new RegExp(`^${USER_ID}/.+\\.pdf$`))
    // What's actually on disk must not equal the plaintext.
    const onDisk = fs.readFileSync(localFilePath(filename))
    expect(onDisk.equals(plaintext)).toBe(false)

    expect((await readDecryptedFile(filename)).equals(plaintext)).toBe(true)
  })

  it('two uploads from different users never collide, even with identical content', async () => {
    const plaintext = Buffer.from('same bytes')
    const a = await saveEncryptedFile(plaintext, '.pdf', 'user-a')
    const b = await saveEncryptedFile(plaintext, '.pdf', 'user-b')
    written.push(a, b)

    expect(a).not.toBe(b)
    expect(a.startsWith('user-a/')).toBe(true)
    expect(b.startsWith('user-b/')).toBe(true)
  })

  it('getFileUrl/filenameFromUrl round-trip the stored key, including its userId segment', () => {
    const key = 'user-1/abc-123.docx'
    expect(filenameFromUrl(getFileUrl(key))).toBe(key)
  })

  it('deleteFile is a no-op (not a throw) for a key that was never written', async () => {
    await expect(deleteFile('user-1/never-existed.pdf')).resolves.toBeUndefined()
  })
})
