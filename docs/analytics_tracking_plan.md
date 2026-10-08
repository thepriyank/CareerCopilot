# Conversion Tracking Implementation Plan — GA4/gtag + what it can't do alone

**Status:** proposed 2026-09-19. Zero tracking exists in the codebase today; this is the
fix for `docs/marketing_ads_plan.md` §0.2, the one remaining launch blocker in that plan.
**Scope:** the gtag/GA4 implementation, file by file, plus what to add beyond it and why
GA4 alone cannot run the ad plan as designed.
**Grounded in:** the actual frontend (`frontend/src/app`, Next.js 14 App Router) and backend
(`backend/src/routes/payments.routes.ts`, `backend/src/services/payments/`) as they exist in
this repo today, not a generic gtag tutorial. Every file and line number below was read from
the real code before being cited.

---

## 0. The one decision this plan makes: gtag.js directly, not GTM

Two ways to get GA4 running: Google Tag Manager (a visual tag-management layer that also
fires GA4, Meta Pixel and LinkedIn Insight Tag without a code deploy per change) or gtag.js
loaded directly in code. **This plan uses gtag.js directly.**

Why, given GTM is the more common recommendation: this codebase's own convention is typed,
explicit, reviewable code (`payments.routes.ts`'s comments are a good example of the house
style), and a single developer using Claude Code to make changes doesn't get anything from
GTM's real advantage, which is letting a non-engineer marketer add or change tags without a
deploy. GTM adds a second console to maintain, a second source of truth for what's actually
firing, and a debugging layer (its own preview mode, on top of GA4 DebugView) for a benefit
that doesn't apply here. If a marketer who isn't Priyank ever needs to add tags without
code changes, revisit this decision then, not before.

---

## 1. ~~One prerequisite step that has to happen outside this codebase~~ — Done, 2026-09-19

The GA4 property exists and both values are in hand:

- **Measurement ID:** `G-QWG25VQZS4` — this one is meant to be public (it can only submit
  events, never read or export data), so it's reproduced here directly and is already live
  in both `frontend/.env.local` (`NEXT_PUBLIC_GA_MEASUREMENT_ID`) and `backend/.env`
  (`GA4_MEASUREMENT_ID`, needed server-side for §5.1's Measurement Protocol call too).
- **Measurement Protocol API secret:** generated and already set in `backend/.env` as
  `GA4_API_SECRET`. **Deliberately not reproduced in this document.** This file lives in
  git; that env file is gitignored (confirmed via `git check-ignore`) and never has been
  and never will be committed. A secret that can fire fabricated server-side events if
  leaked belongs in the untracked env file it's already sitting in, not copied into a
  tracked markdown doc for convenience. Whoever implements §5.1 reads it from
  `backend/.env` the same way every other secret in this codebase (`RAZORPAY_KEY_SECRET`,
  `RAZORPAY_WEBHOOK_SECRET`) is already read, via `config.analytics.ga4ApiSecret` once §2's
  config block is added.

Nothing below this point is blocked on Priyank anymore. §2 onward is pure implementation.

---

## 2. Environment variables to add

Following this repo's existing `NEXT_PUBLIC_*` convention (`frontend/.env.local.example`
already has `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`), and the backend's
`config/index.ts` grouped-object convention (the `razorpay: {...}` block is the template):

**`frontend/.env.local.example`** — add:
```bash
# Google Analytics 4 (see docs/analytics_tracking_plan.md). This is the
# public Measurement ID, safe to expose in the bundle — it can only submit
# events, never read or export data.
NEXT_PUBLIC_GA_MEASUREMENT_ID=

# Meta Pixel ID (§7 below — required for ad optimisation, not just measurement).
NEXT_PUBLIC_META_PIXEL_ID=

# LinkedIn Insight Tag Partner ID (§7 below).
NEXT_PUBLIC_LINKEDIN_PARTNER_ID=
```

**`backend/.env.example`** — add, in a new grouped block matching the `razorpay` style:
```bash
# ─── Analytics (server-side conversion tracking) ───────────────────────────────
# GA4 Measurement Protocol — see docs/analytics_tracking_plan.md §5. This is
# the API secret from GA4 Admin -> Data Streams -> [stream] -> Measurement
# Protocol API secrets. NOT the same as NEXT_PUBLIC_GA_MEASUREMENT_ID above,
# and this one must never be exposed to the frontend bundle.
GA4_MEASUREMENT_ID=
GA4_API_SECRET=

# Meta Conversions API (§7 below) — from Meta Events Manager -> Settings ->
# Conversions API -> Generate access token.
META_CAPI_ACCESS_TOKEN=
```

**`backend/src/config/index.ts`** — add a matching block right after the `razorpay` object:
```typescript
  analytics: {
    ga4MeasurementId: process.env.GA4_MEASUREMENT_ID ?? '',
    ga4ApiSecret: process.env.GA4_API_SECRET ?? '',
    metaCapiAccessToken: process.env.META_CAPI_ACCESS_TOKEN ?? '',
  },
```

---

## 3. Consent, before a single script tag — this isn't optional given what this app handles

`docs/marketing_ads_plan.md` §14.4 already flags India's DPDP Act: consent has to be
specific and given before processing, and analytics tags have to load *after* consent, not
before with an apology banner over the top. Separately, Google's own Consent Mode v2 is
worth adopting on its technical merits, not just compliance: it lets GA4 still model
conversions from people who decline, using aggregated signals, instead of losing that data
outright.

The pattern: declare all consent as **denied by default**, before gtag ever loads, then
update it to granted only when someone accepts a banner.

**`frontend/src/components/analytics/Analytics.tsx`** (new file, styled like the existing
`ServiceWorkerRegister.tsx`):

```tsx
'use client'

import Script from 'next/script'

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

/**
 * Loads GA4 with Consent Mode v2 defaulted to denied, per
 * docs/marketing_ads_plan.md §14.4 (DPDP) — nothing is granted until
 * ConsentBanner (this same folder) calls window.gtag('consent', 'update', ...).
 * Renders nothing itself if NEXT_PUBLIC_GA_MEASUREMENT_ID isn't set, so a
 * dev environment without the env var just silently doesn't track.
 */
export function Analytics() {
  if (!GA_ID) return null

  return (
    <>
      <Script id="consent-default" strategy="beforeInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('consent', 'default', {
            'analytics_storage': 'denied',
            'ad_storage': 'denied',
            'ad_user_data': 'denied',
            'ad_personalization': 'denied'
          });
        `}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { anonymize_ip: true });
        `}
      </Script>
    </>
  )
}
```

**`frontend/src/components/analytics/ConsentBanner.tsx`** (new file):

```tsx
'use client'

import { useEffect, useState } from 'react'

const CONSENT_KEY = 'jm_consent'

/**
 * Minimal consent banner. Two buttons, no dark patterns, no pre-ticked
 * boxes — per docs/marketing_ads_plan.md §14.4, this has to be a real
 * choice, not a formality. Choosing "Decline" still lets GA4 run in
 * Consent Mode's denied state (modeled, cookieless); it just doesn't grant
 * ad_storage/ad_user_data, so Meta/LinkedIn retargeting audiences won't
 * include that visitor.
 */
export function ConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(CONSENT_KEY)) setVisible(true)
    } catch {
      // Private browsing / blocked storage — fail open to not-shown rather
      // than crash; consent stays denied by default either way.
    }
  }, [])

  function respond(granted: boolean) {
    const state = granted ? 'granted' : 'denied'
    window.gtag?.('consent', 'update', {
      analytics_storage: state,
      ad_storage: state,
      ad_user_data: state,
      ad_personalization: state,
    })
    try {
      localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied')
    } catch {
      // Non-fatal — consent still applies for this session even if it
      // can't be remembered for the next one.
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000,
        background: 'var(--surface)', borderTop: '1px solid var(--line-strong)',
        padding: '16px', display: 'flex', gap: 12, alignItems: 'center',
        flexWrap: 'wrap', fontSize: 13,
      }}
    >
      <span style={{ flex: 1, minWidth: 240 }}>
        We use cookies to understand how JobMagnate is used and to measure our own ads. Your
        resume and profile data are never affected by this choice either way. See our{' '}
        <a href="/privacy">Privacy Policy</a>.
      </span>
      <button onClick={() => respond(false)} className="btn btn-secondary btn-sm">Decline</button>
      <button onClick={() => respond(true)} className="btn btn-primary btn-sm">Accept</button>
    </div>
  )
}
```

**Type declaration** — add to a `.d.ts` file (e.g. `frontend/src/types/gtag.d.ts`, new):
```typescript
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}
export {}
```

**`frontend/src/app/layout.tsx`** — add both components next to the existing
`ServiceWorkerRegister`:
```tsx
import { Analytics } from '@/components/analytics/Analytics'
import { ConsentBanner } from '@/components/analytics/ConsentBanner'
// ...
      <body style={{ /* unchanged */ }}>
        {children}
        <ServiceWorkerRegister />
        <Analytics />
        <ConsentBanner />
      </body>
```

---

## 4. The typed event helper — the one file every instrumentation call site imports

**`frontend/src/lib/analytics.ts`** (new file). Event names match
`docs/marketing_ads_plan.md` §12.2's schema exactly, so a report row on the ads side maps
straight to a call site here with no translation layer.

```typescript
/**
 * Thin, typed wrapper around gtag. Every product event this app tracks is
 * named here once, matching docs/marketing_ads_plan.md §12.2's event
 * schema exactly. Safe no-op when gtag hasn't loaded (SSR, consent denied,
 * an ad blocker, or NEXT_PUBLIC_GA_MEASUREMENT_ID unset in dev) — nothing
 * that calls track() needs to guard for that itself.
 */

export type AnalyticsEvent =
  | { name: 'sign_up'; params?: { method: 'password' | 'google' } }
  | { name: 'resume_uploaded'; params?: { file_type?: string } }
  | { name: 'profile_completed' }
  | { name: 'master_resume_generated' }
  | { name: 'job_match_viewed'; params?: { job_id: string } }
  | { name: 'tailored_resume_generated'; params?: { job_id: string } }
  | { name: 'cover_letter_generated'; params?: { job_id: string } }
  | { name: 'extension_installed' }
  | {
      name: 'purchase'
      params: {
        transaction_id: string
        value: number
        currency: 'INR'
        items: [{ item_id: string; item_name: string }]
      }
    }

export function track(event: AnalyticsEvent): void {
  if (typeof window === 'undefined' || !window.gtag) return
  window.gtag('event', event.name, event.params ?? {})
}
```

---

## 5. Instrumentation, file by file — every call site, read from the real code

Each row is a real file and line in this repo today, not a hypothetical.

| Event | File | What to add |
|---|---|---|
| `sign_up` | [frontend/src/app/(auth)/register/page.tsx:24](frontend/src/app/(auth)/register/page.tsx) | After `setToken(token)`, before `router.push` |
| `sign_up` | [frontend/src/components/auth/GoogleSignInButton.tsx:32-33](frontend/src/components/auth/GoogleSignInButton.tsx) | After `setToken(token)`, gated on `isNewUser` |
| `resume_uploaded` | [frontend/src/app/(dashboard)/resume/upload/page.tsx:26](frontend/src/app/(dashboard)/resume/upload/page.tsx) | After `const { resumeFile } = await resumesApi.upload(f)` succeeds |
| `master_resume_generated` | [frontend/src/app/(dashboard)/master-resume/page.tsx:35](frontend/src/app/(dashboard)/master-resume/page.tsx) and [frontend/src/app/(dashboard)/resume/[id]/page.tsx:36](frontend/src/app/(dashboard)/resume/[id]/page.tsx) | After `await masterResumeApi.generate()` succeeds, both call sites |
| `tailored_resume_generated` | [frontend/src/app/(dashboard)/jobs/[id]/page.tsx:219](frontend/src/app/(dashboard)/jobs/[id]/page.tsx) | After `const res = await jobsApi.generateTailoredResume(id)` succeeds |
| `cover_letter_generated` | [frontend/src/app/(dashboard)/jobs/[id]/page.tsx:195](frontend/src/app/(dashboard)/jobs/[id]/page.tsx) | After `const res = await jobsApi.generateCoverLetter(id)` succeeds |
| `purchase` (client-side) | [frontend/src/app/(dashboard)/settings/page.tsx](frontend/src/app/(dashboard)/settings/page.tsx), inside `handleBuy`'s Razorpay `handler` callback | After `await paymentsApi.verify(response)` succeeds, before `window.location.reload()` — see §5.1 for why this alone isn't sufficient |
| `extension_installed` | Extension's own install/onboarding flow, or `frontend/src/app/extension/connect/page.tsx` on first successful connect | Fire once, on confirmed connect, not on page load |
| `job_match_viewed` | Jobs list/detail page, on first render of a match's detail view | Lower priority than the above; add once the rest are verified working |

**Example, the highest-value one (`resume_uploaded`):**

```tsx
// frontend/src/app/(dashboard)/resume/upload/page.tsx
import { track } from '@/lib/analytics'
// ...
const { resumeFile } = await resumesApi.upload(f)
track({ name: 'resume_uploaded', params: { file_type: f.type } })
```

**The purchase event, with the real values available at that call site:**

```tsx
// frontend/src/app/(dashboard)/settings/page.tsx, inside handleBuy's Razorpay handler
handler: async (response) => {
  try {
    await paymentsApi.verify(response)
    track({
      name: 'purchase',
      params: {
        transaction_id: response.razorpay_payment_id,
        value: order.amount / 100, // paise to rupees
        currency: 'INR',
        items: [{ item_id: passType, item_name: order.label }],
      },
    })
    window.location.reload()
  } catch (err) { /* unchanged */ }
},
```

### 5.1 Why the client-side `purchase` event above is not enough on its own

This isn't a hypothetical edge case; it's already documented in this exact codebase.
`applyPassPayment.ts`'s own comment explains the client-side verify path "depends on the
browser staying alive after Razorpay Checkout succeeds," which is precisely why the Razorpay
webhook exists as a second, server-to-server path into the same function. **A GA4 event
fired only from the client's `handler` callback has that identical gap**: if the tab closes,
the network drops, or the user backgrounds the app right after paying, the purchase happened
and the pass was granted, but GA4 never hears about it, and that spend looks unconverted in
every report and every ad platform's optimisation.

The fix mirrors the codebase's own existing pattern: fire a **server-side** conversion from
the one place both payment paths already converge, `applyPassPayment.ts`, using the GA4
Measurement Protocol (a plain HTTP POST, no client involved).

**`backend/src/services/analytics/ga4MeasurementProtocol.ts`** (new file):

```typescript
import { config } from '../../config'
import { logger } from '../../utils/logger'

/**
 * Server-to-server GA4 event, for conversions that must not depend on the
 * browser staying open — see applyPassPayment.ts's own comment about why
 * the Razorpay webhook exists for the identical reason. A failure here
 * must never break a payment that already succeeded; log and move on.
 */
export async function sendGA4Event(
  clientId: string,
  eventName: string,
  params: Record<string, unknown>
): Promise<void> {
  if (!config.analytics.ga4MeasurementId || !config.analytics.ga4ApiSecret) return

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${config.analytics.ga4MeasurementId}&api_secret=${config.analytics.ga4ApiSecret}`

  try {
    await fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        client_id: clientId,
        events: [{ name: eventName, params }],
      }),
    })
  } catch (err) {
    logger.error('ga4MeasurementProtocol: send failed', { err: (err as Error).message, eventName })
  }
}
```

Then in `applyPassPayment.ts`, right after `await userRepo.save(user)`:
```typescript
// Fire-and-forget, server-side, so this fires from both the client-verify
// path and the webhook path without duplicating tracking logic in either
// route — see docs/analytics_tracking_plan.md §5.1.
if (!alreadyProcessedBeforeThisCall) {
  void sendGA4Event(userId, 'purchase', {
    transaction_id: paymentId,
    value: PASS_PRICING[passType].amountPaise / 100,
    currency: 'INR',
    items: [{ item_id: passType }],
  })
}
```

One real wrinkle worth naming rather than glossing over: the GA4 Measurement Protocol wants
a `client_id`, the anonymous ID GA4's own browser cookie assigns, and the backend doesn't
have that cookie. Using `userId` instead means this server-side purchase event won't
automatically stitch to that same user's earlier browser session in GA4's UI — it'll show up
as a technically-separate event rather than joining an existing user journey. For pure
conversion counting and value tracking (which is what ad-platform optimisation needs), that's
fine. For a fully unified GA4 user journey, the frontend would need to read its own GA4
client ID (`gtag('get', GA_ID, 'client_id', callback)`) and send it to the backend at
purchase time to use instead of `userId`. Worth doing once the simpler version is verified
working, not before.

---

## 6. First-touch attribution — where an ad's UTM actually needs to end up

`docs/marketing_ads_plan.md` §12.5 calls for "your own backend's first-touch UTM on the user
record" as the one source of truth for attribution, since Meta and LinkedIn will each claim
credit generously and disagree with each other. That needs one small piece of plumbing this
plan hasn't covered yet.

**Capture on landing, before any redirect** — add to `Analytics.tsx` or a tiny separate
effect, running once per session:

```typescript
// Runs once, on first load of any page. Reads utm_* params per the
// convention in docs/marketing_ads_plan.md §12.4, stores them in a
// first-party cookie so they survive navigation to /register, and never
// overwrites an existing value — first touch, not last touch.
function captureFirstTouchUtm() {
  try {
    if (document.cookie.includes('jm_first_touch=')) return
    const params = new URLSearchParams(window.location.search)
    const utm = {
      source: params.get('utm_source'),
      medium: params.get('utm_medium'),
      campaign: params.get('utm_campaign'),
      content: params.get('utm_content'),
      term: params.get('utm_term'),
    }
    if (!utm.source) return
    document.cookie = `jm_first_touch=${encodeURIComponent(JSON.stringify(utm))}; max-age=2592000; path=/`
  } catch { /* non-fatal */ }
}
```

**Send it at signup** — `authApi.register()` in `frontend/src/lib/api.ts` reads the
`jm_first_touch` cookie and includes it in the register request body; the backend's register
route stores it on `User.settings.firstTouchAttribution` (the same JSON `settings` column
`applyPassPayment.ts` already uses for `processedPaymentIds` — no migration needed).

This is the piece that eventually makes the `purchase → which ad` question answerable
without trusting either platform's own attribution, per §12.5.

---

## 7. Is gtag/GA4 enough? No — here's specifically what it can't do

This is the direct answer to "if that itself is not enough, suggest other free tools," and
it isn't a nice-to-have list. **Two of these are required for the ad plan in
`docs/marketing_ads_plan.md` to function as designed, not optional additions.**

### 7.1 Required: Meta Pixel + Conversions API

GA4 measures what happened on the site. It has **no relationship with Meta's ad delivery
system** — it cannot build a Custom Audience, cannot seed a lookalike, and cannot tell
Meta's algorithm which of the people it showed an ad to actually converted, which is the
entire mechanism `docs/marketing_ads_plan.md` §6.1's Campaign 1/2 structure and its
lookalike-seeding depend on. Without the Meta Pixel, Campaign 0's video-watched audiences,
Campaign 1's lead-magnet lookalikes, and Campaign 2's retargeting pools in that plan **cannot
be built at all**, regardless of how good GA4's reporting looks.

- **Free**, same integration effort as gtag: a pixel base code (parallel structure to
  `Analytics.tsx` above) plus server-side Conversions API calls from the same convergence
  points already identified in §5 (`resume_uploaded`, `purchase` from `applyPassPayment.ts`),
  deduplicated with a shared `event_id` so the same conversion isn't double-counted between
  the browser pixel and the server call.
- Env var already reserved above: `NEXT_PUBLIC_META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`.
- This is genuinely the next implementation task after gtag is verified working, not a
  someday item — flag it as such rather than letting "we have analytics now" quietly stand
  in for "the ad plan can run."

### 7.2 Required: LinkedIn Insight Tag + LinkedIn Conversions API

Same relationship, same reasoning, for `docs/marketing_ads_plan.md` §6.2's LinkedIn
campaigns (Thought Leader Ads, Document Ads, retargeting): none of it can measure or
optimise without the Insight Tag installed and firing the same conversion events. Free,
one script tag plus a server-side API call, same pattern as above.
Env var reserved: `NEXT_PUBLIC_LINKEDIN_PARTNER_ID`.

### 7.3 Recommended: PostHog (free tier, or self-hosted)

`docs/marketing_ads_plan.md` §12.1 already calls for "one product analytics tool" as the
attribution source of truth, separate from what either ad platform reports. PostHog's free
tier (1M events/month) or a self-hosted instance covers this, and gives funnels, session
replay, and feature flags that GA4 doesn't. **Self-hosted is worth the extra setup step
specifically for this app**: resumes and career histories are sensitive data, and keeping
product-analytics session data on infrastructure already covered by this project's own
privacy posture (see `frontend/src/app/privacy`) is a stronger position than a third-party
SaaS holding it, even a reputable one.

### 7.4 Worth adding, low effort: Microsoft Clarity

Completely free, no event cap, one script tag. Session recordings and heatmaps specifically
for diagnosing *why* a page underperforms, which GA4's numbers alone can't show — directly
useful for §11's landing-page work and §13.1's test calendar (e.g., "the squeeze page is
under 25% opt-in" is a GA4 number; watching five actual session recordings of people
abandoning it is how you find out why).

### 7.5 Already free, unrelated to ads, worth having anyway

**Google Search Console**, verified against the same `jobmagnate.com` domain-verification
step §0.1 of the ad plan already requires for Meta. Zero cost, catches indexing problems,
and the same domain-ownership proof usually satisfies more than one platform's verification
at once.

---

## 8. Implementation order

1. Create the GA4 property (§1) — the one step that needs Priyank's Google account.
2. Add env vars (§2), `Analytics.tsx` + `ConsentBanner.tsx` (§3), and `lib/analytics.ts`
   (§4). Verify in GA4's **DebugView** that page views are arriving before touching any
   event instrumentation — confirms the base setup before layering events on top of it.
3. Instrument the events in §5's table, one at a time, verifying each in DebugView as it's
   added rather than shipping all of them and debugging blind.
4. Add the server-side purchase event (§5.1) and confirm it fires from a **test-mode**
   Razorpay payment before touching Live Mode (`docs/marketing_ads_plan.md` §0.3's other
   open item).
5. Add first-touch UTM capture (§6).
6. Only once all of the above is verified working: Meta Pixel + CAPI (§7.1), then LinkedIn
   Insight Tag (§7.2). These are what actually let `docs/marketing_ads_plan.md`'s campaigns
   run, not an afterthought.
7. PostHog and Clarity (§7.3, §7.4) can be added any time after step 2; they don't block
   anything and don't depend on the events work.

Once step 3 is done for at least `sign_up` and `resume_uploaded`, `docs/marketing_ads_plan.md`
§0.2 is closed and that plan has nothing left blocking it from launch.
