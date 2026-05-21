import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

dotenv.config()

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  cors: {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  },

  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
    generationModel: process.env.ANTHROPIC_GENERATION_MODEL ?? 'claude-sonnet-4-6',
  },

  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE ?? String(10 * 1024 * 1024), 10),
    allowedMimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  },
} as const

// Singleton Prisma client
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: config.nodeEnv === 'development' ? ['error', 'warn'] : ['error'],
  })

if (config.nodeEnv !== 'production') globalForPrisma.prisma = prisma
