import { Router } from 'express'
import authRoutes from './auth.routes'
import resumeRoutes from './resume.routes'
import profileRoutes from './profile.routes'

const router = Router()

router.use('/auth', authRoutes)
router.use('/resumes', resumeRoutes)
router.use('/profile', profileRoutes)

export default router
