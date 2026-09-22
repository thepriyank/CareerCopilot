import { Router, Response, NextFunction } from 'express'
import { IsNull } from 'typeorm'
import { AppDataSource } from '../config/dataSource'
import { Notification } from '../entities/Notification'
import { requireAuth } from '../middleware/auth'
import { createError } from '../middleware/errorHandler'
import { AuthRequest } from '../types'

const router = Router()
router.use(requireAuth)

// GET /api/notifications — most recent first, capped at 30. `unreadCount`
// is computed separately (not `.length` of unread in this page) so a
// client showing a badge doesn't need to page through everything to get
// an accurate count.
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    const repo = AppDataSource.getRepository(Notification)

    const [notifications, unreadCount] = await Promise.all([
      repo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 30 }),
      repo.count({ where: { userId, readAt: IsNull() } }),
    ])

    res.json({ notifications, unreadCount })
  } catch (err) {
    next(err)
  }
})

// POST /api/notifications/:id/read
router.post('/:id/read', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    const repo = AppDataSource.getRepository(Notification)
    const notification = await repo.findOneBy({ id: req.params.id as string, userId })
    if (!notification) throw createError(404, 'NOT_FOUND', 'Notification not found')

    if (!notification.readAt) {
      notification.readAt = new Date()
      await repo.save(notification)
    }

    res.json({ notification })
  } catch (err) {
    next(err)
  }
})

// POST /api/notifications/read-all
router.post('/read-all', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    const repo = AppDataSource.getRepository(Notification)
    await repo.update({ userId, readAt: IsNull() }, { readAt: new Date() })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
