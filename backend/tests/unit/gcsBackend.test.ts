const mockSave = jest.fn()
const mockDownload = jest.fn()
const mockDelete = jest.fn()
const mockFile = jest.fn(() => ({ save: mockSave, download: mockDownload, delete: mockDelete }))
const mockBucket = jest.fn(() => ({ file: mockFile }))
const MockStorage = jest.fn().mockImplementation(() => ({ bucket: mockBucket }))

jest.mock('@google-cloud/storage', () => ({ Storage: MockStorage }))

jest.mock('../../src/config', () => ({
  config: {
    gcs: { bucketName: 'test-bucket', projectId: '', keyFile: '', credentialsJson: '' },
  },
}))

// Re-required fresh per test (jest.resetModules) so `gcsBackend.ts`'s
// module-level cached client doesn't leak state between tests — otherwise
// only the very first test to touch the backend would ever see a real
// `new Storage(...)` call.
let gcsBackend: typeof import('../../src/services/storage/backends/gcs')['gcsBackend']

beforeEach(() => {
  MockStorage.mockClear()
  mockBucket.mockClear()
  mockFile.mockClear()
  mockSave.mockReset()
  mockDownload.mockReset()
  mockDelete.mockReset()
  jest.resetModules()
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  gcsBackend = require('../../src/services/storage/backends/gcs').gcsBackend
})

describe('gcsBackend', () => {
  it('writes under the resume/ prefix, preserving the {userId}/... key underneath it', async () => {
    mockSave.mockResolvedValue(undefined)
    await gcsBackend.write('user-1/abc.pdf', Buffer.from('data'))

    expect(mockBucket).toHaveBeenCalledWith('test-bucket')
    expect(mockFile).toHaveBeenCalledWith('resume/user-1/abc.pdf')
    expect(mockSave).toHaveBeenCalledWith(Buffer.from('data'), { resumable: false })
  })

  it('reads back the downloaded bytes', async () => {
    mockDownload.mockResolvedValue([Buffer.from('hello')])
    const result = await gcsBackend.read('user-1/abc.pdf')
    expect(mockFile).toHaveBeenCalledWith('resume/user-1/abc.pdf')
    expect(result).toEqual(Buffer.from('hello'))
  })

  it('delete swallows a 404 (already gone) rather than throwing', async () => {
    mockDelete.mockRejectedValue({ code: 404 })
    await expect(gcsBackend.delete('missing.pdf')).resolves.toBeUndefined()
  })

  it('delete propagates a real error', async () => {
    mockDelete.mockRejectedValue({ code: 500, message: 'boom' })
    await expect(gcsBackend.delete('abc.pdf')).rejects.toMatchObject({ code: 500 })
  })

  it('reuses one Storage client across multiple calls', async () => {
    mockSave.mockResolvedValue(undefined)
    await gcsBackend.write('a.pdf', Buffer.from('1'))
    await gcsBackend.write('b.pdf', Buffer.from('2'))
    expect(MockStorage).toHaveBeenCalledTimes(1)
  })
})
