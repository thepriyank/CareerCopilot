import { defineConfig, devices } from '@playwright/test'

/**
 * E2E config for the golden-path spec under tests/e2e/. Kept separate from
 * jest.config.ts (which only looks at tests/**\/*.test.ts) — these specs use
 * `.spec.ts` so the two runners never pick up each other's files.
 *
 * `webServer` starts both dev servers if they aren't already running
 * (reuseExistingServer lets `npm run test:e2e` work unchanged whether you're
 * iterating locally with servers already up, or running cold in CI). CI also
 * needs a real Postgres reachable at backend/.env's DATABASE_URL and at least
 * one free LLM provider key set — this config does not provision either.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev',
      cwd: __dirname,
      url: 'http://localhost:3001/health',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npm run dev',
      cwd: '../frontend',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
})
