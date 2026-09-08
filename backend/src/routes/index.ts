import { Router } from 'express'
import authRoutes from './auth.routes'
import resumeRoutes from './resume.routes'
import profileRoutes from './profile.routes'
import masterResumeRoutes from './masterResume.routes'
import jobsRoutes from './jobs.routes'
import settingsRoutes from './settings.routes'
import approvalsRoutes from './approvals.routes'
import linkedinRoutes from './linkedin.routes'
import skillGapsRoutes from './skillGaps.routes'
import dashboardRoutes from './dashboard.routes'
import accountRoutes from './account.routes'

const router = Router()

router.use('/auth', authRoutes)
router.use('/resumes', resumeRoutes)
router.use('/profile', profileRoutes)
router.use('/resume/master', masterResumeRoutes)
router.use('/jobs', jobsRoutes)
router.use('/settings', settingsRoutes)
router.use('/approvals', approvalsRoutes)
router.use('/linkedin', linkedinRoutes)
router.use('/skill-gaps', skillGapsRoutes)
router.use('/dashboard', dashboardRoutes)
router.use('/account', accountRoutes)

export default router
