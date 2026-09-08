const mockDiscoverJobsGlobally = jest.fn()
jest.mock('../../src/services/jobs/discoveryService', () => ({
  discoverJobsGlobally: (...args: unknown[]) => mockDiscoverJobsGlobally(...args),
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
import { runScheduledDiscovery } from '../../src/services/jobs/discoveryCron'

beforeEach(() => {
  mockDiscoverJobsGlobally.mockReset()
  mockDiscoverJobsGlobally.mockResolvedValue({ newListings: 0, seen: 0, errors: [] })
})

describe('runScheduledDiscovery', () => {
  it('calls the system-wide discovery once per tick — no per-user loop any more', async () => {
    mockDiscoverJobsGlobally.mockResolvedValueOnce({ newListings: 12, seen: 3, errors: [] })

    const result = await runScheduledDiscovery()

    expect(mockDiscoverJobsGlobally).toHaveBeenCalledTimes(1)
    expect(mockDiscoverJobsGlobally).toHaveBeenCalledWith() // no candidate/profile argument any more
    expect(result).toEqual({ newListings: 12, seen: 3 })
  })

  it('does not throw when a run reports provider errors — just logs and returns the counts', async () => {
    mockDiscoverJobsGlobally.mockResolvedValueOnce({
      newListings: 2,
      seen: 0,
      errors: [{ source: 'jsearch', message: 'exhausted' }],
    })
    const result = await runScheduledDiscovery()
    expect(result).toEqual({ newListings: 2, seen: 0 })
  })

  it('a failed run is reported as zeros, not thrown', async () => {
    mockDiscoverJobsGlobally.mockRejectedValueOnce(new Error('db hiccup'))
    const result = await runScheduledDiscovery()
    expect(result).toEqual({ newListings: 0, seen: 0 })
  })

  it('skips a re-entrant call while a run is already in progress', async () => {
    let releaseFirstRun: () => void = () => {}
    const firstRunGate = new Promise<void>((resolve) => { releaseFirstRun = resolve })
    mockDiscoverJobsGlobally.mockImplementationOnce(async () => {
      await firstRunGate
      return { newListings: 1, seen: 0, errors: [] }
    })

    const firstRun = runScheduledDiscovery()
    // Give the first run a tick to set the re-entrancy flag before firing the second.
    await Promise.resolve()
    const secondRun = await runScheduledDiscovery()

    expect(secondRun).toEqual({ newListings: 0, seen: 0 })
    expect(mockDiscoverJobsGlobally).toHaveBeenCalledTimes(1)

    releaseFirstRun()
    await firstRun
  })
})
