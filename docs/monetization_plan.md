# Monetization — packaging decision and staging

**Status:** decided 2026-09-13, split across two phases.

| Phase | Contents | State |
|---|---|---|
| **A — now** | The one-month full-access pass, shipped alongside the Assisted Apply extension | Planned, not started |
| **B — before the first pass expires** | Billing (Razorpay, one-time passes), usage measurement, real subscriptions, expiry UX | Next phase, hard deadline |

No money moves in Phase A. The pass is *granted* on signup, not purchased,
so it needs no payment integration — two columns and a helper. Everything
that touches money is Phase B.

## The governing principle

**Finding a job is never gated.** Discovery, matching, match explanations,
the job board, skill-gap identification, LinkedIn review and application
tracking stay free permanently — for every user, unmetered. The product's
reason to exist is that a candidate who cannot pay still gets matched to
work they're qualified for.

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
| Job discovery, match scoring, match explanations, job board | Free | **Free permanently** |
| Skill-gap identification + course recommendations | Free | **Free permanently** |
| LinkedIn review | Free | **Free permanently** |
| Application tracking | Free | **Free permanently** |
| Master résumé PDF download | Free | **Free permanently** — it is the user's own data; gating it reads as hostile and invites justified bad word-of-mouth |
| **Per-job tailored résumé** | Unlimited during the one-month pass | Paid |
| **Per-job cover letter** | Unlimited during the one-month pass | Paid |
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
3. **Backfill for existing users** — see the open question below.
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
2. **Billing** — Razorpay, one-time 1-month/3-month passes (no recurring
   mandates in v1; see pricing notes). Order creation, webhook with
   signature verification and idempotency, extend `planExpiresAt` on
   success.
3. **Expiry UX** — in-app and email warning before a pass lapses, and a
   clear, non-punitive downgrade state. A user must never discover they lost
   access by clicking a button that silently fails.
4. T&C, refund policy, pricing disclosure — Razorpay requires these live to
   activate the account.

## Pricing notes (for when the time comes)

- **India-first realities.** ₹199–499/month is the realistic band for a
  job-seeker tool. Job hunting is *episodic*, not perpetual — a one-month or
  three-month "sprint" pass will likely convert better than an annual
  subscription, and it matches how people actually experience the problem.
- **Razorpay over Stripe** for India (UPI support is not optional here).
- **Recurring billing is not a one-liner in India.** RBI e-mandate rules mean
  recurring card payments need AFA registration; UPI Autopay is the usual
  route. Budget real time for this, or sidestep it entirely at first by
  selling non-recurring passes.
- A refund policy and terms of service become mandatory the day money moves.

## Open question: users who signed up before the pass exists

The MVP is already live, so there is a cohort with no `planExpiresAt`. Three
options, and this needs an answer before the migration is written:

| Option | Effect |
|---|---|
| **Grant the same 30 days from ship date** (recommended) | Fair, simple, one-line migration. Everyone gets the same promise; early users are not punished for arriving first. |
| Grandfather permanently free | Generous, but creates a permanent two-tier user base you must support and explain forever. |
| Treat as free tier immediately | Cheapest, and the worst — it silently takes away capability from your earliest, most engaged users. |

Recommendation is the first: `UPDATE users SET planExpiresAt = now() + 30d
WHERE planExpiresAt IS NULL`. It also has the useful property of putting
every current user's expiry on roughly the same date, which makes the billing
deadline a single visible cliff rather than a slow trickle.

## Related documents

- `assisted_apply_extension_plan.md` — the first genuinely new paid-tier
  capability.
- `BRD.md` §7.2, §10, §11 — the business constraints all of this sits inside.
