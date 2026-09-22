import express from 'express'
import request from 'supertest'
import { signToken } from '../../src/middleware/auth'
import { errorHandler } from '../../src/middleware/errorHandler'
import { NotificationType } from '../../src/entities/enums'
import { createFakeRepo } from './testUtils/fakeRepo'

const notificationRepo = createFakeRepo()

jest.mock('../../src/config/dataSource', () => {
  const { Notification } = require('../../src/entities/Notification')
  return {
    AppDataSource: {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Notification) return notificationRepo
        throw new Error(`No fake repo registered for entity: ${entity}`)
      }),
    },
  }
})

import notificationsRoutes from '../../src/routes/notifications.routes'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/notifications', notificationsRoutes)
  app.use(errorHandler)
  return app
}

const USER_ID = 'user-1'
const OTHER_USER_ID = 'user-2'
const token = signToken(USER_ID, 'FREE')

beforeEach(() => {
  notificationRepo.rows.length = 0
})

describe('GET /api/notifications', () => {
  it('rejects unauthenticated requests', async () => {
    const app = buildApp()
    const res = await request(app).get('/api/notifications')
    expect(res.status).toBe(401)
  })

  it("returns only the caller's notifications, most recent first, with an unread count", async () => {
    const app = buildApp()
    await notificationRepo.save(notificationRepo.create({ userId: USER_ID, type: NotificationType.PASS_EXPIRING, title: 'Older', body: 'x', meta: null, readAt: null, createdAt: new Date('2026-01-01') }))
    await notificationRepo.save(notificationRepo.create({ userId: USER_ID, type: NotificationType.PASS_EXPIRING, title: 'Newer', body: 'x', meta: null, readAt: new Date('2026-01-02'), createdAt: new Date('2026-01-02') }))
    await notificationRepo.save(notificationRepo.create({ userId: OTHER_USER_ID, type: NotificationType.PASS_EXPIRING, title: 'Not mine', body: 'x', meta: null, readAt: null, createdAt: new Date('2026-01-03') }))

    const res = await request(app).get('/api/notifications').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.notifications).toHaveLength(2)
    expect(res.body.notifications[0].title).toBe('Newer')
    expect(res.body.notifications[1].title).toBe('Older')
    expect(res.body.unreadCount).toBe(1)
  })
})

describe('POST /api/notifications/:id/read', () => {
  it('404s for a notification that does not belong to the caller', async () => {
    const app = buildApp()
    const row = await notificationRepo.save(
      notificationRepo.create({ userId: OTHER_USER_ID, type: NotificationType.PASS_EXPIRING, title: 'x', body: 'x', meta: null, readAt: null })
    )

    const res = await request(app).post(`/api/notifications/${row.id}/read`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('marks a notification read, setting readAt', async () => {
    const app = buildApp()
    const row = await notificationRepo.save(
      notificationRepo.create({ userId: USER_ID, type: NotificationType.PASS_EXPIRING, title: 'x', body: 'x', meta: null, readAt: null })
    )

    const res = await request(app).post(`/api/notifications/${row.id}/read`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.notification.readAt).not.toBeNull()

    const listRes = await request(app).get('/api/notifications').set('Authorization', `Bearer ${token}`)
    expect(listRes.body.unreadCount).toBe(0)
  })
})

describe('POST /api/notifications/read-all', () => {
  it("marks every one of the caller's unread notifications read, leaving other users' untouched", async () => {
    const app = buildApp()
    await notificationRepo.save(notificationRepo.create({ userId: USER_ID, type: NotificationType.PASS_EXPIRING, title: 'a', body: 'x', meta: null, readAt: null }))
    await notificationRepo.save(notificationRepo.create({ userId: USER_ID, type: NotificationType.PASS_EXPIRING, title: 'b', body: 'x', meta: null, readAt: null }))
    await notificationRepo.save(notificationRepo.create({ userId: OTHER_USER_ID, type: NotificationType.PASS_EXPIRING, title: 'c', body: 'x', meta: null, readAt: null }))

    const res = await request(app).post('/api/notifications/read-all').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)

    const mine = notificationRepo.rows.filter((r: any) => r.userId === USER_ID)
    expect(mine.every((r: any) => r.readAt !== null)).toBe(true)
    const other = notificationRepo.rows.find((r: any) => r.userId === OTHER_USER_ID) as any
    expect(other.readAt).toBeNull()
  })
})
