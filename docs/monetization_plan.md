# Monetization — packaging decision and staging

**Status:** decided 2026-09-13, split across two phases.

> **2026-09-19 update:** the free pass is now explicitly called the
> **trial** (not "the one-month pass") and shortened to **15 days** — its
> job is to let a candidate try tailored résumés/cover letters/the
> extension, not to be a free month of service. `User.activePlanTier`
> (`PlanTier`: `TRIAL`/`ONE_MONTH`/`THREE_MONTH`/`ANNUAL`) now tracks which
> specific pass is behind a PREMIUM grant, so the business can query who's
> on what. Tailored résumés and cover letters also got real FREE-tier caps
> (3/month each, same rolling-window-from-signup shape as the extension's
> 5/month) — see "Tiering" below, which previously described this as a
> paid-only gate that the code didn't actually enforce yet.

> **2026-09-22 update — matching is no longer unconditionally free.**
> Product decision: once a user's trial (or a paid pass) lapses, the job
> board keeps working — jobs still surface, skill-match based, same as
> always — but the match score, skill gap, and every explicit AI action
> (recompute match, check skill gaps, tailor résumé, generate cover
> letter) are locked, shown as disabled buttons with an "i" tooltip
> ("Feature not available in free-tier"). This reverses "the governing
> principle" below as originally written, which is worth stating plainly
> rather than quietly editing around. **Revised same day** from an initial
> version that stopped surfacing new jobs entirely — the jobs list staying
> populated (skill-match only, no score/gap detail) is the shipped
> behavior, not that first pass.
>
> **The escape hatch**: a FREE user who adds their own model API key
> (Settings → API keys) unlocks all of it — matching, skill gap, tailored
> résumés and cover letters — indefinitely. Tailored résumés/cover letters
> already route generation through that key automatically, at no cost to
> the platform; matching and skill-gap classification call no LLM at all
> (both are local computation over already-extracted data — see
> `matchScore.ts`/`jdSkillGap.ts`), so the key's *presence* is what the
> gate checks there, not its usage. Extension autofill and every other pro
> feature stay gated behind an actual paid/trial pass regardless of a
> configured key. The old 3/month FREE-tier grace on tailored résumés/
> cover letters is gone — replaced by this same hard lock, for one
> consistent free-tier story instead of two different mechanisms.
>
> See `backend/src/services/plan/matchingAccess.ts` and the in-app
> pass-expiry notification (`entities/Notification.ts`, fired 3 days
> before expiry). `docs/marketing_ads_plan.md`'s "finding a job is free,
> permanently" campaign claim needs updating to match before that plan
> goes live — flagged there, not yet edited.

| Phase | Contents | State |
|---|---|---|
| **A — now** | The 15-day trial, shipped alongside the Assisted Apply extension | Shipped; shortened from 30 to 15 days 2026-09-19 |
| **B — before the first pass expires** | Billing (Razorpay, one-time passes), usage measurement, real subscriptions, expiry UX | Billing shipped 2026-09-19 (staging); usage measurement and expiry UX still open |

No money moves in Phase A. The pass is *granted* on signup, not purchased,
so it needs no payment integration — two columns and a helper. Everything
that touches money is Phase B.

## The governing principle

**Finding a job is never gated — while a trial or pass is active, or a
user supplies their own model key.** Discovery, matching, match
explanations, the job board, skill-gap identification, LinkedIn review and
application tracking stay free and unmetered for as long as either of
those is true (see the 2026-09-22 update above). The product's reason to
exist is that a candidate who cannot pay, but can either use the trial or
plug in a free-tier key of their own, still gets matched to work they're
qualified for — the bar to clear is "bring any working key," not "pay us."

What can eventually carry a price is the **output artifacts and the
leverage** — the things that save a candidate an hour of writing per
application, not the things that tell them the job exists.

Where a feature is metered rather than gated, prefer **capping volume over
degrading capability**. A free user should experience the product at full
quality and simply run out, rather than being handed a deliberately worse
version of it — the good version is what sells the subscription.

## Tiering

| Feature | Today | Eventually |
|---|---|---|
| Résumé ingestion, onboarding, master résumé enhancement | Free | **Free permanently** |
| Job discovery + job board | Free always — surfacing runs regardless of plan, skill-match based | Same — this is the shipped, final behavior, not a placeholder |
| Match scoring, match explanations | Free during trial/pass, or with a custom key; locked (score hidden) otherwise (shipped 2026-09-22) | Same |
| Skill-gap identification (per job) | Free during trial/pass, or with a custom key; locked otherwise (shipped 2026-09-22) | Same |
| Course recommendations | Free | **Free permanently** |
| LinkedIn review | Free | **Free permanently** |
| Application tracking | Free | **Free permanently** |
| Master résumé PDF download | Free | **Free permanently** — it is the user's own data; gating it reads as hostile and invites justified bad word-of-mouth |
| **Per-job tailored résumé** | Unlimited during the trial/pass, or with a custom key; locked otherwise — no more 3/month FREE grace (revised 2026-09-22, was shipped 2026-09-19) | Unlimited on a paid pass |
| **Per-job cover letter** | Unlimited during the trial/pass, or with a custom key; locked otherwise — no more 3/month FREE grace (revised 2026-09-22, was shipped 2026-09-19) | Unlimited on a paid pass |
| **Assisted Apply extension** | Not built | **Free for everyone, capped at 5 autofills; unlimited when paid.** The extension is not a premium-only surface — free users get the same full-quality fill, tailored résumé and cover letter included. The paywall is volume, not capability (see `assisted_apply_extension_plan.md`) |
| **AI crash courses on skill gaps** | Not built | Undecided — lean free, as a retention/differentiation play |

## The one-month full-access pass (decided 2026-09-13)

**Every user gets 30 days of everything, automatically, on signup.** No card,
no checkout, no purchase — the pass is granted, not bought. During it, the
tailored résumé, cover letter and the Assisted Apply extension are all
unlimited, exactly as a paid subscriber will have them.

This supersedes the vaguer "Free during early access" badge: a dated pass is
both more honest and more motivating than an open-ended "free for now."
Users see *"Full access — 23 days left"*, which sets a real expectation and
makes the eventual price a scheduled event rather than a surprise.

### Mechanism — deliberately two columns, not a billing system

`User.plan` already exists. Add **one** column beside it:

- `User.planExpiresAt: timestamp | null`

and one helper, `resolveEffectivePlan(user)`, returning `FREE` when
`planExpiresAt` is in the past. Every entitlement check goes through that
helper and nothing reads `user.plan` directly.

Two properties worth being deliberate about:

- **Expiry is computed on read, never by a cron.** There is no scheduled job
  downgrading anyone. This is simpler, cannot drift, and avoids the
  scale-to-zero cron unreliability this project already hit once with job
  discovery (see `INFRASTRUCTURE.md`).
- **Extending everyone is a single `UPDATE`.** That matters: if billing
  slips, nobody has to lose access — you move the dates and buy time. Keep
  that escape hatch in mind rather than engineering for it.

No `Subscription` entity, no webhooks, no entitlement middleware framework.
Those arrive with billing.

### The deadline this creates

**The day this ships, a 30-day clock starts on the first user who signs up.**
Billing must be live before that clock runs out, or the only options are
extending everyone's pass or degrading users who were explicitly promised a
month of everything.

That is a *useful* forcing function, not a problem — but it must be stated
plainly, because it converts billing from "next phase, sometime" into work
with a hard date attached. Razorpay KYC (calendar time, not engineering) is
the long pole and should already be in progress.

## Phase A scope — what actually gets built now

1. `User.planExpiresAt` + migration; new signups get `now + 30 days`.
2. `resolveEffectivePlan(user)` — the single source of truth for entitlement.
   Nothing reads `user.plan` directly.
3. **Opt-in activation flow for pre-existing users** — banner + `POST
   /api/account/activate-pass`; see below. No backfill migration.
4. Pass state surfaced in the UI: days remaining, and what happens after.
5. The extension's fill endpoint honours the pass (unlimited while active).

Deliberately **not** in Phase A: any payment integration, `Subscription`
entity, webhooks, upgrade/downgrade flows, pricing page, or a general
entitlement-middleware framework. A guard is two `if`s calling one helper;
that is not a framework and does not need to become one.

## Phase B — before the first pass expires

1. **Usage measurement.** Note the counts you need for pricing are *already
   queryable*: `GeneratedResumeVersion` (`TAILORED`) and
   `GeneratedCoverLetter` both carry `createdAt` and resolve to a user, so
   "artifacts per user per month" is SQL over existing rows, not new
   instrumentation.
   The real gap is **cost**: `ModelUsageRecord` is only written by
   `anthropicClient.ts`, and production runs `LLM_ALLOW_PAID=false` on the
   free provider chain — so that table is effectively empty. Recording usage
   in `providerChain.generate()` instead fixes it for all providers.
2. **Billing (shipped 2026-09-19)** — Razorpay Standard Checkout, one-time
   1-month/3-month/annual passes (no recurring mandates in v1; see
   pricing). Order creation, signature verification, and a
   `payment.captured` webhook (server-to-server, authoritative even if the
   browser never calls back) both converge on the same idempotent
   plan-extension helper. See `backend/src/routes/payments.routes.ts` and
   `razorpayWebhook.routes.ts`.
3. **Expiry UX** — in-app and email warning before a pass lapses, and a
   clear, non-punitive downgrade state. A user must never discover they lost
   access by clicking a button that silently fails.
4. T&C, refund policy, pricing disclosure — Razorpay requires these live to
   activate the account.

## Pricing (decided 2026-09-19)

Three one-time passes, no recurring mandate — see `backend/src/services/payments/passPricing.ts`
for the single source of truth these are read from (the frontend fetches
this via `GET /api/payments/plans` rather than hardcoding it a second time):

| Pass | List price | Current price (limited-time discount) |
|---|---|---|
| 1-month | ₹799 | ₹399 |
| 3-month (**recommended**) | ₹1,999 | ₹999 |
| Annual | ₹7,999 | ₹4,999 |

- **Razorpay over Stripe** for India (UPI support is not optional here).
- **Recurring billing is not a one-liner in India.** RBI e-mandate rules mean
  recurring card payments need AFA registration; UPI Autopay is the usual
  route. Sidestepped for now by selling only non-recurring passes (above).
- Terms of Service (`/terms`) and Refund Policy (`/refund-policy`) are live —
  see those pages for the actual policy text (7-day refund window, unused
  pass only).

## Existing users: opt in on next visit (decided 2026-09-13)

The MVP is already live, so there is a cohort with no pass. **They are not
backfilled.** Instead, on their next visit they are told about the pass and
activate it themselves — *"Your free month is ready. Activate it whenever
you're ready to use it."* — and the 30 days start from the day they accept,
not from the deploy date.

This is better than a blanket backfill for a reason worth naming: a
backfilled month burns down whether or not the user ever opens the app, so a
dormant user's entire pass expires unused and they get nothing. Opt-in means
the month starts when the user is actually present to spend it, which is both
fairer and a genuine re-engagement moment.

### Mechanism

Eligibility needs **no new column** — it is derivable:

```
eligible = user.createdAt < PASS_LAUNCH_AT AND user.planExpiresAt IS NULL
```

On accept: `planExpiresAt = now() + 30 days`. That's the whole flow.

- **New users are still auto-granted at signup** — no acceptance step. They
  are told during onboarding, not asked. The asymmetry is deliberate: a new
  user has no prior expectation to renegotiate, an existing one does.
- **Banner dismissal state lives in the existing `User.settings` jsonb** — no
  migration for it. Keep offering after a dismissal (it is a gift, not a
  nag), but as a quiet banner rather than a repeated modal.
- **An eligible user who has not yet accepted is never blocked.** If they
  reach an action the free tier would cap, they see the pass offer *in place
  of* the limit — the offer is the gate. Nobody hits a wall for not having
  clicked a button they were never shown.

### Consequence for the billing deadline

Expiries now **stagger** rather than landing on one date, since each user's
clock starts when they accept. That reduces the risk of a single mass-expiry
cliff, but it does not move the deadline: **billing must be ready 30 days
after the first person accepts**, which in practice is 30 days after ship.
Plan against the earliest expiry, not the median.

## Related documents

- `assisted_apply_extension_plan.md` — the first genuinely new paid-tier
  capability.
- `BRD.md` §7.2, §10, §11 — the business constraints all of this sits inside.
