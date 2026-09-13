# Assisted Apply — browser extension (post-MVP)

**Status:** planned, not started. Explicitly **post-MVP** — the MVP is live
and being marketed; nothing here competes for that runway.

## Context

Candidates re-type the same twenty fields into every application form. That
is the single most tedious part of a job hunt and the most obvious place to
save them real time. This document plans a **browser extension that fills
those forms in the candidate's own browser**, with the candidate reviewing
and clicking submit themselves.

### Why an extension, and not server-side automation

Three independent reasons, any one of which is sufficient:

1. **`BRD.md` §11 forbids the credential-based version.** Auto-apply is
   Phase 3 and gated on OAuth-only integration, a written per-platform ToS
   review, a security audit, and per-application human confirmation.
   Server-side form-filling of an authenticated session is exactly what that
   clause rules out, "regardless of consent."
2. **The "nested browser inside our web app" idea is not technically
   possible.** Job sites send `X-Frame-Options` / CSP `frame-ancestors`, so
   the iframe won't load; and even if it did, same-origin policy forbids
   reading or writing a cross-origin DOM. This is a browser security
   boundary, not an engineering obstacle.
3. **Server-side headless automation doesn't pay for itself.** Compute is
   cheap (~₹0.10/application on Cloud Run). The cost is per-ATS adapters that
   break silently on every site change, Cloudflare/reCAPTCHA blocking
   datacenter IPs, and residential proxies. Maintaining more than two or
   three adapters becomes a full-time job.

An extension inverts all three: it runs as the user, in their session, on a
page they opened, with no credential ever leaving their machine — and the
same field-mapping work is dramatically more durable because it runs in a
real browser with a real session.

## Constraint reconciliation (read before building)

### What still holds, unchanged

- **No credential capture.** The extension never asks for, stores, reads or
  transmits a password, cookie or session token belonging to any third-party
  site. It does not need to: the user is already logged in.
- **No autonomous submission.** The extension fills fields. A human reads the
  form and clicks submit. This satisfies `CLAUDE.md` §7 and `BRD.md` §10 as
  written — neither needs amending.
- **No background navigation.** The extension acts only on a tab the user
  actively opened and is looking at. It never opens, navigates or acts on
  pages on its own.

### Source-of-truth amendments (applied 2026-09-13)

`docs/F4_job_search_and_match_plan.md` §D previously ended with an absolute
"no credential capture, **no auto-fill**, no background submission anywhere."
That line was written for a *server-side* assisted-apply flow, where
"auto-fill" would have meant backend automation. A user-installed extension
filling a form locally is a materially different mechanism — but it **is**
auto-fill, so the line could not simply be reinterpreted in our own favour.
It now scopes the auto-fill prohibition to the web app and points here; the
credential and submission bans are untouched.

`BRD.md` §7.2 gained this extension and the whole paid-subscription
programme as post-MVP items. `BRD.md` §11 Phase 3 now records that the
extension is the chosen compliant path and, specifically, that it does not
*engage* the OAuth-only clause rather than merely satisfying it — there is
no third-party credential, cookie or token anywhere in this design for that
clause to govern.

## How it works, from the user's side

1. User installs the extension and clicks **Connect** once. A JobMagnate tab
   opens, they approve, and the extension is linked to their account.
2. They browse jobs in JobMagnate as they do today and click through to a
   posting.
3. On a supported application form the extension badge lights up: *"JobMagnate
   can fill this form."*
4. They click it. Name, email, phone, location, links, work authorization,
   experience and the résumé file are filled in, with each filled field
   briefly highlighted so it is obvious what changed.
5. **They read the form, fix anything wrong, and click the site's own submit
   button.** The extension has no submit path.
6. It offers: *"Mark this as applied in JobMagnate?"* — one click, and the
   application is tracked.

## Architecture

**Manifest V3**, Chrome first (Edge is a free ride, Firefox later). Three
pieces:

| Piece | Responsibility |
|---|---|
| **Service worker** | Holds the extension token, talks to the JobMagnate API, owns the field-mapping cache. The only piece that makes network calls. |
| **Content script** | Reads form structure, fills fields, highlights what changed. Never holds the token, never calls the API directly. |
| **Popup** | Connect/disconnect, current status, manual "Fill this form", link back to the app. |

Keeping all network access and all credentials in the service worker means a
compromised or hostile page cannot reach either — the content script is the
only thing running in the page's world, and it holds nothing worth stealing.

### Authentication

A dedicated, revocable extension token — **not** the web app's JWT, which is
short-lived and not scoped for this.

1. Popup opens `https://jobmagnate.com/extension/connect?state=<nonce>`.
2. User is logged in (or logs in) and sees an explicit consent screen naming
   what access is granted: profile fields and approved résumé artifacts.
3. On approve, the frontend calls `POST /api/extension/tokens`; the backend
   mints 32 random bytes, returns them once, and stores **only a SHA-256
   hash** — a database leak must not yield working tokens.
4. The page hands the token to the extension via
   `chrome.runtime.sendMessage(EXTENSION_ID, …)`, permitted by
   `externally_connectable: { matches: ["https://jobmagnate.com/*"] }`.
5. Extension stores it in `chrome.storage.local`; every API call sends it as
   `Authorization: Bearer ext_<token>`.
6. Settings gains a **Connected extensions** list — label, created date, last
   used — each with a Revoke button.

### Field mapping — the actual hard problem

Two tiers, deliberately ordered so the cheap deterministic path handles the
majority of real traffic.

**Tier 1 — per-ATS adapters (deterministic, no LLM).** The big ATSes have
stable, predictable form structure. An adapter is a small module: a hostname
match, a field-selector map, and a fixture-based test. Accurate, instant,
free.

There is useful existing leverage here: the backend already has provider
modules for Greenhouse, Lever and SmartRecruiters, so **the ATS is usually
already known from `JobListing.url`** — the backend can tell the extension
which adapter to use rather than making it sniff the page.

**Which adapters first should be decided from live data, not guessed.** Before
writing any, run a count of the current job pool grouped by application-URL
hostname and build the top three. The pool is real and already large enough
to answer this.

**Tier 2 — generic mapping with a global cache (LLM, rare).** For unknown
forms:

1. Content script extracts a **schema only** — each field's `name`, `id`,
   `type`, label text, placeholder. **No user data, no field values.**
2. Service worker hashes `hostname + sorted schema` and checks the backend
   cache.
3. On a miss, the backend asks an LLM to map form fields → profile keys, and
   **caches the result globally**, keyed by that hash.
4. The mapping comes back; the content script fills locally from data already
   in the browser.

Two properties worth being explicit about: the user's PII is never sent to an
LLM — only the shape of the form is — and because the cache is global, each
distinct form costs one LLM call *ever*, across all users, not one per user.
Same economics as the crash-course caching idea.

### Which résumé and cover letter get used

The extension should always attach **the best artifact the user already has
for that specific job**, never blindly the master résumé. Resolution order,
per artifact:

**Résumé** — first match wins:
1. **Approved tailored résumé** for this job (`GeneratedResumeVersion`,
   `ResumeVersionType.TAILORED`, `ArtifactStatus.APPROVED`)
2. Approved master résumé (`ResumeVersionType.MASTER`)
3. The originally uploaded résumé file

**Cover letter** — only if the form has a place for one:
1. **Approved tailored cover letter** for this job (`GeneratedCoverLetter`,
   `ArtifactStatus.APPROVED`)
2. Nothing — leave the field alone. Never substitute a generic letter for a
   tailored one; a wrong-company cover letter is worse than an empty field.

**Approved-only is not negotiable.** A `DRAFT` or `IN_REVIEW` artifact must
never be attached to a real application — that would route around the F6
human-approval workflow, which is the product's core promise (`CLAUDE.md`
§4). If a tailored résumé exists but hasn't been approved, the extension
falls back to the master *and* surfaces a nudge: *"You have an unapproved
tailored résumé for this job — review it in JobMagnate."* That nudge is a
genuinely useful re-engagement hook back into the web app.

Cover letters need two delivery paths, chosen per adapter: paste plain text
into a `<textarea>` (using the native-setter trick below), or fetch the PDF
and attach it to a file input.

### Job identification — the prerequisite nobody notices

Everything above depends on the extension knowing *which* job the open form
belongs to. The form is on `boards.greenhouse.io`; JobMagnate knows the job
by `JobListing.url`. Matching strategy, in order:

1. **Exact URL match** against the user's `UserJob` rows.
2. **Normalized match** — strip tracking params (`utm_*`, `gh_src`, `ref`),
   trailing slashes, and fragments. This catches most real cases, since
   users arrive via links that pick up tracking junk.
3. **Adapter-extracted job ID** — each adapter knows how to pull the ATS's
   own job id out of its URL, which survives most rewriting.
4. **Ask.** If nothing matches, the popup shows a searchable list of the
   user's saved jobs: *"Which job is this?"* One click, and the choice is
   remembered for that URL.

If the user declines to pick, the extension still fills profile fields with
the master résumé — job identification failing must degrade the fill, never
block it. Worth noting this also answers open question 4 below: a posting the
user found entirely outside JobMagnate still gets a useful autofill.

### Two implementation details that will otherwise cost a day each

- **React-controlled inputs ignore naive assignment.** Most modern ATS forms
  are React. Setting `el.value = x` updates the DOM but not React's internal
  state, so the value silently reverts on submit. The fix is to call the
  native setter and dispatch a bubbling event:
  `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, val)`
  then `el.dispatchEvent(new Event('input', { bubbles: true }))`. This is the
  single most common reason naive autofill appears to work and doesn't.
- **Attaching the résumé file** requires constructing a `DataTransfer`,
  adding a `File` built from the fetched PDF bytes, assigning
  `input.files = dt.files`, and dispatching `change`. Direct assignment to
  `input.files` is otherwise not permitted.

### Guardrails, enforced in CI

The "never submits" property must be structural, not a matter of discipline:

- **A CI test greps the extension source** for submit-triggering patterns
  (`.submit()`, `click()` on `[type=submit]`, `requestSubmit`) and fails the
  build. There is no feature flag for autosubmit, because there is no code
  path for it to enable.
- `host_permissions` enumerates supported ATS domains explicitly. No
  `<all_urls>` — narrower permissions mean a smoother Chrome Web Store review
  and are a genuine trust signal on the store listing.
- Telemetry reports `{host, adapterId, fieldsDetected, fieldsFilled}` and
  nothing else — no values, no PII. Aggregate fill-rate is how adapter rot
  gets detected before users report it.

## Backend additions

| Item | Detail |
|---|---|
| `ExtensionToken` entity | `id`, `userId`, `tokenHash`, `label`, `createdAt`, `lastUsedAt`, `revokedAt` |
| `POST /api/extension/tokens` | Mint (session-authed). Returns plaintext once. |
| `DELETE /api/extension/tokens/:id` | Revoke |
| `GET /api/extension/tokens` | List, for the Settings UI |
| `GET /api/extension/profile` | Profile fields + `plan` + remaining credits, for display. Consumes nothing. |
| `POST /api/extension/fills` | **The one that matters.** Takes the form URL; atomically consumes a credit and returns the full fill payload — profile fields plus the resolved résumé/cover-letter references. `402` when out of credits. Idempotent per (user, normalized URL) for 24h. |
| `GET /api/extension/jobs/resolve?url=` | Job identification — returns the matching `UserJob`, or candidates for the "which job is this?" picker |
| `GET /api/extension/jobs/:id/artifacts` | Approved tailored résumé + cover letter for a job (**`ArtifactStatus.APPROVED` only** — reuse the F6 check) |
| `POST /api/extension/field-map` | Tier-2 mapping, globally cached by schema hash |
| `POST /api/extension/applications` | Log a fill/apply event |
| `ExtensionFill` entity | `id`, `userId`, `normalizedUrl`, `jobId?`, `createdAt` — the quota ledger and the idempotency key in one table |

Application logging can use the existing `UserJob.appliedAt` on day one. If
F4 §D's richer `JobApplication` entity lands first, use that instead — the
extension should not be what forces that decision.

## Repo layout and tooling

A new top-level `extension/` workspace, TypeScript, sharing DTO types with
the backend rather than redeclaring them.

```
extension/
  src/
    background/     service worker — auth, API, cache
    content/        form detection + filling
    adapters/       one module per ATS + a registry
    popup/
  tests/
    fixtures/       saved real form HTML, one per adapter
```

Build with **wxt** or Vite + `@crxjs/vite-plugin` (both handle MV3 and
cross-browser output). Tests with vitest + jsdom against the saved fixtures —
this is what keeps adapters from rotting silently.

## Build phases

Each phase is independently shippable and independently useful.

| Phase | Scope | Estimate |
|---|---|---|
| **0 — Backend** | `ExtensionToken`, `ExtensionFill`, the `/api/extension/*` endpoints including atomic `POST /fills`, job URL resolution, Settings revoke UI. No extension code yet; fully testable on its own. | ~4–5 days |
| **1 — Skeleton + first adapters** | MV3 scaffold, connect/consent flow, top-3 ATS adapters (chosen from pool data), manual "Fill" button. Text fields only. | ~1 week |
| **2 — Real usability** | Auto-detect + badge, job identification + picker fallback, **tailored résumé/cover-letter resolution and attach**, filled-field highlighting, "mark as applied" logging. This is the first genuinely delightful version. | ~1.5 weeks |
| **3 — Coverage** | Tier-2 generic mapping + global cache, additional adapters, fill-rate telemetry. | ~1 week |
| **4 — Ship** | Edge + Firefox builds, store listings, privacy policy, "unlimited during early access" messaging. | ~3–4 days |
| **5 — Activate quota** | Turn on the 5-fill free cap, remaining-credits UI, upgrade prompt. **Ships with billing, not before** — see the sequencing note above. | ~2 days |

Roughly **4–5 weeks** of focused work to a polished public release; a useful
internal dogfood build exists at the end of Phase 2.

## Availability and quota

**The extension ships to every user, subscribed or not.** It is not a
premium-only surface. A free user installs the same extension, connects the
same way, and gets the same full-quality autofill — including tailored
artifacts. The paid tier buys **volume, not capability**.

| | Free | Paid |
|---|---|---|
| Autofills | **5** | Unlimited |
| Tailored résumé + cover letter used when available | Yes | Yes |
| Everything else | Same | Same |

This is a better split than gating tailored artifacts behind the paywall: a
free user gets to feel the product work *properly* — the best version of it,
on a real application — which is what actually sells a subscription. A
degraded free tier just teaches people the product is mediocre.

### Quota enforcement — server-side, always

**The count must live on the backend and never in the extension.** An
extension's storage and source are fully readable and editable by the user;
a client-side counter is decoration, not enforcement. So:

- `POST /api/extension/fills` **atomically consumes one credit and returns
  the fill payload in the same call.** There is no separate "check quota"
  endpoint the client could skip — if you got a payload, you were charged
  for it, and if you're out, you get `402` and no payload.
- The extension reads `user.plan` (`Plan.FREE` / `Plan.PREMIUM`, already in
  `entities/enums.ts`) only to *display* remaining credits. It never decides
  entitlement.

### What counts as one fill

This needs pinning down or it becomes a support burden. Recommended:
**idempotent per (user, job or form URL) for 24 hours.** Re-filling the same
form after a page reload, a validation error, or a mistake must not burn a
second credit — a user who loses a credit to a page refresh will (fairly)
consider it broken. The fill record is keyed on the normalized form URL, and
a repeat within the window returns the payload without charging again.

### Open decision: 5 lifetime, or 5 per month?

The brief says "5 auto-fills" without a period. Recommendation: **5 per
month.** A lifetime allowance means the extension becomes dead weight in the
browser about a week after install, and a dead extension gets uninstalled —
losing not just the user but the most persistent upgrade-prompt surface the
product has. A monthly refill keeps it installed, keeps it useful, and keeps
quietly demonstrating what the paid tier is for. Lifetime creates sharper
urgency, so this is a genuine trade-off; flagging it rather than silently
choosing.

### Sequencing note

Paid plans are post-MVP in their entirety (`BRD.md` §7.2), so when the
extension first ships there is no billing and therefore no way to buy your
way past a cap. Shipping a 5-fill limit before anyone *can* upgrade would be
pointlessly hostile. So: the quota is designed in now and **activates with
billing**; until then every user is effectively unlimited, and the extension
UI says so explicitly — *"Unlimited during early access; the free plan will
include 5 autofills per month."* Same discipline as the "Free for now"
badge: pre-announce, never take away silently.

## Verification

- Fixture DOM tests per adapter (vitest + jsdom), from saved real form HTML.
- The no-autosubmit CI grep test.
- Manual end-to-end against live postings on each supported ATS before each
  release — there is no substitute for this, fixtures go stale.
- Fill-rate telemetry reviewed after release; a sudden drop for one adapter
  means that ATS changed its form.

## Open questions

1. **Aggregator sites (Naukri, Indeed) need a decision before any adapter is
   written.** Their terms are materially more hostile to automation than an
   employer's own Greenhouse/Lever form, which is just a form on a company's
   careers page. Recommendation: ship employer-hosted ATS forms first, and
   treat aggregators as a separate go/no-go requiring the written
   per-platform review `BRD.md` §11 already mandates. **LinkedIn stays
   excluded** per `BRD.md` §9/§10.
2. Which three adapters first — answer from pool data, not intuition.
3. `UserJob.appliedAt` now vs. waiting for F4 §D's `JobApplication`.
4. Does the extension need to work for jobs *not* discovered through
   JobMagnate (a posting the user found themselves)? It easily can — the
   profile fill needs no job context. Worth deciding, as it changes the
   product story from "apply to our jobs faster" to "apply to any job
   faster," which is a materially bigger pitch.

## Cost

Essentially free to run: no new infrastructure, Tier-2 LLM calls amortize to
near zero via the global cache, Chrome Web Store is a **one-time $5**
developer registration, Edge and Firefox are free. The cost is the ~4–5 weeks
of engineering above, plus ongoing adapter maintenance.
