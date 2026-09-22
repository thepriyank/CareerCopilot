import { createFakeRepo } from './testUtils/fakeRepo'
import { Plan, NotificationType } from '../../src/entities/enums'

const userRepo = createFakeRepo()
const notificationRepo = createFakeRepo()

jest.mock('../../src/config/dataSource', () => {
  const { User } = require('../../src/entities/User')
  const { Notification } = require('../../src/entities/Notification')
  return {
    AppDataSource: {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === User) return userRepo
        if (entity === Notification) return notificationRepo
        throw new Error(`No fake repo registered for entity: ${entity}`)
      }),
    },
  }
})

import { createPassExpiryNotifications, PASS_EXPIRY_WARNING_DAYS } from '../../src/services/notifications/passExpiryNotifier'

const DAY_MS = 24 * 60 * 60 * 1000

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY_MS)
}

beforeEach(() => {
  userRepo.rows.length = 0
  notificationRepo.rows.length = 0
})

describe('createPassExpiryNotifications', () => {
  it(`creates a PASS_EXPIRING notification for a PREMIUM user expiring within ${PASS_EXPIRY_WARNING_DAYS} days`, async () => {
    userRepo.rows.push({ id: 'user-1', plan: Plan.PREMIUM, planExpiresAt: daysFromNow(2) } as never)

    const created = await createPassExpiryNotifications()

    expect(created).toBe(1)
    expect(notificationRepo.rows).toHaveLength(1)
    expect((notificationRepo.rows[0] as any).userId).toBe('user-1')
    expect((notificationRepo.rows[0] as any).type).toBe(NotificationType.PASS_EXPIRING)
    expect((notificationRepo.rows[0] as any).readAt).toBeNull()
  })

  it('does not notify a user expiring further out than the warning window', async () => {
    userRepo.rows.push({ id: 'user-1', plan: Plan.PREMIUM, planExpiresAt: daysFromNow(10) } as never)

    const created = await createPassExpiryNotifications()

    expect(created).toBe(0)
    expect(notificationRepo.rows).toHaveLength(0)
  })

  it('does not notify a user whose pass already expired', async () => {
    userRepo.rows.push({ id: 'user-1', plan: Plan.PREMIUM, planExpiresAt: daysFromNow(-1) } as never)

    const created = await createPassExpiryNotifications()

    expect(created).toBe(0)
  })

  it('does not notify a FREE user, even with a stale planExpiresAt', async () => {
    userRepo.rows.push({ id: 'user-1', plan: Plan.FREE, planExpiresAt: daysFromNow(2) } as never)

    const created = await createPassExpiryNotifications()

    expect(created).toBe(0)
  })

  it('is idempotent for the same exact expiry — a second run does not duplicate the notification', async () => {
    const expiresAt = daysFromNow(2)
    userRepo.rows.push({ id: 'user-1', plan: Plan.PREMIUM, planExpiresAt: expiresAt } as never)

    const first = await createPassExpiryNotifications()
    const second = await createPassExpiryNotifications()

    expect(first).toBe(1)
    expect(second).toBe(0)
    expect(notificationRepo.rows).toHaveLength(1)
  })

  it('notifies again if the pass was renewed to a new expiry after an earlier warning', async () => {
    userRepo.rows.push({ id: 'user-1', plan: Plan.PREMIUM, planExpiresAt: daysFromNow(2) } as never)
    await createPassExpiryNotifications()
    expect(notificationRepo.rows).toHaveLength(1)

    // Renewed to a fresh, later expiry that's now also within the window.
    ;(userRepo.rows[0] as any).planExpiresAt = daysFromNow(1)
    const second = await createPassExpiryNotifications()

    expect(second).toBe(1)
    expect(notificationRepo.rows).toHaveLength(2)
  })
})
