import {
  isBenched,
  resetBench,
  benchStatus,
  classifyJobApiFailure,
  handleJobApiFailure,
  usableCredentials,
} from '../../../src/services/jobs/providers/jobCredentialChain'

afterEach(() => resetBench())

describe('classifyJobApiFailure', () => {
  it('classifies a 429 or quota-shaped message as quota', () => {
    expect(classifyJobApiFailure({ status: 429 })).toBe('quota')
    expect(classifyJobApiFailure(new Error('You have exceeded the MONTHLY quota'))).toBe('quota')
    expect(classifyJobApiFailure(new Error('Too Many Requests'))).toBe('quota')
  })

  it('classifies 401/403 or an auth-shaped message as auth', () => {
    expect(classifyJobApiFailure({ status: 401 })).toBe('auth')
    expect(classifyJobApiFailure({ status: 403 })).toBe('auth')
    expect(classifyJobApiFailure(new Error('invalid api key'))).toBe('auth')
  })

  it('classifies a 5xx or network error as transient', () => {
    expect(classifyJobApiFailure({ status: 503 })).toBe('transient')
    expect(classifyJobApiFailure(new Error('ECONNRESET'))).toBe('transient')
  })

  it('classifies anything else as fatal', () => {
    expect(classifyJobApiFailure({ status: 400 })).toBe('fatal')
    expect(classifyJobApiFailure(new Error('bad request'))).toBe('fatal')
  })
})

describe('handleJobApiFailure / bench state', () => {
  it('benches a credential on quota, auth, and fatal failures, but not on transient ones', () => {
    handleJobApiFailure('cred-quota', { status: 429 })
    handleJobApiFailure('cred-auth', { status: 401 })
    handleJobApiFailure('cred-fatal', { status: 400 })
    handleJobApiFailure('cred-transient', { status: 503 })

    expect(isBenched('cred-quota')).toBe(true)
    expect(isBenched('cred-auth')).toBe(true)
    expect(isBenched('cred-fatal')).toBe(true)
    expect(isBenched('cred-transient')).toBe(false)
  })

  it('benches until (at least) the start of next month, not a short cooldown', () => {
    handleJobApiFailure('cred-x', { status: 429 })
    const until = benchStatus()['cred-x']
    const oneDayFromNow = Date.now() + 24 * 60 * 60 * 1000
    expect(until).toBeGreaterThan(oneDayFromNow)
  })

  it('resetBench clears one or all credentials', () => {
    handleJobApiFailure('a', { status: 429 })
    handleJobApiFailure('b', { status: 429 })
    resetBench('a')
    expect(isBenched('a')).toBe(false)
    expect(isBenched('b')).toBe(true)
    resetBench()
    expect(isBenched('b')).toBe(false)
  })
})

describe('usableCredentials', () => {
  it('filters out benched credentials while preserving order', () => {
    const all = [{ id: 'first' }, { id: 'second' }, { id: 'third' }]
    handleJobApiFailure('second', { status: 429 })
    expect(usableCredentials(all)).toEqual([{ id: 'first' }, { id: 'third' }])
  })
})
