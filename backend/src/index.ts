import express from 'express'
import cors from 'cors'
import path from 'path'
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

// Serve uploaded files (requires auth in production; fine for MVP dev)
app.use('/uploads', express.static(path.resolve(process.cwd(), config.upload.uploadDir)))

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api', routes)
app.use(errorHandler)

app.listen(config.port, () => {
  logger.info(`AI Career Copilot API running on http://localhost:${config.port}`)
})

export default app
