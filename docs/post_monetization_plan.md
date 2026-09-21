# Post-monetization — what's still pending

**Status:** audit taken 2026-09-19, right after Razorpay billing shipped to
staging. This is a punch list, not a new plan — every item below was
already committed to in `monetization_plan.md` or `assisted_apply_extension_plan.md`
and never built, or was explicitly deferred pending billing existing (which
it now does). Cross-referenced against the actual code, not just the docs,
so "pending" here means genuinely not implemented, not just undocumented.

What's **already shipped** and therefore *not* on this list: order creation,
signature verification, the `payment.captured` webhook, idempotent plan
extension, three real pass tiers with list/discount pricing, the redesigned
Plan tab, `User.activePlanTier` tracking, Terms of Service, Refund Policy,
and real FREE-tier caps on tailored résumés/cover letters (3/month each,
alongside the extension's existing 5 autofills/month). See `monetization_plan.md`
for the full shipped-state record.

---

## 1. Monetization plan (Phase B) — remaining items

| Item | Status | Where it's specified |
|---|---|---|
| **Usage measurement / cost tracking** | Not built. `ModelUsageRecord` is only ever written by `anthropicClient.ts`; the free-provider chain (Groq/Cerebras/Gemini/Ollama/OpenRouter, which is all of production today) writes nothing, so the table needed to actually price the paid tiers against real cost is effectively empty. | `monetization_plan.md` §"Phase B", item 1 — the fix identified there (record usage in `providerChain.generate()` instead, for every provider) was never done. |
| **Active expiry warning** | Partially built. A user can *see* "N days left" if they go to Settings → Plan or glance at the sidebar banner, but nothing proactively tells them their pass is about to lapse — no in-app banner/notification triggered at e.g. 3 days out, and no downgrade-specific messaging (today, lapsing is silent: `resolveEffectivePlan()` just quietly starts returning `FREE`). | `monetization_plan.md` §"Phase B", item 3 ("in-app and email warning before a pass lapses, and a clear, non-punitive downgrade state. A user must never discover they lost access by clicking a button that silently fails."). |
| **Email warning before a pass lapses** | Not built — and has no substrate to build on. There is no email-sending integration anywhere in this codebase (no SendGrid/SES/Postmark/nodemailer, nothing). This blocks the email half of the item above entirely, not just the copy. | Same line as above. |
| **Recurring subscriptions** | Deliberately deferred, not an oversight — but still the literal "real subscriptions" item from the original Phase B scope line, and still not built. RBI e-mandate rules mean recurring card payments need AFA registration; UPI Autopay is the documented route if/when this is picked up. All three current tiers are one-time-only. | `monetization_plan.md`'s Phase B summary row ("Billing (Razorpay, one-time passes), usage measurement, **real subscriptions**, expiry UX") and its "Recurring billing is not a one-liner in India" pricing note. |

## 2. Paid-tier product features — remaining items

| Item | Status | Where it's specified |
|---|---|---|
| **Upgrade prompt on hitting a quota cap** | Not built, in either surface that now has a real quota. The extension's 402 response renders as a plain string — *"You've used all your autofills for this period."* — with no link anywhere near it to Settings → Plan. The web app's tailored-résumé/cover-letter 402 (`OUT_OF_CREDITS`, added alongside this session's new quotas) has no special handling at all yet — it just surfaces as a generic error. | `assisted_apply_extension_plan.md` §"Availability and quota": *"The upgrade prompt shown when a free user hits the cap belongs to Phase B (billing) — until there is something to buy, there is nothing to link to."* There's now something to link to; the prompt itself was never built. |
| **Extension: résumé/cover-letter attachment** | Not live. The mapping vocabulary and backend artifact-resolution exist, but the content script currently skips filling `resume`/`coverLetter` fields, and the download routes are session-JWT-only (not yet extension-token-authenticated). This matters for the paid tier specifically: the extension's whole pitch is "same full-quality autofill, including tailored artifacts" at unlimited volume — that promise is incomplete for every user right now, paid or free. | `extension/CHROMEWEBSTORE.md`'s "Known Issues / Limitations"; `assisted_apply_extension_plan.md`'s quota table row "Tailored résumé + cover letter used when available." |
| **AI crash courses on skill gaps** | Not built at all. Whether it's free or paid was left an open call. | `monetization_plan.md`'s tiering table: *"Not built | Undecided — lean free, as a retention/differentiation play."* |

## 3. Adjacent infrastructure blocking paid-customer growth

Not "features for paid customers" in the product-UI sense, but both are
scoped, written up in detail, and currently at zero implementation — and
both exist specifically to grow and measure the paid tier, so they belong
on this list rather than getting lost as separate docs.

| Item | Status | Where it's specified |
|---|---|---|
| **Conversion/analytics tracking (GA4 + Consent Mode)** | Fully designed, zero code shipped. Covers a `purchase` event fired from the same server-side convergence point `applyPassPayment.ts` already uses for the Razorpay webhook (so a conversion is never missed just because a browser tab closed), first-touch UTM capture, and DPDP-compliant consent gating. | `docs/analytics_tracking_plan.md` (proposed 2026-09-19, file-and-line-level implementation plan already written). |
| **Meta Pixel + Conversions API, LinkedIn Insight Tag** | Not built. Per the same doc, these are **required**, not optional, for the ad campaigns below to function at all — GA4 alone can't build the ad-platform audiences those campaigns depend on. | `docs/analytics_tracking_plan.md` §7.1–7.2. |
| **Paid ad campaigns to acquire paying customers** | Planned, not launched. Explicitly blocked on the tracking work above per that plan's own status line. | `docs/marketing_ads_plan.md` (see its own §0.2 for the exact blocker). |

---

## Suggested next order

1. **Upgrade prompt on quota cap** — cheapest, highest-leverage item here: the exact moment a free user hits a real limit is the best conversion moment the product has, and right now that moment shows a dead-end error string instead of a path to Settings → Plan.
2. **Usage measurement** — needed before the current discount pricing can be sanity-checked against real cost.
3. **Active expiry warning (in-app first, email once email infra exists)** — protects the trial/pass cohorts already in flight from silently losing access.
4. Everything else here is lower urgency than those three, or explicitly deferred by prior product decision (recurring billing) rather than an oversight.
