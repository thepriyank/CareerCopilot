import path from 'path'
import dotenv from 'dotenv'
import { resolveChain } from '../services/ai/providerRegistry'

// backend/.env wins; the repo-root .env only fills gaps (dotenv never
// overrides an already-set process.env value). This lets shared keys live at
// the repo root while backend-specific overrides stay in backend/.env.
dotenv.config()
dotenv.config({ path: path.resolve(__dirname, '../../..', '.env') })

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

  // Optional platform-default fallback, tried before the Anthropic key above.
  // model is a specific OpenRouter model id or a "@preset/..." reference.
  // Retained for back-compat; the provider chain in `llm` below is the real
  // mechanism now and picks OpenRouter up from OPENROUTER_API_KEY directly.
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY ?? '',
    model: process.env.OPENROUTER_PRESET ?? process.env.OPENROUTER_MODEL ?? '',
  },

  // The platform LLM provider chain. `generate()` walks `providers` in order,
  // using the first that answers; every free-tier provider is tried before any
  // paid one, and a provider that hits its rate limit is benched for
  // `cooldownMs` before it's tried again. See services/ai/providerRegistry.ts.
  llm: {
    providers: resolveChain(process.env),
    // How long a rate-limited / quota-exhausted provider stays benched when the
    // response carries no Retry-After header. Default 15 minutes.
    cooldownMs: parseInt(process.env.LLM_COOLDOWN_MS ?? String(15 * 60 * 1000), 10),
    // Paid providers (Anthropic, OpenAI) are only ever used when this is set —
    // guards against surprise spend during local dev.
    allowPaid: /^(1|true|yes|on)$/i.test((process.env.LLM_ALLOW_PAID ?? '').trim()),
  },

  // Optional: only the "save your own model connection" Settings feature
  // needs this. Its absence must never crash the app — it just means that
  // one feature returns a clear "not configured" error until it's set.
  settingsEncryptionKey: process.env.SETTINGS_ENCRYPTION_KEY ?? '',

  // Twice-daily background refresh of the shared job pool — see
  // services/jobs/discoveryCron.ts / discoveryService.ts's
  // discoverJobsGlobally(). System-wide, not per-candidate (2026-09-06
  // product decision: "this is an internal feature and should be only
  // handled by our system") — there is no HTTP route or UI control for
  // this; only the cron calls it. Defaults to firing at 1:30 and 11:30 UTC
  // (7:00am / 5:00pm IST); override with a standard 5-field cron
  // expression, or set enabled=false to turn it off entirely.
  jobDiscovery: {
    cronEnabled: /^(1|true|yes|on)$/i.test((process.env.JOB_DISCOVERY_CRON_ENABLED ?? '').trim()),
    cronSchedule: process.env.JOB_DISCOVERY_CRON_SCHEDULE ?? '30 1,11 * * *',
  },

  // How the shared job pool gets filtered into one candidate's board — see
  // services/matching/surfaceJobs.ts. minScoreToSurface is the bar a pool
  // listing must clear (out of 100) to be worth showing a candidate at all;
  // maxListingsToScore bounds how much of the pool one `GET /api/jobs` call
  // rescans (see that file's scale note).
  //
  // 38, recalibrated 2026-09-13 after removing lexical/text similarity from
  // the score entirely (matchScore.ts's v3 formula — skillCoverage 2/3 +
  // preferenceFit 1/3, product decision: whole-résumé-vs-whole-JD text
  // similarity was a weak, noisy signal that reliably dragged down
  // genuinely strong skill matches). That change shifts the whole score
  // distribution upward and made the old 32 (calibrated for the v2/lexical-
  // heavy formula) far too permissive — validated live against the real
  // staging pool (509 listings, a 74-skill résumé): 32 would have surfaced
  // 43% of the pool. Inspected real titles/scores band by band; 38 is the
  // point below which relevance visibly drops off (a Frontend/Full-Stack/
  // Backend Engineer role with real, verified skill overlap sits at 38+;
  // below it the pool gets noticeably noisier — mismatched stacks, weak
  // overlap), surfacing a curated ~27% instead. Same calibration also
  // caught and fixed a real inversion: a job with a totally failed skill
  // extraction (0 skills, `computeSkillCoverage`'s neutral default) was
  // outscoring jobs with genuine partial overlap once skills became the
  // dominant weight — the neutral default dropped from 0.5 to 0.3 to fix
  // it (see matchScore.ts). Not a proof this holds for every résumé/pool
  // combination — revisit if real usage shows it's too strict or too loose.
  matching: {
    minScoreToSurface: parseInt(process.env.JOB_MATCH_MIN_SCORE ?? '38', 10),
    maxListingsToScore: parseInt(process.env.JOB_MATCH_MAX_LISTINGS_TO_SCORE ?? '500', 10),
  },

  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE ?? String(10 * 1024 * 1024), 10),
    allowedMimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  },

  // Firebase Admin — verifies the ID token a client gets from Firebase Auth
  // after Google sign-in (see services/auth/firebaseAdmin.ts,
  // routes/auth.routes.ts's POST /google). Same credential-resolution
  // pattern as GCS: FIREBASE_KEY_FILE (a service-account JSON key path,
  // conventionally under backend/secrets/ — see .gitignore) or
  // FIREBASE_CREDENTIALS_JSON (inlined) if set, else Application Default
  // Credentials. Unset FIREBASE_PROJECT_ID → POST /google returns a clear
  // "not configured" error; nothing else in the app is affected.
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID ?? '',
    keyFile: process.env.FIREBASE_KEY_FILE ?? '',
    credentialsJson: process.env.FIREBASE_CREDENTIALS_JSON ?? '',
  },

  // Redis — shared LLM-response cache + per-user rate limiting (see
  // services/cache/, middleware/rateLimit.ts). Unset REDIS_URL → both
  // degrade to a no-op, same as every other optional integration here.
  redis: {
    url: process.env.REDIS_URL ?? '',
    llmCacheTtlSeconds: parseInt(process.env.LLM_CACHE_TTL_SECONDS ?? String(60 * 60), 10),
  },

  // Per-user rate limit on the routes that call an LLM (tailor, cover
  // letter, master-resume generate/regenerate, LinkedIn review) — one
  // enthusiastic or scripted user must not be able to burn the shared
  // free-tier LLM budget for everyone else. No-ops when Redis is
  // unavailable (see middleware/rateLimit.ts) — fails open, not closed:
  // losing rate-limiting during a Redis hiccup is preferable to losing the
  // feature entirely.
  rateLimit: {
    llmRequestsPerWindow: parseInt(process.env.LLM_RATE_LIMIT_MAX ?? '20', 10),
    windowSeconds: parseInt(process.env.LLM_RATE_LIMIT_WINDOW_SECONDS ?? String(60 * 60), 10),
  },

  // Uploaded-résumé storage backend — see services/storage/fileStorage.ts.
  // Local disk (the default) whenever GCS_BUCKET_NAME is unset, so this is
  // a strict opt-in with zero effect on local dev until it's configured.
  // Credentials resolve the same way the @google-cloud/storage SDK always
  // does: GCS_KEY_FILE (a service-account JSON key path) or
  // GCS_CREDENTIALS_JSON (the key inlined, for a PaaS target with no
  // persistent filesystem) if set, else Application Default Credentials.
  gcs: {
    bucketName: process.env.GCS_BUCKET_NAME ?? '',
    projectId: process.env.GCS_PROJECT_ID ?? '',
    keyFile: process.env.GCS_KEY_FILE ?? '',
    credentialsJson: process.env.GCS_CREDENTIALS_JSON ?? '',
  },

  // Shared-secret auth for POST /api/internal/jobs/ingest — the local
  // JobSpy scraper (scripts/jobspy-ingest/) posts jobs here directly since
  // it runs as its own process outside this app, on whatever machine has
  // this repo cloned (see that script's README). Unset token → the route
  // rejects every request (fail closed, not open) rather than defaulting to
  // no auth at all.
  internalIngest: {
    token: process.env.INTERNAL_INGEST_TOKEN ?? '',
  },
} as const
