import { createFakeRepo } from './testUtils/fakeRepo'

const profileRepo = createFakeRepo()

jest.mock('../../src/config/dataSource', () => {
  const { CandidateProfile } = require('../../src/entities/CandidateProfile')
  return {
    AppDataSource: {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === CandidateProfile) return profileRepo
        throw new Error(`No fake repo registered for entity: ${entity}`)
      }),
    },
  }
})

import { applyResumeDerivedProfileDefaults } from '../../src/services/profile/applyResumeDefaults'

const USER_ID = 'user-1'

beforeEach(() => {
  profileRepo.rows.length = 0
})

describe('applyResumeDerivedProfileDefaults', () => {
  it('creates a new profile row with the résumé-derived years when none exists yet', async () => {
    await applyResumeDerivedProfileDefaults(USER_ID, 10)

    expect(profileRepo.rows).toHaveLength(1)
    expect((profileRepo.rows[0] as unknown as { yearsOfExperience: number }).yearsOfExperience).toBe(10)
    expect((profileRepo.rows[0] as unknown as { userId: string }).userId).toBe(USER_ID)
  })

  it('fills yearsOfExperience on an existing profile that has not set it yet', async () => {
    profileRepo.rows.push({ id: 'p1', userId: USER_ID, yearsOfExperience: null } as never)

    await applyResumeDerivedProfileDefaults(USER_ID, 7)

    expect((profileRepo.rows[0] as unknown as { yearsOfExperience: number }).yearsOfExperience).toBe(7)
  })

  it('never overwrites a value the candidate (or a prior résumé upload) already set', async () => {
    profileRepo.rows.push({ id: 'p1', userId: USER_ID, yearsOfExperience: 15 } as never)

    await applyResumeDerivedProfileDefaults(USER_ID, 3)

    expect((profileRepo.rows[0] as unknown as { yearsOfExperience: number }).yearsOfExperience).toBe(15)
  })

  it('does nothing when the résumé parse could not compute a number', async () => {
    await applyResumeDerivedProfileDefaults(USER_ID, null)
    expect(profileRepo.rows).toHaveLength(0)
  })
})
