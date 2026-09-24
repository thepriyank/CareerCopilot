import express from 'express'
import cors from 'cors'
import { config } from './config'
import routes from './routes'
import { errorHandler, createError } from './middleware/errorHandler'
import { isAllowedOrigin } from './config/corsOrigin'
import { logger } from './utils/logger'

const app = express()

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin, config.cors.origin)) callback(null, true)
      else callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
  })
)

app.use(
  express.json({
    limit: '10mb',
    // Stashes the exact bytes Express parsed, so the Razorpay webhook
    // (routes/razorpayWebhook.routes.ts) can HMAC-verify against the same
    // payload Razorpay signed — re-serializing req.body after parsing isn't
    // guaranteed to reproduce the identical bytes. Cheap for every other
    // route: just a Buffer reference, never read.
    verify: (req, _res, buf) => {
      ;(req as express.Request & { rawBody?: Buffer }).rawBody = buf
    },
  })
)
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Uploaded resume files are encrypted at rest and served only through the
// authenticated GET /api/resumes/file/:fileId route — no static mount.

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api', routes)
// Unknown routes: a JSON 404 through the error handler, instead of Express's
// default HTML page (which echoed the method + path back).
app.use((_req, _res, next) => next(createError(404, 'NOT_FOUND', "We couldn't find what you were looking for.")))
app.use(errorHandler)

import { AppDataSource } from './config/dataSource'
import { startDiscoveryCron } from './services/jobs/discoveryCron'
import { reloadCatalogCache } from './services/ai/catalog/modelCatalog'

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
    // Warm the LLM model catalog (NM-29) so the first AI call already uses
    // tested models; never blocks startup and never throws.
    void reloadCatalogCache()
  })
  .catch((err) => {
    logger.error('Database connection or migration failed', { err: err.message })
    process.exit(1)
  })

export default app
