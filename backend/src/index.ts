import express from 'express'
import cors from 'cors'
import { config } from './config'
import routes from './routes'
import { errorHandler } from './middleware/errorHandler'
import { logger } from './utils/logger'

const app = express()

app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
  })
)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Uploaded resume files are encrypted at rest and served only through the
// authenticated GET /api/resumes/file/:fileId route — no static mount.

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api', routes)
app.use(errorHandler)

import { AppDataSource } from './config/dataSource'
import { startDiscoveryCron } from './services/jobs/discoveryCron'

AppDataSource.initialize()
  .then(async () => {
    logger.info('Database connected via TypeORM')
    // synchronize is retired (2026-09-07) — schema changes are committed
    // migrations under src/migrations/, run here on every boot so `npm run
    // dev` still "just works" with no manual step. A no-op when everything
    // is already applied.
    const applied = await AppDataSource.runMigrations()
    if (applied.length > 0) {
      logger.info(`Ran ${applied.length} pending migration(s): ${applied.map((m) => m.name).join(', ')}`)
    }
    app.listen(config.port, () => {
      logger.info(`Jobmagnate API running on http://localhost:${config.port}`)
    })
    startDiscoveryCron()
  })
  .catch((err) => {
    logger.error('Database connection or migration failed', { err: err.message })
    process.exit(1)
  })

export default app
