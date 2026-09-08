const mockVerifyIdToken = jest.fn()
const mockGetAuth = jest.fn((_app: unknown) => ({ verifyIdToken: mockVerifyIdToken }))
const mockInitializeApp = jest.fn((_opts: unknown, _name: string) => ({ name: 'jobmagnate' }))
const mockCert = jest.fn((sa: unknown) => ({ kind: 'cert', sa }))
const mockApplicationDefault = jest.fn(() => ({ kind: 'adc' }))

jest.mock('firebase-admin/app', () => ({
  initializeApp: (...args: unknown[]) => mockInitializeApp(...(args as [unknown, string])),
  cert: (...args: unknown[]) => mockCert(...(args as [unknown])),
  applicationDefault: () => mockApplicationDefault(),
}))
jest.mock('firebase-admin/auth', () => ({
  getAuth: (...args: unknown[]) => mockGetAuth(...(args as [unknown])),
}))

jest.mock('fs', () => ({
  readFileSync: jest.fn(() => JSON.stringify({ type: 'service_account', project_id: 'jobmagnet-6a1ab' })),
}))

let firebaseModule: typeof import('../../src/services/auth/firebaseAdmin')

function loadWithConfig(firebase: { projectId: string; keyFile: string; credentialsJson: string }) {
  jest.resetModules()
  jest.doMock('../../src/config', () => ({ config: { firebase } }))
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  firebaseModule = require('../../src/services/auth/firebaseAdmin')
}

beforeEach(() => {
  mockVerifyIdToken.mockReset()
  mockGetAuth.mockClear()
  mockInitializeApp.mockClear()
  mockCert.mockClear()
  mockApplicationDefault.mockClear()
})

describe('verifyFirebaseIdToken', () => {
  it('throws a clear "not configured" error when FIREBASE_PROJECT_ID is unset', async () => {
    loadWithConfig({ projectId: '', keyFile: '', credentialsJson: '' })
    await expect(firebaseModule.verifyFirebaseIdToken('some-token')).rejects.toThrow(/not configured/i)
    expect(mockInitializeApp).not.toHaveBeenCalled()
  })

  it('initializes with Application Default Credentials when no key is configured', async () => {
    loadWithConfig({ projectId: 'jobmagnet-6a1ab', keyFile: '', credentialsJson: '' })
    mockVerifyIdToken.mockResolvedValue({ uid: 'abc', email: 'a@example.com' })

    await firebaseModule.verifyFirebaseIdToken('some-token')

    expect(mockApplicationDefault).toHaveBeenCalledTimes(1)
    expect(mockCert).not.toHaveBeenCalled()
    expect(mockInitializeApp).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'jobmagnet-6a1ab' }),
      'jobmagnate'
    )
  })

  it('initializes with inlined credentials JSON when FIREBASE_CREDENTIALS_JSON is set', async () => {
    const sa = { type: 'service_account', project_id: 'jobmagnet-6a1ab' }
    loadWithConfig({ projectId: 'jobmagnet-6a1ab', keyFile: '', credentialsJson: JSON.stringify(sa) })
    mockVerifyIdToken.mockResolvedValue({ uid: 'abc' })

    await firebaseModule.verifyFirebaseIdToken('some-token')

    expect(mockCert).toHaveBeenCalledWith(sa)
    expect(mockApplicationDefault).not.toHaveBeenCalled()
  })

  it('initializes from a key file path when FIREBASE_KEY_FILE is set', async () => {
    loadWithConfig({ projectId: 'jobmagnet-6a1ab', keyFile: 'secrets/fb-key.json', credentialsJson: '' })
    mockVerifyIdToken.mockResolvedValue({ uid: 'abc' })

    await firebaseModule.verifyFirebaseIdToken('some-token')

    expect(mockCert).toHaveBeenCalledWith(expect.objectContaining({ project_id: 'jobmagnet-6a1ab' }))
  })

  it('returns the decoded token on success', async () => {
    loadWithConfig({ projectId: 'jobmagnet-6a1ab', keyFile: '', credentialsJson: '' })
    mockVerifyIdToken.mockResolvedValue({ uid: 'abc', email: 'a@example.com', name: 'A' })

    const decoded = await firebaseModule.verifyFirebaseIdToken('some-token')

    expect(decoded).toEqual({ uid: 'abc', email: 'a@example.com', name: 'A' })
    expect(mockVerifyIdToken).toHaveBeenCalledWith('some-token')
  })

  it('reuses one initialized app across multiple calls', async () => {
    loadWithConfig({ projectId: 'jobmagnet-6a1ab', keyFile: '', credentialsJson: '' })
    mockVerifyIdToken.mockResolvedValue({ uid: 'abc' })

    await firebaseModule.verifyFirebaseIdToken('a')
    await firebaseModule.verifyFirebaseIdToken('b')

    expect(mockInitializeApp).toHaveBeenCalledTimes(1)
  })

  it('propagates a verification failure (expired/invalid token) as-is', async () => {
    loadWithConfig({ projectId: 'jobmagnet-6a1ab', keyFile: '', credentialsJson: '' })
    mockVerifyIdToken.mockRejectedValue(new Error('Firebase ID token has expired'))

    await expect(firebaseModule.verifyFirebaseIdToken('stale')).rejects.toThrow('Firebase ID token has expired')
  })
})
