# Monetization — packaging decision and staging

**Status:** decided 2026-09-13. **Post-MVP in its entirety** — paid plans and
every feature inside them are out of scope for the current release
(`BRD.md` §7.2). The MVP is live and being marketed as a wholly free
product, and stays that way until this work is deliberately scheduled.

This document records *what will eventually be paid*, *what stays free
permanently*, and deliberately, *what not to build yet*. The only thing it
asks for in the near term is a UI label and some usage measurement; no
billing, entitlement or pricing work should begin off the back of it.

## The governing principle

**Finding a job is never gated.** Discovery, matching, match explanations,
the job board, skill-gap identification, LinkedIn review and application
tracking stay free permanently — for every user, unmetered. The product's
reason to exist is that a candidate who cannot pay still gets matched to
work they're qualified for.

What can eventually carry a price is the **output artifacts and the
leverage** — the things that save a candidate an hour of writing per
application, not the things that tell them the job exists.

## Tiering

| Feature | Today | Eventually |
|---|---|---|
| Résumé ingestion, onboarding, master résumé enhancement | Free | **Free permanently** |
| Job discovery, match scoring, match explanations, job board | Free | **Free permanently** |
| Skill-gap identification + course recommendations | Free | **Free permanently** |
| LinkedIn review | Free | **Free permanently** |
| Application tracking | Free | **Free permanently** |
| Master résumé PDF download | Free | **Free permanently** — it is the user's own data; gating it reads as hostile and invites justified bad word-of-mouth |
| **Per-job tailored résumé** | Free ("free for now") | Paid |
| **Per-job cover letter** | Free ("free for now") | Paid |
| **Assisted Apply extension — tailored-artifact attach** | Not built | Paid (see `assisted_apply_extension_plan.md`) |
| **AI crash courses on skill gaps** | Not built | Undecided — lean free, as a retention/differentiation play |

### "Free for now" labelling

The two eventually-paid features ship a small **"Free for now"** badge in the
UI from today. This is the cheapest possible piece of work and it buys three
things:

1. It sets the expectation early, so introducing a price later is a
   pre-announced change rather than a betrayal.
2. It is a live demand signal — people notice and react to the badge.
3. It costs nothing to remove if the plan changes.

Nothing else about these features changes. No limits, no metering, no
degraded output.

## What NOT to build yet

`User.plan` (`Plan.FREE` / `Plan.PREMIUM`, `entities/enums.ts`) **already
exists** and is already defaulted correctly on every user. That is enough.

Do **not** now build: entitlement middleware, a billing integration, plan
upgrade/downgrade flows, a pricing page, or per-feature quota counters. Every
one of those is dead weight while the answer is always "allow", and none of
them get materially harder to add later. A `requireEntitlement()` that always
returns true is not preparation, it is unused code with a maintenance cost.

The retrofit, when it comes, is roughly: a payment webhook that flips
`user.plan`, one guard on two route handlers, and an upgrade screen. That is
days of work, not weeks, and it is not made cheaper by starting now.

## What to build *before* charging (in this order)

1. **Usage measurement.** `ModelUsageRecord` already exists. Add a simple
   aggregate — tailored résumés and cover letters generated, per user, per
   month. Without this there is no basis for choosing a price or knowing
   whether the paywall is even viable. This is the one piece of billing
   groundwork worth doing early, and it is worth doing *before* marketing
   drives traffic, so the launch cohort is measured too.
2. **Unit-cost visibility.** Cost per tailored résumé in LLM spend (free-tier
   providers today, so ~₹0, but that changes the moment `LLM_ALLOW_PAID`
   flips or free quotas run out). A price set without knowing the marginal
   cost is a guess.
3. Only then: pricing, billing, entitlements.

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

## Related documents

- `assisted_apply_extension_plan.md` — the first genuinely new paid-tier
  capability.
- `BRD.md` §7.2, §10, §11 — the business constraints all of this sits inside.
