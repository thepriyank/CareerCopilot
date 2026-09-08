// Runs before any test file is loaded (see jest.config.ts's `setupFiles`), so
// `config/index.ts`'s module-level env reads see this. Only sets it if unset
// — dotenv.config() itself never overrides an already-set process.env value,
// so a real .env in this directory still wins if one happens to be present.
process.env.SETTINGS_ENCRYPTION_KEY ??= 'ab'.repeat(32) // 64 hex chars = 32 bytes

// Force-cleared, not defaulted-if-unset: the test suite must be hermetic
// regardless of what a developer's real backend/.env points Redis at — a
// real REDIS_URL leaking in here means tests silently share rate-limit
// counters and cache entries with whatever's actually running locally
// (this bit us once: jobs.routes.test.ts's tailor tests started failing
// with 429s after enough real `POST /tailor` curl calls against the same
// Redis instance during manual verification exhausted the same user's
// real rate-limit counter that the tests' fake userId also hashed into).
process.env.REDIS_URL = ''

// Same reasoning, same bug shape, one day later: a real GCS_BUCKET_NAME in
// backend/.env made fileStorage.test.ts try to hit actual Google Cloud
// Storage instead of the local-disk backend it's meant to exercise — the
// storage backend a test runs against must not depend on what's configured
// for real local dev. Force-cleared so the local-disk backend is always
// what's under test here; gcsBackend.test.ts exercises the GCS backend
// directly with the SDK itself mocked, never a real network call either way.
process.env.GCS_BUCKET_NAME = ''
