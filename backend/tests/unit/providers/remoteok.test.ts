import remoteok from '../../../src/services/jobs/providers/remoteok'

describe('remoteok provider', () => {
  it('filters out rows missing a position or a valid url', async () => {
    const sample = [
      { legal: 'metadata row' },
      { position: 'Backend Engineer', url: 'https://remoteok.com/remote-jobs/1', company: 'Acme', location: 'Worldwide' },
      { position: '', url: 'https://remoteok.com/remote-jobs/2' },
      { position: 'No URL role', url: 'not-a-url' },
    ]
    const fetched = await remoteok.fetch(
      { name: 'RemoteOK', provider: 'remoteok' },
      { fetchJson: async () => sample, fetchText: async () => '' }
    )
    expect(fetched).toHaveLength(1)
    expect(fetched[0]).toMatchObject({ title: 'Backend Engineer', company: 'Acme', location: 'Worldwide' })
  })

  it('throws on a non-array response instead of silently returning nothing misleading', async () => {
    await expect(
      remoteok.fetch({ name: 'RemoteOK', provider: 'remoteok' }, { fetchJson: async () => ({}), fetchText: async () => '' })
    ).rejects.toThrow(/unexpected API response/)
  })
})
