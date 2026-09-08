import {
  encrypt,
  decrypt,
  isEncryptionConfigured,
  encryptBuffer,
  decryptBuffer,
} from '../../src/utils/encryption'

describe('isEncryptionConfigured', () => {
  it('is true when the test env key is set (see tests/setupEnv.ts)', () => {
    expect(isEncryptionConfigured()).toBe(true)
  })
})

describe('encrypt/decrypt', () => {
  it('round-trips a plaintext string', () => {
    const plaintext = 'http://localhost:11434/v1#model=gemma4:e4b'
    const ciphertext = encrypt(plaintext)
    expect(ciphertext).not.toBe(plaintext)
    expect(decrypt(ciphertext)).toBe(plaintext)
  })

  it('produces a different ciphertext each time (random IV) for the same plaintext', () => {
    const a = encrypt('sk-ant-some-key')
    const b = encrypt('sk-ant-some-key')
    expect(a).not.toBe(b)
    expect(decrypt(a)).toBe('sk-ant-some-key')
    expect(decrypt(b)).toBe('sk-ant-some-key')
  })

  it('throws instead of silently returning garbage when the payload is tampered with', () => {
    const ciphertext = encrypt('a real secret')
    const [iv, authTag, body] = ciphertext.split(':')
    const tampered = [iv, authTag, Buffer.from('tampered').toString('base64') + body.slice(8)].join(':')
    expect(() => decrypt(tampered)).toThrow()
  })

  it('throws on a malformed payload shape', () => {
    expect(() => decrypt('not-a-valid-payload')).toThrow(/Malformed/)
  })
})

describe('encryptBuffer/decryptBuffer', () => {
  it('round-trips arbitrary binary data', () => {
    const plaintext = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0xff, 0x10, 0x02])
    const ciphertext = encryptBuffer(plaintext)
    expect(ciphertext.equals(plaintext)).toBe(false)
    expect(decryptBuffer(ciphertext).equals(plaintext)).toBe(true)
  })

  it('produces a different ciphertext each time for the same plaintext', () => {
    const plaintext = Buffer.from('same file bytes')
    const a = encryptBuffer(plaintext)
    const b = encryptBuffer(plaintext)
    expect(a.equals(b)).toBe(false)
    expect(decryptBuffer(a).equals(plaintext)).toBe(true)
    expect(decryptBuffer(b).equals(plaintext)).toBe(true)
  })

  it('throws instead of silently returning garbage when tampered with', () => {
    const ciphertext = encryptBuffer(Buffer.from('a real file'))
    ciphertext[ciphertext.length - 1] ^= 0xff
    expect(() => decryptBuffer(ciphertext)).toThrow()
  })

  it('throws on a payload too short to contain iv+authTag', () => {
    expect(() => decryptBuffer(Buffer.from('short'))).toThrow(/Malformed/)
  })
})
