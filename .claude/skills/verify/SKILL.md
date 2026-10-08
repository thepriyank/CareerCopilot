---
name: verify
description: Build/launch/drive recipe for exercising Jobmagnate end-to-end through the real browser UI.
---

# Verifying Jobmagnate end-to-end

Surface is the browser (Next.js frontend + Express API underneath). Requires a real Postgres.

**This doc was last refreshed 2026-09-05 after a full live pass (real account, real resume, real free-tier
LLM calls, real job APIs) that fixed a dozen real bugs. Trust this over older memory of the codebase — several
previously-documented issues below are now fixed; don't re-diagnose them from scratch.**

## Launch

`.claude/launch.json` has both servers configured — `preview_start({name: "backend"})` (port 3001) and
`preview_start({name: "frontend"})` (port 3000). Backend needs `backend/.env` with a working `DATABASE_URL`;
it calls `process.exit(1)` on a failed DB connection, so check `preview_logs` for
`Database connected via TypeORM` before assuming it's up. `synchronize: true` auto-creates tables on boot —
no separate migration step needed for a fresh DB.

**Postgres**: check `docker ps -a` before creating a new container — a long-running container named
`hairing-postgres` (postgres:16-alpine) matching `backend/.env`'s `DATABASE_URL` exactly
(`postgres/postgres@127.0.0.1:5432/ai_career_copilot`) may already exist and auto-start with Docker Desktop.
Reuse it; don't stand up a second Postgres via a fresh `docker-compose.yml`, or you'll fight over port 5432.
It may carry stale test accounts/data from prior passes and orphaned pre-TypeORM-migration tables
(`"User"`, `"CandidateProfile"`, etc. — PascalCase, separate from the real snake_case `users`/`candidate_profiles`
tables) — harmless clutter, safe to leave or clean per the user's call (ask before dropping/wiping wholesale;
deleting one stale row by email is low-risk).

## Auth

No seed users exist, and there's no working `db:seed` script (was removed — it pointed at a nonexistent
`src/scripts/seed.ts`). Register through `/register` in the browser (real form, real bcrypt/JWT). Grab the
JWT via `localStorage.getItem('copilot_token')` in the browser to make authenticated `curl` calls alongside
the UI (e.g. to seed data the UI can't produce, see below).

## Free LLM providers — what actually works today

`backend/.env` and the repo-root `.env` have real keys for Groq, Cerebras, Gemini, Ollama Cloud, and
OpenRouter. As of the last live check:
- **Groq** (`openai/gpt-oss-20b`) — works.
- **Gemini** (`gemini-2.5-flash-lite`) — works, and is the most reliable fallback in practice.
- **Cerebras** — the configured key's account is payment-required (402) even on small models; not a code bug.
- **Ollama Cloud** — the configured key is rejected (401); expired/invalid, not a code bug.
- **OpenRouter** — free-tier model slugs 404 without a one-time $10 account credit (documented, expected).
- Paid providers (Anthropic/OpenAI/DeepSeek) are correctly disabled via `LLM_ALLOW_PAID=false` — leave it that way.

`providerRegistry.ts`'s default Groq/Cerebras model ids (`llama-3.3-70b-versatile`, `llama-3.3-70b`) were
**retired upstream** and have been updated to `openai/gpt-oss-20b` / `gpt-oss-120b`. If a provider starts
404ing again, it's likely another retired model id — check `GET https://api.<provider>/v1/models` with the
configured key before assuming it's a code bug.

## Fixed this pass (2026-09-05) — don't re-diagnose these

- **Onboarding NLU extraction was completely broken**: `STATE_SCHEMAS` in `profile.routes.ts` was keyed one
  state off from what `ONBOARDING_QUESTIONS` actually asks at each state, so almost nothing the user typed
  was ever extracted (the very first answer — target roles — was silently dropped entirely, since `WELCOME`
  had no schema at all). Fixed by realigning the schema map. Verify by walking `/onboarding` with real answers
  and checking `GET /api/profile` reflects them, not by reading the code alone.
- **Onboarding review screen ("Save & Continue") 400'd for every fresh profile**: `upsertProfileSchema` in
  `profile.routes.ts` required `summary`/`noticePeriod`/`visaStatus`/`salaryMin`/`salaryMax` to be `string`/
  `number` or `undefined`, but `ProfileCompletion.tsx` POSTs the whole fetched profile back including
  `null` for any field not yet set — a validation 400 that the frontend only logged to `console.error`,
  leaving the user stuck on the screen with no visible error. Fixed (`.nullable()` added) plus the frontend now
  shows the error inline instead of swallowing it.
- **Master resume enhancement / job tailoring hard-failed on any real resume** (`resumeEnhancer.ts`,
  `resumeTailorer.ts`): both prompts asked the model to echo the *entire* resume JSON back (skills, education,
  contact info included) just to get a rewritten summary + bullets, which reliably exceeded `maxTokens` and
  truncated mid-JSON on anything past a toy 1-job resume. Fixed by only sending/requesting the fields actually
  used (`{summary, experience: [{id, bullets}]}`) plus a higher `maxTokens` as defense-in-depth.
- **`PUT /api/resume/master/:id` dropped the `source` relation**, so every "Save changes" or "Regenerate"
  blanked the Original/Enhanced diff view for every bullet on the page (the editor computes the diff from
  `masterResume.source.extractedEntities`). Fixed by reloading with `relations: ['source']` after save,
  matching what `GET` and `/generate` already did.
- **Job descriptions were empty for every discovered job** (RemoteOK/WeWorkRemotely/Himalayas — the three
  highest-volume no-key providers): each provider's raw API response includes a real `description` field, but
  the provider code only mapped title/url/company/location, discarding it. Fixed — see `services/jobs/providers/text.ts`'s
  new `htmlToText()` (keeps paragraph/list-item line structure, unlike `stripHtml()` which collapses to one
  line — matters because `jdSkillGap.ts`'s bullet/section extraction is line-based). Greenhouse/Ashby/
  SmartRecruiters' *list* endpoints genuinely don't include descriptions (would need a per-job detail fetch,
  N+1 requests) — left as a known gap, not fixed.
- **Skill-gap extraction leaked garbage once a description had any real structure**: `jdSkillGap.ts`'s
  "end of requirements section" detection only recognized markdown `#` headings; real (HTML-stripped)
  descriptions have none, so the very first "Requirements" match never closed, and bullets from every later
  section (e.g. a per-city compensation table) got scanned as "skills" for the rest of the document. Fixed
  with a plain-text-aware boundary (ends on any non-bullet line once at least one bullet has been captured).
  A related fix in `htmlToText()` merges a `<li>` marker that lands on its own line when the `<li>` wraps a
  nested block element — otherwise that whole bullet was silently invisible to the same extractor.
- **RemoteOK mojibake** (`&amp;`/`Ã©`-style entity/encoding corruption in title/company/location) — fixed.
- **Discovered jobs' `isRemote` was always `null`** even for the three remote-only board providers — fixed
  (`true` for anything sourced from `remoteBoardProviders`).
- **Sidebar always showed "Maya Kapoor"** regardless of who was logged in (never called `GET /api/auth/me`)
  — fixed, now shows the real user.
- **`/resume/upload`'s review panel was 100% fake** (`MOCK_PARSE` hardcoded array — "Maya Kapoor · Senior
  Product Designer · ex-Stripe" — shown after every real upload regardless of what was actually parsed, plus a
  dead "Edit fields" button with no handler). Fixed by dropping the fake panel and redirecting to the real,
  working `/resume/[id]` review/edit UI on upload success — that page already had a correct, honest empty
  state and no fabricated fallback (that older bug — see below — is already fixed too).
- **Settings → API keys had a fully fabricated "Routing rules" / "Usage this month" / "Guardrails" section**
  (hardcoded per-task provider assignments like "Cover letter drafting → OpenAI · gpt-4.1", fake token/cost
  stats, decorative toggle switches) with zero backend wiring — actively misrepresented the real (single-field,
  free-provider-chain) architecture. Removed; only the real, working `ModelConnectionCard` remains on that tab.
- **Dead `/tailoring` page**: a fully static mockup (hardcoded "Maya Kapoor / Senior Product Designer" content,
  no `@/lib/api` import at all) duplicating the real, working per-job tailoring flow that already lives on
  `/jobs/[id]`. Removed, along with its nav entries in `Sidebar.tsx`/`MobileTabBar.tsx`.
- **`backend/package.json`'s `db:seed` script** pointed at a nonexistent file — removed rather than built,
  since real registration through the UI is the supported path.

## Already fixed before this pass (confirmed still fixed, no regression)

- `MasterResumeEditor.tsx`'s Regenerate no longer uses a blocking native `alert()` on failure.
- `/resume/[id]` no longer falls back to hardcoded mock content — honest states throughout, and
  `ParsedResumeView.tsx` is now wired up and in active use.
- The onboarding refresh-mid-flow regression (client-supplied state overriding persisted server state) is
  fixed — `profile.routes.ts` already treats `profile.onboardingState` as authoritative.

## Known remaining limitations (verified real, low priority — don't "fix" reflexively)

- `jdSkillGap.ts`'s regex skill-token extractor still produces real false positives on generic capitalized
  words in JD prose (`We`, `IC`, `AI`, `Good`, etc.) and can pull in skills from a genuinely irrelevant JD
  (e.g. a civil-engineering posting's `ACI`/`ASCE`/`AASHTO` acronyms) if you feed it non-software jobs. This is
  inherent to the zero-LLM design tradeoff, not a regression — don't chase it further without switching to an
  LLM- or taxonomy-based extractor, which is a real feature change, not a bug fix.
- Greenhouse/Ashby/SmartRecruiters' list endpoints have no `description` field at all (confirmed via their
  real APIs) — would need an N+1 per-job detail fetch per company to fix, meaningfully slower/heavier
  `discover` runs. Not attempted this pass.
- `pdf-parse@1.1.4` (the PDF text-extraction dependency) rejects small/simple PDFs from at least three
  independent generators (reportlab, pdfkit, fpdf2) with `bad XRef entry`, while reading complex real-world
  PDFs (Word/Docs exports) fine — a real third-party library limitation, not an app bug. **For e2e/manual
  test fixtures, use a `.docx` fixture instead of a hand-generated PDF** — `mammoth` doesn't share this
  issue. The user's own real, non-trivial resume PDF parses perfectly.
- Onboarding's Salary question now runs the candidate's raw answer through `parseSalaryRange` (the same
  k/L/lakh/lac-aware parser used for job postings) to correctly handle Indian shorthand like "40-55 LPA" —
  the LLM's own raw-digit extraction is only used as a fallback when that regex finds nothing. Currency
  detection still comes from the LLM and isn't independently cross-checked.

## Sample resume file

`backend/tests/e2e/fixtures/sample-resume.docx` — regenerate with
`npx ts-node tests/e2e/fixtures/generate-sample-resume.ts` (uses the `docx` npm package). Do **not** switch
this back to a hand-generated PDF (see the pdf-parse limitation above) without re-verifying it actually parses.

## File upload

The Claude_Browser tool (used for manual/interactive verification in this harness) still can't drive a native
OS file picker — `form_input` on a `type=file` throws `InvalidStateError`. Upload via `curl -F "file=@..."`
against `POST /api/resumes/upload` with the JWT from `localStorage` instead for manual passes.

**Playwright (the real e2e suite) does not have this limitation** — `page.setInputFiles('input[type="file"]', path)`
uploads for real, even though the input is hidden/triggered by a styled dropzone. Use it directly in specs.

## E2E suite

`backend/tests/e2e/golden-path.spec.ts` (Playwright, `backend/playwright.config.ts`) drives the full F0-F8
path through the real browser against real servers: register → upload/parse → onboarding chat → master resume
generate/approve → job discover/match → tailor + cover letter → approvals → skill-gap/roadmap → LinkedIn
review. Run with `npm run test:e2e` from `backend/` (starts both dev servers via Playwright's `webServer` if
not already running, `reuseExistingServer: true` if they are). Needs the same Postgres + free-LLM-key
prerequisites as everything else in this doc. Not wired into a CI workflow file yet — that's a deliberate
follow-up, not an oversight.

Steps run `describe.serial` sharing one browser tab/session — a `-g` grep filter that skips an earlier step
(e.g. running only the F5 test in isolation) will fail non-obviously (page never logged in) rather than
skip cleanly. Run the whole file, or grep from F0 onward.

## Worth re-checking each pass

- Re-verify the "known remaining limitations" above are still accurate before treating them as blockers —
  they were real and measured as of 2026-09-05, but provider APIs and account states (rate limits, key
  validity) drift over time independent of this codebase.
- **`POST /api/jobs/discover` no longer exists (2026-09-06).** Discovery is system-internal now — only
  `services/jobs/discoveryCron.ts`'s `discoverJobsGlobally()` calls the providers (Greenhouse, RemoteOK,
  WeWorkRemotely, Himalayas unconditionally, plus whichever seeded companies in
  `services/jobs/providers/seeds/india-companies.json` currently resolve), against the system-wide title list in
  `services/jobs/providers/seeds/target-job-titles.json`, not a candidate's own request. To re-verify this live,
  run `npx ts-node --transpile-only src/scripts/seedJobPool.ts` (a one-off trigger of the same logic the cron
  runs) rather than hitting an HTTP endpoint. A candidate's job board (`GET /api/jobs`) instead auto-surfaces whatever
  in the pool scores at/above `JOB_MATCH_MIN_SCORE` against their master résumé — see
  `services/matching/surfaceJobs.ts`. Confirm a second `GET /api/jobs` call for the same candidate doesn't
  re-attach or duplicate an already-surfaced job (idempotent by design).
