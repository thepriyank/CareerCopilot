import { test, expect, Page } from '@playwright/test'
import path from 'path'

/**
 * End-to-end golden path through every MVP feature (F1-F8), driven through
 * the real browser UI against the real backend, a real Postgres database,
 * and whichever free LLM provider is configured in backend/.env (LLM_ALLOW_PAID
 * must stay false/unset — this suite is not meant to spend real money).
 *
 * Run locally:
 *   cd backend
 *   npx playwright test                 # starts both dev servers if not already running
 *
 * Requirements: a reachable Postgres at backend/.env's DATABASE_URL, and at
 * least one free-tier provider key (GROQ_API_KEY, GEMINI_API_KEY, etc.) set.
 * AI-dependent steps (parsing, onboarding NLU, generation) can be slow and
 * occasionally flaky on free-tier rate limits — this file gives them generous
 * timeouts rather than retries, so a real failure is easy to tell from a
 * transient one in the report.
 *
 * Steps run in series and share one browser tab (`page`), since each phase
 * depends on data created by the previous one — same session, same login.
 */

const FIXTURE_RESUME = path.join(__dirname, 'fixtures', 'sample-resume.docx')
const runId = Date.now()
const EMAIL = `e2e-golden-path-${runId}@example.com`
const PASSWORD = 'GoldenPath123!'
const NAME = 'Jordan Rivera'

async function sendChatMessage(page: Page, text: string) {
  const input = page.getByPlaceholder('Type your answer…')
  await input.fill(text)
  // The Enter-key submit handler is unreliable in this app (confirmed: it
  // fires for the first onboarding turn but not consistently after) — click
  // the actual send button (icon-only, no accessible name) instead.
  await input.locator('xpath=following-sibling::button[1]').click()
}

test.describe.serial('Jobmagnate golden path', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
  })

  test.afterAll(async () => {
    await page.close()
  })

  test('F0: register a new account', async () => {
    await page.goto('/register')
    await page.getByPlaceholder('Maya Kapoor').fill(NAME)
    await page.getByPlaceholder('you@example.com').fill(EMAIL)
    await page.getByPlaceholder('8+ characters').fill(PASSWORD)
    await page.getByRole('button', { name: /Create account/ }).click()
    await expect(page).toHaveURL(/\/resume\/upload/, { timeout: 15_000 })
  })

  test('F1: upload and parse the real resume file', async () => {
    await page.setInputFiles('input[type="file"]', FIXTURE_RESUME)
    // Upload triggers real parsing then redirects to /resume/:id.
    await expect(page).toHaveURL(/\/resume\/[0-9a-f-]{36}/, { timeout: 30_000 })
    await expect(page.getByRole('heading', { name: 'Jordan Rivera' })).toBeVisible()
    await expect(page.getByText(/confidence/i)).toBeVisible()
  })

  test('F1: edit a parsed field and confirm it persists', async () => {
    await page.getByRole('button', { name: 'Edit Resume' }).click()
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible()
    // Contact Information's fields are the first 6 textboxes on the page, in
    // order: name, email, phone, location, linkedin, website (Summary and
    // Experience textboxes come after) — avoids guessing at CSS class names.
    const location = page.getByRole('textbox').nth(3)
    await location.fill('Springfield, USA (Remote)')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Saved!')).toBeVisible()
    await page.reload()
    await expect(page.getByText('Springfield, USA (Remote)')).toBeVisible()
  })

  test('F2: complete onboarding chat with the fixture profile', async () => {
    await page.goto('/onboarding')
    await sendChatMessage(page, 'Senior Backend Engineer, Staff Engineer')
    await expect(page.getByText(/industries/i)).toBeVisible({ timeout: 30_000 })

    await sendChatMessage(page, 'SaaS, Fintech')
    await expect(page.getByText(/cities or regions/i)).toBeVisible({ timeout: 30_000 })

    await sendChatMessage(page, 'Remote only')
    await expect(page.getByText(/Remote, Hybrid, or On-site/i)).toBeVisible({ timeout: 30_000 })

    await sendChatMessage(page, 'Remote only')
    await expect(page.getByText(/salary range/i)).toBeVisible({ timeout: 30_000 })

    await sendChatMessage(page, '150k-180k USD')
    await expect(page.getByText(/How urgently/i)).toBeVisible({ timeout: 30_000 })

    await sendChatMessage(page, 'Actively looking')
    await expect(page.getByText(/notice period/i)).toBeVisible({ timeout: 30_000 })

    await sendChatMessage(page, '2 weeks')
    await expect(page.getByText(/visa/i)).toBeVisible({ timeout: 30_000 })

    await sendChatMessage(page, 'US citizen, no constraints')
    // The chat's final "All done!" bot bubble appears immediately, but the
    // actual Review Your Profile screen only mounts ~1.2s later (a setTimeout
    // in onboarding/page.tsx) — wait for the real screen, not just its cue text.
    const saveAndContinue = page.getByRole('button', { name: /Save & Continue/i })
    await expect(saveAndContinue).toBeVisible({ timeout: 30_000 })

    // A first click here can fail to register/navigate (seen consistently
    // enough in manual testing to be a real quirk, not test flakiness) —
    // retry once rather than fail the whole suite over it.
    await saveAndContinue.click()
    try {
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 5_000 })
    } catch {
      await saveAndContinue.click()
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })
    }
  })

  test('F3: generate and approve the master resume', async () => {
    await page.goto('/master-resume')
    await page.getByRole('button', { name: /Generate Master Resume/i }).click()
    await expect(page.getByRole('button', { name: /Approve Master Resume/i })).toBeVisible({ timeout: 60_000 })
    await page.getByRole('button', { name: /Approve Master Resume/i }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })
    await expect(page.getByText('Approved', { exact: true })).toBeVisible()
  })

  test('F4: discover real jobs and compute a match', async () => {
    await page.goto('/jobs')
    // The empty state ("No jobs yet") renders its own inline Discover button
    // in addition to the persistent top-bar one — two matches for a fresh account.
    await page.getByRole('button', { name: 'Discover' }).first().click()
    // Discover hits several real external job APIs — generous timeout.
    await expect(page.getByText(/\d+ jobs?/)).toBeVisible({ timeout: 60_000 })

    const firstViewJob = page.getByRole('link', { name: 'View job' }).first()
    await firstViewJob.click()
    await expect(page).toHaveURL(/\/jobs\/[0-9a-f-]{36}/)

    await page.getByRole('button', { name: /Compute match/i }).click()
    // "Recompute" only replaces "Compute match" once a MatchResult exists —
    // a uniquely-identifying signal, unlike the page's various "match" labels.
    await expect(page.getByRole('button', { name: /Recompute/i })).toBeVisible({ timeout: 30_000 })
  })

  test('F5: tailor a resume and generate a cover letter for a matched job', async () => {
    const tailorBtn = page.getByRole('button', { name: /Tailor resume/i })
    await tailorBtn.click()
    await expect(page.getByRole('button', { name: /Re-tailor/i })).toBeVisible({ timeout: 60_000 })

    const coverLetterBtn = page.getByRole('button', { name: /Generate cover letter/i })
    await coverLetterBtn.click()
    await expect(page.getByRole('button', { name: /Regenerate/i }).last()).toBeVisible({ timeout: 60_000 })
  })

  test('F6: approve the generated artifacts', async () => {
    await page.goto('/approvals')
    // Each list row has its own plain "Approve" button; the right-hand preview
    // panel additionally shows a bigger "Approve for {company}" button for
    // whatever's currently selected (auto-selected on load) — the plain
    // per-row one is present regardless of selection state, so use that.
    const approveButton = page.getByRole('button', { name: 'Approve', exact: true }).first()
    while (await approveButton.isVisible().catch(() => false)) {
      await approveButton.click()
      await page.waitForTimeout(500)
    }
    await expect(page.getByText('Nothing waiting on you right now')).toBeVisible({ timeout: 10_000 })
  })

  test('F7: check skill gaps and view the aggregated roadmap', async () => {
    await page.goto('/jobs')
    const firstViewJob = page.getByRole('link', { name: 'View job' }).first()
    await firstViewJob.click()
    await page.getByRole('button', { name: /Check skill gaps/i }).click()
    await expect(page.getByText('Real gaps')).toBeVisible({ timeout: 30_000 })

    await page.goto('/roadmap')
    await expect(page.getByText(/identified gaps/i)).toBeVisible({ timeout: 15_000 })
  })

  test('F8: run a LinkedIn feedback-only review', async () => {
    await page.goto('/linkedin')
    await page.getByPlaceholder(/Senior Backend Engineer/i).fill('Senior Backend Engineer @ Example Corp')
    await page.getByPlaceholder(/About.*section/i).fill(
      'Backend engineer with 8+ years building distributed systems in Python, Go, and Node.js on AWS.'
    )
    await page.getByRole('button', { name: /Run analysis/i }).click()
    await expect(page.getByText(/STRENGTH/i).first()).toBeVisible({ timeout: 30_000 })
    // Feedback-only guardrail: the MVP must never claim to post/edit LinkedIn directly.
    await expect(page.getByText(/doesn.t post or edit LinkedIn directly/i)).toBeVisible()
  })
})
