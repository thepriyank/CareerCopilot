# JobMagnate — Assisted Apply extension

MV3 browser extension that fills job-application forms with your JobMagnate
profile. You review every field and click submit yourself — the extension
has no code path that does that for you (enforced by
`tests/noAutoSubmit.test.ts`, not just documented).

See `docs/assisted_apply_extension_plan.md` (repo root) for the full design.
This is v1: **Tier 2 only** — generic LLM-based field mapping for any
employer-hosted form, no per-ATS adapters. Text fields only; résumé/cover-
letter file attachment is a follow-up (see "What's not here yet" below).

## Local dev

```bash
npm install
npm run dev     # builds dist/, pointed at http://localhost:3001 (backend) and
                 # http://localhost:3000 (frontend), rebuilds on change
```

Then in Chrome: `chrome://extensions` → enable **Developer mode** → **Load
unpacked** → select `extension/dist`.

`npm run build` builds once against the production API/web URLs baked into
`scripts/build.mjs`'s defaults — override with `--api=` / `--web=` flags
(see the `dev` script for the local-dev example).

## Connecting it to an account

Two ways to get a token into the extension — same underlying token either way:

**A — via the connect page (nicer, needs `NEXT_PUBLIC_EXTENSION_ID` set):**
1. Log in on the web app, visit `/extension/connect`, click **Approve**.
2. If `NEXT_PUBLIC_EXTENSION_ID` (frontend `.env.local`) is set to this
   unpacked extension's real id (`chrome://extensions` shows it once
   loaded), the page hands the token to the extension automatically.
   Otherwise it falls back to showing the token once — copy it and use B.

**B — paste it directly into the popup (always works, no setup):**
1. Mint a token from Settings → Extensions in the web app (or from the
   connect page above) and copy it.
2. Open the extension's popup — the "Not connected" state has a **paste a
   token** field right there. Paste it, click **Use this token**.
3. The popup validates it against the backend before confirming — a typo or
   an already-revoked token fails immediately with a clear message, not a
   silent "connected" that breaks later.

Either way, the popup should now show your email and remaining autofill count.

## Using it

Open a job application form on an employer-hosted ATS (not LinkedIn, Naukri,
Indeed, Glassdoor or Wellfound — see "What's excluded" below) and either:
- click the extension's toolbar icon, or
- open the popup and click **Fill this form**.

Both do the same thing: inject the content script, extract the form's
schema, ask the backend to map it (cached — instant after the first time any
form with this exact shape is seen) and resolve your fill data, then fill
whatever matched. Screening/EEO/custom questions are deliberately left
alone — review the popup's result message, then read the whole form before
you submit.

## What's not here yet

- **Résumé/cover-letter file attachment.** The mapping vocabulary already
  includes `resume`/`coverLetter`, and the backend already resolves which
  approved artifact to use (`GET /api/extension/jobs/:id/artifacts`) — but
  the content script currently skips filling those two keys, and the
  download routes (`/api/resumes/file/:id`, `/api/resume/master/:id/pdf`,
  etc.) are still session-JWT-only, not extension-token-authed. `attachFile`
  in `src/lib/domFill.ts` is written and ready for when that lands.
- **Auto-detect + badge.** Right now filling is always a manual click
  (toolbar icon or popup button), never automatic on page load.
- **Job identification picker.** The backend already returns a candidate
  shortlist (`GET /api/extension/jobs/resolve`) when a form's URL doesn't
  match a saved job, but nothing in the UI surfaces it yet — an unresolved
  job just fills profile fields with no job-specific artifacts.
- **"Mark as applied."** `POST /api/extension/applications` exists; nothing
  calls it yet.
- Icons (`manifest.json` has none — Chrome shows a default). Needed before
  a real Chrome Web Store listing, not for local dev.

## What's excluded, and why

`boards.greenhouse.io`, `*.myworkdayjobs.com`, `*.smartrecruiters.com`, and
similar employer-hosted ATS forms — anything. LinkedIn, Naukri, Indeed,
Glassdoor and Wellfound/AngelList are blocked **server-side**
(`backend/src/services/extension/excludedDomains.ts`), not just left
unbuilt — the mapper is domain-agnostic by design, so this has to be an
active refusal, not an accident of scope. See `BRD.md` §9–§11 and the
"Field mapping" section of the plan doc for the reasoning; under discussion
as of 2026-09-14.

## Testing

```bash
npm test          # vitest — schema extraction, DOM filling, the no-submit
                   # guardrail
npm run typecheck
```

There is no automated test for the actual browser runtime (message passing,
`chrome.scripting.executeScript`, a real ATS's DOM) — that needs the
load-unpacked loop above against a real form. Fixture-based DOM tests here
cover the parts that don't need a live extension context.

## Repo layout

```
extension/
  manifest.json        MV3 manifest — no host_permissions/content_scripts;
                        activeTab + on-demand injection instead (narrower,
                        review-friendlier, and works on literally any site)
  scripts/build.mjs     esbuild bundling + dist/ assembly
  src/
    background/         service worker — token, all network calls, orchestration
    content/             DOM-only: schema extraction, filling, highlighting
    popup/                connect/status/manual-fill UI
    lib/                  pure, unit-tested: schemaExtraction, domFill, fieldSchema
  tests/                 vitest + jsdom
```

No `wxt` / `@crxjs/vite-plugin` (the plan doc's suggestion) — a service
worker plus two plain scripts don't need a bundler with opinions about
manifest generation; esbuild bundling a manifest we already own by hand is
fewer moving parts to debug without a live reload loop.
