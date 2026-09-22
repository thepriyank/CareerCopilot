# JobMagnate — Paid Acquisition Strategy: LinkedIn Ads + Instagram Ads

**Status:** proposed 2026-09-19. Not yet approved, nothing spent.
**Scope:** audience, positioning, creative system, ad units, measurement, budget, compliance.
**Source docs:** `BRD.md` §6 (audience), `docs/monetization_plan.md` (what's free vs paid),
`DESIGN_DOC.md` §2–4 (brand), `design/redesign-2026/Foundations.dc.html` (real tokens),
`infra/terraform/INFRASTRUCTURE.md` (deployment reality).

---

## 0. Pre-flight blockers — read this before approving any budget

**Status update, 2026-09-19, same day, later revision:** two of the four blockers below are
resolved. `jobmagnate.com` is live in production, and Razorpay is integrated with real
pricing. Left both sub-sections in place rather than deleting them, because what actually
changed matters for the plan (see the "Resolved" callouts in each), and because 0.2 is still
fully open and is now the only true launch blocker.

### 0.1 ~~There is no domain~~ — Resolved: `jobmagnate.com` is live in production

Corrected: the earlier draft of this document was written against `INFRASTRUCTURE.md`,
which is now confirmed stale (it still reads *"No custom domain mapped"*). The actual
production frontend is **`jobmagnate.com`**, live and functional. `INFRASTRUCTURE.md` should
be updated to reflect that per its own stated convention ("update `INFRASTRUCTURE.md` after
any real `terraform apply`") — flagging it rather than editing infra docs unasked.

What this actually unblocks: every landing page, ad destination and UTM in this document
can now point at `jobmagnate.com` instead of a staging host. What it does **not** yet cover:
**Meta domain verification and LinkedIn advertiser review still need to be done as their own
platform-side step** (a DNS TXT record for Meta, an advertiser-identity check for LinkedIn).
Owning the domain is necessary for that, not the same thing as it.

**Action:** verify `jobmagnate.com` in Meta Business Manager and confirm it resolves cleanly
for LinkedIn's advertiser review before the first campaign goes live. This is now a
same-day task, not an infrastructure project.

### 0.2 There is still no tracking of any kind installed — the one true remaining blocker

A grep across `frontend/src` and `backend/src` finds no `fbq`, no `gtag`, no LinkedIn
Insight Tag, no PostHog/Mixpanel/Plausible. You currently cannot measure a conversion,
build a retargeting audience, or seed a lookalike.

Running ads before this is buying traffic you can never learn from. **This is now the only
blocker standing between this plan and a real launch.** See the dedicated
`docs/analytics_tracking_plan.md` for the concrete, file-by-file gtag/GA4 implementation,
built to the exact event schema §12.2 defines, plus what to add beyond it.

### 0.3 ~~Billing is not live~~ — Built today, not yet deployed or verified end-to-end

Corrected: as of today, `backend/src/routes/payments.routes.ts`,
`backend/src/services/payments/razorpayClient.ts` and `passPricing.ts` implement real
one-time-pass checkout (Razorpay Standard Checkout, signature-verified, webhook-backed for
the case where the tab closes before the client-side verify call completes). Real pricing
exists: **₹399 (1-month), ₹999 (3-month, recommended), ₹4,999 (annual)**, each with a
struck-through list price. This is a materially better and more specific number than this
document's earlier ₹199 to ₹499 placeholder guess, and every reference to that placeholder
below has been corrected to it.

What's still open, per `git status`: these files are modified/untracked locally, not yet
committed or deployed to the staging/production pipeline described in `INFRASTRUCTURE.md`.
Two things need confirming before this stops being a caveat: **the deployment is live**, and
**Razorpay is switched from Test Mode to Live Mode** (the key/secret pair in
`backend/.env.example` is per-mode; a Test Mode key on production silently blocks every
real payment). Neither is a marketing question, both are a five-minute check before spend.

**Action:** confirm both, then this blocker is fully closed rather than "probably fine."

### 0.4 The campaign objective is confirmed: resume uploads, not signups or paid plans

Restated per explicit direction, not a new finding: even with billing now real, **this
campaign still optimises for `resume_uploaded`**, not `sign_up` and not `purchase`. That was
already this document's position (§3.5, §12.2) for the reason jaredrhod's playbook gives:
cold traffic doesn't buy, and resume upload is itself the leading indicator worth the most
per §12.3's CPAU metric. Billing going live doesn't change the ad objective; it changes what
happens organically *after* someone is already active, and it's what finally makes §12.6's
LTV-based thresholds computable with real numbers instead of placeholders once enough
`purchase` events exist.

### 0.5 The public name is confirmed: `JobMagnate`

Settled: `JobMagnate`, capital M, matching `frontend/src/app/layout.tsx`'s metadata exactly.
The repo folder (`hAIring Copilot`) and every reference to "Jobmagnate" (lowercase m)
anywhere in an earlier draft of this document have been corrected to this casing throughout.

---

## 1. Positioning and campaign platform

### 1.1 The category problem

The "AI resume" category in India is saturated with tools whose pitch is *speed and
volume*: "resume in 30 seconds," "apply to 500 jobs while you sleep." Candidates have now
used those tools, been rejected anyway, and learned the thing those ads never said — **a
generated resume that inflates your experience gets you filtered by a human two rounds
later, or not at all.**

That gives JobMagnate an opening that is genuinely hard to copy, because for competitors
it would require removing a feature.

### 1.2 The two defensible claims

Both come from product constraints, not from copywriting:

1. **It will not invent anything.** `CLAUDE.md` §Step 4 and the extraction prompts enforce
   it at the model layer ("do NOT fabricate a plausible-sounding placeholder, invent an
   employer, or invent a skill that isn't literally in the text"). Every AI edit is shown
   as a diff and requires human approval. Almost no competitor ad says this, because most
   of them can't.

2. **Finding a job is free, permanently.** `monetization_plan.md`: discovery, matching,
   match explanations, skill gaps, LinkedIn review, application tracking and the master
   resume PDF are free forever — *"the product's reason to exist is that a candidate who
   cannot pay still gets matched to work they're qualified for."* Only the per-job tailored
   artifacts are ever paid.

   **⚠️ Needs a rewrite before this campaign goes live (2026-09-22).** Claim #2 is no
   longer literally true as written: matching now pauses once a user's trial/pass lapses,
   unless they've added their own model API key — see `monetization_plan.md`'s
   2026-09-22 update. The claim survives in a narrower, still-true form ("free while your
   trial lasts, and free indefinitely if you bring your own key — no card required either
   way"), but every ad/landing-page line built on the unconditional "forever" phrasing
   (§1.3's platform line, §4.2's hooks #15–17, §4.4's "free-forever card," §11.3's trust
   copy) needs a pass against the corrected claim before spend starts, not after.

These two are the campaign. Everything else is proof.

### 1.3 Campaign platform

> ## Every word is yours.
> *JobMagnate rewrites how your career reads. Never what's in it.*

**Why this line:** it is simultaneously the anti-hallucination guarantee, the
data-ownership promise (your master resume PDF is free to download forever — *"it is the
user's own data; gating it reads as hostile"*), and a dignity message for a candidate who
feels like a CV in a stack of 4,000. It is also short enough to be the only text on a
1080×1350.

**Supporting lines, each with a defined job:**

| Line | Job | Where |
|---|---|---|
| *"Every word is yours."* | Brand platform | Hero creative, bio, brand campaign |
| *"It won't invent a job you never had."* | Sharp performance hook | IG prospecting, cold |
| *"See why you fit — before you apply."* | Product demo (already on the landing page) | LinkedIn, mid-funnel |
| *"Finding a job stays free. Forever."* | Objection kill + offer | Retargeting, all platforms |
| *"Applied ≠ considered."* | Problem agitation | Top-funnel Reels |

### 1.4 What we never say

- No "get hired in 30 days," "3× more interviews," "90% ATS pass rate." You have no data,
  and ASCI requires substantiation for objective claims. These also attract exactly the
  low-trust audience that churns.
- No "auto-apply to 500 jobs." It is false (`BRD.md` §10 forbids it) and it invites the
  compliance risk the whole product is designed to avoid.
- No fabricated testimonials, no "as seen on Naukri / LinkedIn."

---

## 2. Audience architecture

`BRD.md` §6 is India-first, freshers + mid-level switchers, tech/product/design/analytics/
ops. That's a starting point, not a media plan — it describes tens of millions of people.
Below are six segments ranked by *expected value per rupee*, not by size.

### S1 — IT-services → product switchers (2–6 yrs) — **PRIMARY**

Someone at a large Indian IT-services firm with 2–6 years, trying to move to a product
company or a funded startup.

- **Why they convert:** they have a concrete, painful, *already-known* problem — their
  resume is written in service-company language (RTB, SLA, ticket counts, clients they
  can't name) and reads as unqualified to a product recruiter. This is precisely a
  rewrite-without-inventing problem. Best product fit of any segment.
- **Why they pay:** employed, ₹6–18 LPA, and a ₹399–999 pass is trivial against a ₹6 LPA
  hike. This is your Phase-B revenue segment.
- **Channel:** LinkedIn (targetable with precision) + Instagram (heavy users, far cheaper).

### S2 — Mid-level switchers, non-services (3–8 yrs) — **PRIMARY**

Product, design, analytics, marketing, ops at startups/MNCs. Switching for role or comp.
Fewer, higher intent, best LinkedIn economics. Strong fit for match-explanation messaging
("I don't want more jobs, I want the right five").

### S3 — Final-year students and freshers (0–1 yr) — **VOLUME**

Enormous, very cheap on Instagram, highest emotional engagement, lowest willingness to
pay. **Treat as a brand/volume and organic-flywheel segment, not a revenue segment.** They
are also who *shares* your carousels, which is how the blended CPM stays low.

- Tier-2/3 engineering colleges, BCA/MCA, B.Com/MBA. Placement season (Aug–Nov, Jan–Mar)
  is a sharp seasonal spike — plan campaigns around it.
- The free-forever promise is the whole pitch here.

### S4 — Laid off, not less capable: experienced professionals hit by 2026 restructuring (5–18+ yrs) — **PRIMARY for the current campaign, revised 2026-09-19**

Revised and elevated per direct instruction: this is now the lead segment for the active
campaign, not a secondary high-intent pool. Someone with real depth (5 to 18+ years,
often senior IC, lead or manager level) who lost a role this year in a round the company
called "AI-driven efficiency," "restructuring," or "automation of the function," and who is
now applying into a market where a decade-plus of real ownership isn't clearing the first
screen.

- **Why they convert:** the emotional and practical problem is sharper than any other
  segment's. Practically, most resume tools and most ATS systems are tuned for entry- and
  mid-level keyword density, and they garble or flatten someone with a long, senior history.
  Emotionally, a layoff this year almost always gets a company-supplied explanation that has
  nothing to do with individual performance, and yet the person searching quietly internalises
  it as one anyway. The message this campaign leads with directly answers both: the resume
  problem is fixable today, and the layoff was never a verdict on the work.
- **The AI framing, specifically:** 2026 has had a wave of layoffs publicly attributed to AI
  adoption, automation, or "efficiency." Whether or not AI is the real reason in every case,
  it is the headline reason being given, and it puts this exact audience in an adversarial
  relationship with the category of technology JobMagnate is built from. The campaign doesn't
  pretend that tension away or defend AI in general. It draws the actual distinction the
  product already embodies: **there is AI that replaces judgment and AI that respects it.**
  The kind that displaced a role and the kind that misrepresents a resume to get past a filter
  are the same failure mode, dressed up as progress. The product's core claim (§1.2, "it
  won't invent anything") was never written for this angle, but it answers it directly.
- **Why they pay:** severance or savings runway makes a ₹399 to ₹999 pass a rounding error
  against the actual stakes of the search, and unlike a fresher, there's no "just keep
  applying for free forever" patience left. Urgency plus means is the combination that
  converts to paid, which is exactly why this segment, not S3, is the target for a
  paid-user-focused run.
- **Channel:** LinkedIn first (real targeting proxies exist here, see §2.2 and §6.2),
  Instagram second, for reach and for the dignity-forward creative that performs better as
  video than as a feed static.

### S5 — Career-break returners — **UNDERSERVED, DIFFERENTIATED**

Mostly women returning after 1–5 years. Systematically failed by existing tools: their real
problem is a gap the resume can't hide, and generic AI tools paper over it with invented
freelance work — the exact thing JobMagnate refuses to do. High emotional resonance, high
word-of-mouth, low competition. Instagram-led.

### S6 — India-based remote-global applicants — **NICHE, HIGH LTV**

`BRD.md` scopes "international remote roles... realistically open to India-based
applicants." Small, sophisticated, pays immediately, and the best fit for per-job tailoring
(every remote role needs real tailoring). LinkedIn + niche IG.

### 2.1 Priority and budget weight, general architecture

This is the standing map across every audience JobMagnate could ever advertise to. §2.2
below is the narrower, current instruction: this specific campaign run does not use this
weighting as written.

| Segment | Priority | Budget share | Primary channel | Revenue potential |
|---|---|---|---|---|
| S1 IT-services switchers | 1 | 30% | LinkedIn + IG | **High** |
| S2 Mid-level non-services | 2 | 20% | LinkedIn | **High** |
| S3 Freshers/students | 3 | 25% | Instagram | Low (volume/brand) |
| S4 Active searchers | 4 | 10% | IG retargeting | Medium |
| S5 Career-break returners | 5 | 10% | Instagram | Medium |
| S6 Remote-global | 6 | 5% | LinkedIn | High per-user |

### 2.2 This campaign's actual scope: S4 primary, S3 excluded

Direct instruction, 2026-09-19: this campaign targets experienced people hit by layoffs, not
freshers, because the brief is paid-user-suited traffic. Re-weighted for this run only:

| Segment | Role in this campaign | Budget share (this run) |
|---|---|---|
| **S4 — laid off, experienced** | **Primary. The angle, the hooks, and the new creative in §4.4, §8, §9, §10 are built for this segment specifically** | 45% |
| S1 IT-services switchers | Secondary. Same "read correctly, not reinvented" mechanism, same seniority band overlap, folded into the same campaigns rather than run separately | 25% |
| S2 Mid-level non-services | Secondary, same reasoning as S1 | 15% |
| S6 Remote-global | Kept, small, high LTV, unaffected by this brief | 5% |
| S5 Career-break returners | Kept as-is, a distinct emotional angle worth its own budget regardless of this campaign | 10% |
| **S3 Freshers/students** | **Excluded from this campaign entirely.** Zero spend, zero targeting overlap. Not deleted from §2.1's standing architecture; a fresher-focused brand/volume campaign is a separate, later initiative, not this one | 0% |

**What "excluded" means operationally, not just directionally**, since a broad Meta audience
will find its way to whoever the creative resonates with regardless of intent:

- **Age floor on Meta:** set a minimum age around 27 to 30 across every ad set in this
  campaign. That alone removes nearly the entire fresher population without needing an
  interest-based exclusion, which per §6.1 is unreliable anyway.
- **No placements or content tuned to student behaviour.** No campus-adjacent creative, no
  placement guidance toward Reels audiences skewing under 24, no Hinglish-for-students copy
  variant from the earlier §6.1 guidance (that variant stays reserved for a future S3 run).
- **LinkedIn:** Years of Experience filtered to 5+ across every audience build in §6.2,
  which mechanically excludes anyone who could be a fresher.
- **Creative itself does the rest.** None of the new hooks or briefs below make sense to
  someone with a year of experience; self-selection reinforces the platform-level exclusion
  rather than being the only thing doing the work.

The resume-uploaded ad-optimisation event from §3.5 and §12.2 doesn't change. What changes is
*whose* resume uploads this budget is trying to buy: fewer, senior, more likely to convert to
the paid tier once billing is live (§0.3), not more, cheaper, lower-LTV ones.

---

## 3. Channel roles — LinkedIn and Instagram do different jobs

The most important structural decision in this plan, so it gets stated plainly rather than
buried in a budget table.

**India cost reality (2026, directional — validate against your own first 2 weeks):**

| | Instagram / Meta | LinkedIn |
|---|---|---|
| CPM | ₹70–250 | ₹450–1,100 |
| CPC | ₹4–14 | ₹85–250 |
| Cost per landing-page view | ₹10–25 | ₹120–320 |
| Realistic cost per free signup | ₹50–180 | ₹450–1,400 |

LinkedIn costs roughly **8–15× more per click** in India. For a product whose core is free
forever and whose paid tier is a ₹399–999 pass, LinkedIn cannot be the volume channel. The
arithmetic doesn't survive contact: at ₹900/signup against a ₹399 pass you'd need a >225%
free→paid conversion rate.

**Therefore:**

- **Instagram is the acquisition engine.** Volume, cheap learning, creative iteration, top
  and middle funnel, all six segments. ~70–75% of spend.
- **LinkedIn is the precision and credibility engine**, restricted to three jobs:
  1. **Targeting you cannot buy elsewhere** — "3–6 years, at a named services company,
     skills include React" is impossible on Meta and trivial on LinkedIn. S1/S2/S6 only.
  2. **Thought Leader Ads** — sponsoring the founder's personal posts. These consistently
     beat company-page ads on CTR and cost-per-engagement, and for a pre-revenue,
     trust-heavy product, founder credibility *is* the asset.
  3. **Document Ads** — LinkedIn's native in-feed PDF. Best-in-class cost-per-lead for
     professional-audience tools and the perfect vehicle for the ATS checklist lead magnet.
     Meta has no equivalent.
- **Never run on LinkedIn:** broad prospecting, student/fresher targeting, awareness
  objectives, or anything you could run on Meta for a tenth of the price.

### 3.1 Budget allocation (test phase)

| Line | Share | Objective |
|---|---|---|
| IG/FB prospecting — broad + Advantage+ | 45% | Conversions → Resume Uploaded |
| IG/FB retargeting | 12% | Conversions → Signup |
| IG/FB creative testing (separate, capped) | 13% | Learning only |
| LinkedIn Thought Leader Ads (S1/S2) | 15% | Engagement + site visits |
| LinkedIn Document Ads (lead magnet) | 10% | Lead gen forms |
| LinkedIn retargeting (site visitors) | 5% | Conversions |

Run Meta ads on **Instagram + Facebook placements together**, not IG-only. IG-only is a
common and expensive mistake in India: Facebook feed and Reels frequently deliver the same
person at 40–60% lower CPM. Report on IG as a placement; don't restrict to it.

---

## 3.5 Funnel temperature — what this plan got wrong, per jaredrhod's marketing skill

**Status: revised 2026-09-19.** The rest of this document was written before installing
`jaredrhod-marketing` (see `09 - Marketing/` in the vault, or `~/.claude/skills/jaredrhod-marketing/`).
Running the plan back through it surfaced one real structural mistake, not a wording problem:
**v1 sent cold strangers straight to the biggest ask in the product.**

### The mistake

Cold does not mean sell. jaredrhod's rule: *"Cold means get their attention, give them
something good, get them pixeled, and figure out who's actually interested. Warm means ask
for a small step. Hot is where you sell the real thing."* The classic way to light money on
fire is showing a big offer to cold traffic, because a stranger doesn't trust you enough yet,
no matter how good the deal is.

§6.1 and §13 as originally written put `resume_uploaded` as the optimisation event for
**prospecting** ad sets from day one, and sent that same cold Instagram traffic straight to
`/honest`, `/services-to-product` or `/free`, each asking a stranger who has never heard of
JobMagnate to hand over their actual resume. Uploading a resume is a bigger ask than an
email opt-in: it's a real document, real employment history, and enough time invested in the
onboarding chat that it clears jaredrhod's own bar for what turns an opt-in into something
heavier ("what does the prospect give up: email, or time and access"). That's a warm-audience
ask, not a cold one. Asking for it on the first touch is the single most avoidable mistake in
the original plan, and it's exactly the kind of thing a broken-funnel diagnosis catches: good
CPC, high refusal past the click, and a media buyer wrongly blaming the ad.

### The corrected funnel, mapped onto what already exists in the product

jaredrhod's structure: **Content → Lead Magnet → Tripwire → Core Offer → Profit Maximizer.**
Mapped onto JobMagnate rather than invented fresh:

| Stage | What it is here | What the prospect gives up |
|---|---|---|
| **Content** | Reels and carousels teaching resume mechanics for free, no ask, no link out (§4.3, §10) | Nothing. Just attention, and it gets them pixeled |
| **Lead Magnet** | A specific PDF checklist, email only, delivered instantly (new: §4.3) | An email address |
| **Tripwire** | The 30-day full-access pass, granted free, no card, on signup and resume upload | Their resume, their time in onboarding. Real commitment, zero dollars |
| **Core Offer** | The per-job tailored resume + cover letter, once billing ships (`monetization_plan.md` Phase B) | Money, for the first time |
| **Profit Maximizer** | Undecided — a renewed/higher pass tier, or unlimited Assisted Apply, or a future premium layer (`BRD.md` §11 Phase 3). Flagged open, not a decision this document makes | TBD |

The pass already **is** the tripwire in every way that matters, even though no money moves.
jaredrhod lists "a free trial with no credit card" as his own highest-tier lead-magnet/tripwire
device precisely because it gets someone to commit real time before you ask for real money.
JobMagnate already built that mechanism into `monetization_plan.md` for an unrelated reason
(honesty about pricing) — it just wasn't being used as the funnel's actual second step here.
**No pricing or product change is being proposed.** This is purely a sequencing fix: don't
point cold ads at the tripwire. Point them at content, then a lead magnet, and let the pass
pick up from there once someone is already warm.

### What actually changes in this plan

1. **A real lead magnet gets built** (§4.3): a specific, email-gated PDF, not the resume
   upload itself. This is the true first ask.
2. **Cold Instagram spend in Phase 1 Week 1 runs content only** — Reels and carousels with
   no link, no CTA, optimised for watch-through and engagement, not conversions. Their entire
   job is to get people pixeled. §13 is revised accordingly.
3. **The lead-magnet ad only goes to people already pixeled by the content stage**, not
   straight to fresh cold traffic. §6.1 is revised accordingly.
4. **`resume_uploaded` stays the metric that matters most**, but it moves one step later in
   the paid-media sequence: content warms them, the lead magnet converts them to a lead, *then*
   the retargeting ad pitches the resume upload and the free pass. It was never wrong as a
   product-activation metric (§12 is unchanged there) — it was wrong as the very first thing a
   cold-traffic ad asks for.

---

## 4. Message → segment map, and the hook bank

### 4.1 Which message to which segment

| Segment | Core tension | Message that resolves it | Proof asset |
|---|---|---|---|
| S1 IT-services | "My resume makes 4 years look like 4 years of tickets" | Rewrites service-company work into outcome language — without inventing outcomes | Before/after diff of a services bullet |
| S2 Mid-level | "I don't need more listings, I need the right ones" | Match score with a written reason for every job | Match-explanation card |
| S3 Freshers | "I've applied to 300 and heard nothing" | Free forever, and it tells you *why* you're not matching | Free-forever card + skill-gap screen |
| S4 Active search | "40 minutes per application" | Tailored resume + cover letter per job, reviewed by you | 40-min → 3-min visual |
| S5 Returners | "Every tool wants me to hide or fake my gap" | It won't invent freelance work you didn't do. It positions what you actually did | Diff showing the gap handled honestly |
| S6 Remote-global | "Global roles need real tailoring, not a template" | Per-job tailoring with provenance | JD-paste → tailored resume demo |

### 4.2 Hook bank

Hooks are the first three words / first 1.5 seconds. Build ~40, ship 12, keep 3.

**Pattern interrupt / stat**
1. "You applied to 200 jobs. You got 3 replies. It isn't you." *(S3, S4)*
2. "A recruiter spends 7 seconds on your resume. The parser spends 0.3." *(all)*
3. "Your resume isn't bad. It's unreadable to the thing reading it." *(all)*

**Contrarian**
4. "Stop applying to more jobs. You're optimising the wrong number." *(S2)*
5. "Delete your 'Career Objective' section. Here's what goes there instead." *(S3)*
6. "AI resume builders are why you're getting rejected in round two." *(category attack)*
7. "Don't let AI *write* your resume. Let it *edit* it." *(all)*

**Trust / anti-slop — your ownable territory**
8. "It won't invent a job you never had." *(all)*
9. "Every word in it is yours. We just moved them." *(brand)*
10. "The AI that says 'not in your resume' instead of making it up." *(S5, S2)*
11. "We show you every single word we changed. Then you decide." *(all)*

**Identity / status**
12. "Service company → product company. The resume rewrite nobody explains." *(S1)*
13. "You did product work at a services company. Your resume doesn't say so." *(S1)*
14. "Coming back after a break? You don't need to hide it." *(S5)*

**Price / offer**
15. "Finding a job is free here. Forever. That's not a launch offer." *(all)*
16. "Your resume, your data, your download. No paywall on your own career." *(all)*
17. "30 days of everything. No card, because there's nothing to enter." *(retargeting)*

**Demo / curiosity**
18. "Paste any job description. Watch what happens." *(S2, S6)*
19. "This is what a 'good match' actually looks like." *(S2)*
20. "Here's the exact line that got this resume filtered out." *(S3)*

**Loss framing — read §14.2 before writing any of these**
21. "Notice period started. 60 days. Here's the plan." *(S4)*

### 4.3 The lead magnet, the actual first ask (new, per §3.5)

Per jaredrhod's rule, specificity is the whole game: *"narrow it down until one person reads
the title and instantly thinks 'that's exactly me.'"* One asset, one segment, one outcome.

**"5 Resume Lines That Are Getting You Rejected. Free PDF."**

Content: the exact five diffs already built for CAR-01 (§9), repackaged as a standalone
one-page PDF, delivered by email instantly on opt-in. Not the same thing as running CAR-01 as
an ad; CAR-01 stays a piece of free-standing content. This is that same insight turned into
something a stranger trades an email for.

- **Format:** checklist/report hybrid, jaredrhod's easiest-to-build, easiest-to-convert
  category. One page, five diffs, the provenance line under each. No signup required to read
  it, only to receive it: an actual squeeze page with exactly two options, opt in or leave, no
  nav, no other links.
- **Headline options**, built off his swipe-file formulas, ranked by which lever they pull:
  1. *(number + specificity)* "The 5 Resume Lines That Are Getting You Rejected. Free checklist."
  2. *(fear)* "One of these 5 lines is on your resume right now. Here's which one, and the fix."
  3. *(curiosity + credibility)* "The resume mistakes an ATS parser catches that you never will. Free PDF."
- **Delivery email does two things**, per the fundamentals: hands over the PDF, and pitches
  the tripwire-equivalent in the same message. *"Here's your PDF. One more thing: upload your
  actual resume and JobMagnate finds every line like this automatically, free for 30 days, no
  card."* That line is the bridge from lead magnet to the pass.
- **Benchmark:** opt-in rate on the squeeze page itself, not the asset. Under 25% needs work,
  25 to 35% is solid, above 35% is great, above 50% is reachable on an offer this specific to
  cold traffic. Track it as its own funnel step in analytics (§12.2), separate from
  `resume_uploaded`.
- **Where it runs:** the sole destination for every cold, non-video Instagram ad and the sole
  destination for retargeting audiences built off the content stage's video views and
  engagers (§3.5, §6.1). It is never the destination for a video ad while that video is still
  running cold, per §10.1.

### 4.4 The layoffs and AI angle (added 2026-09-19, this campaign's lead message)

Built for S4 as redefined in §2.2. The tension this angle resolves is sharper and more
specific than any other segment's, so it gets its own platform line rather than reusing §1.3.

**The campaign platform for this run:**

> ## You didn't get worse at your job. The org chart did.
> *AI didn't have to cost you this. Used honestly, it's what gets you the next one.*

**Why this framing, run through the "so what" test:** JobMagnate rewrites a long career
truthfully. So what? It gets past a screen tuned for someone five years into their career,
not fifteen. So what? A senior recruiter actually sees the real scope of what this person
owned. So what? They get taken seriously again, on the first look, not the fifth
resubmission. So what? They stop feeling like "the person who got laid off" and start
feeling like themselves again. That last one is the emotion being sold, and it's a dignity
claim, not a speed claim, which is why it needs its own platform line instead of borrowing
"every word is yours" as-is.

**The elephant in the room, addressed directly, per the copywriting playbook's transparency
principle:** this campaign is built by an AI product, aimed at people whose layoffs are
being publicly blamed on AI. That tension doesn't get hidden, it gets named and resolved in
the body copy: *"We're not going to tell you AI had nothing to do with this year's layoffs.
Some of that's real. What we're pointing out is that the AI that restructures a team and the
AI that's about to write your next resume don't have to be the same kind of AI. One replaces
judgment. Ours is built to respect it. It only rewrites what's already true, and shows you
every word it changed."* This is the villain-is-a-system move from the copywriting playbook
done correctly: the villain is dishonest or careless AI, never AI itself, because the product
being sold is also AI.

**Hook bank, written to clear §14.2 (Meta's personal-attributes policy) by construction.**
None of these assert the viewer's employment status in the second person; every one
describes the market or the mechanism in general terms and lets the right person self-select,
the same discipline the original hook bank already used for hook #1 and #3.

1. *(reframe, the platform line as a hook)* "You didn't get worse at your job. The org chart did."
2. *(general truth, safe)* "Companies keep calling it 'AI efficiency.' Fifteen years of real experience didn't get less valuable."
3. *(contrarian on AI, this campaign's category attack)* "AI didn't take your job. A decision did, and it hid behind AI to make it easier to announce."
4. *(identity, speaks to seniority without naming employment status)* "Most 'AI resume' tools are built for someone's first job. Yours has fifteen years in it, and it deserves to read that way."
5. *(elephant in the room, direct per the copywriting playbook)* "We're an AI product, talking to people AI got blamed for displacing. Here's the distinction that actually matters."
6. *(gain)* "Same experience. A resume that finally reads like fifteen years, not fifty keywords."
7. *(general truth, industry-level, safe)* "2026 has had more restructuring announcements than any year on record. None of them were a verdict on whether you're good at the work."
8. *(mechanism)* "The AI that replaced a role and the AI that gets you the next one aren't the same kind of AI. Here's the difference, in one diff."
9. *(dignity, quiet)* "A layoff is a business decision wearing a headline. Your resume shouldn't read like one."
10. *(demo/curiosity)* "Paste the job description. Watch how much of your actual experience it was already matching."

**A senior-specific lead magnet, distinct from §4.3's:** the existing "5 Resume Lines That
Are Getting You Rejected" leads with fresher-flavored examples (a generic Career Objective
line) that won't land with someone fifteen years in. Build a second, parallel asset for this
campaign rather than force one PDF to serve both audiences:

**"The Experience Tax: 5 Ways Long Resumes Get Buried by Short Screens."** Same format as
§4.3 (checklist, five diffs, provenance line, email-gated squeeze page), same delivery
mechanic (PDF, then the pass pitch in the same email), different content: a resume that lists
every role since 2008 instead of leading with relevance, a title-inflation pattern that reads
as vague rather than senior, a skills section that hasn't been touched since 2019, an
achievement written as a decade-long responsibility instead of a dated, scoped result, and a
length problem (three pages of history burying the two years that actually matter for the
next role). This is this campaign's actual first ask, replacing §4.3's version for S4
specifically; §4.3's original stays in rotation for S1/S2/S6 traffic in the same campaigns.

**New creative built for this angle:** IMG-09 (§8), CAR-07 (§9), REEL-05 (§10.2).

---

## 5. Brand theme for advertising

### 5.1 The tension to solve

`DESIGN_DOC.md` §3 specifies a UI that *"feels like a professional workspace rather than a
marketing site"* — calm, near-white, generous whitespace, editorial. Correct for the
product and **fatal in a paid social feed**, where near-white dissolves into Instagram's
white chrome and calm reads as invisible.

The answer isn't to abandon the brand. It's a **two-layer system** sharing one type system,
one colour grammar and one hero object.

### 5.2 The tokens (authoritative — from `design/redesign-2026/Foundations.dc.html`)

OKLCH values are the source of truth. Hex approximations are for ad tools that only accept
hex — **verify each at oklch.com before handing to a designer.**

| Role | OKLCH (authoritative) | Hex (approx.) | Meaning in ads |
|---|---|---|---|
| Accent / Teal | `oklch(0.63 0.108 185)` | ~`#159C9A` | **You.** Matches, verified facts, the improved line |
| Accent hover | `oklch(0.57 0.11 185)` | ~`#0C8B89` | Pressed / darker teal |
| Accent text | `oklch(0.44 0.09 185)` | ~`#0A6B6A` | Teal type on light |
| AI / Violet | `oklch(0.55 0.15 300)` | ~`#9145CE` | **The AI's contribution.** Only on AI-authored elements |
| Warning / Amber | `oklch(0.66 0.13 70)` | ~`#C8811F` | **Gaps.** Missing skills, things to fix |
| Success | `oklch(0.60 0.12 155)` | ~`#1E9460` | Approved / done |
| Danger | `oklch(0.57 0.17 25)` | ~`#CE4B3C` | Errors only — **never** on the user's own resume content |
| Ink (text) | `oklch(0.24 0.012 262)` | ~`#26282D` | Primary type |
| Text muted | `oklch(0.58 0.01 262)` | ~`#8A8D93` | Struck-through "old" copy |
| Paper (bg) | `oklch(0.985 0.002 255)` | ~`#FBFBFC` | Document ground |
| Surface | `#fff` | `#FFFFFF` | Cards |

**One new ads-only token** (belongs in the ad kit, not in `Foundations.dc.html`):

| Role | OKLCH | Hex (approx.) | Use |
|---|---|---|---|
| Deep Ink ground | `oklch(0.20 0.015 230)` | ~`#1B2126` | Full-bleed dark ground for feed-stopping creative |

**Typeface:** Geist and Geist Mono, matching `--font` / `--mono`. Both are OFL-licensed and
free for commercial use — keep the licence file with the ad kit. Geist Mono does real work
here: it's what makes a resume line read as *a document* rather than as marketing copy.

### 5.3 Layer A — "Document"

Near-white paper, Geist, teal accents, heavy whitespace. The resume, the diff or the match
card **is** the image. Feels exactly like the product.

- **Use for:** LinkedIn (all), Instagram mid/bottom funnel, retargeting, proof creative.
- **Why it works on LinkedIn:** LinkedIn's feed is dense, grey-blue and noisy. A clean white
  document with one teal mark is the actual pattern interrupt there — the inverse of
  Instagram.

### 5.4 Layer B — "Signal"

Deep Ink ground, one enormous Geist headline (96–160pt at 1080 wide), teal and violet as
the only colour, one small document fragment floating as evidence.

- **Use for:** Instagram cold prospecting, Reels covers, Stories, hook cards, carousel
  slide 1.
- **Rule:** never more than 9 words of headline. If it needs a subhead, it's a Layer A
  creative wearing the wrong clothes.

### 5.5 The colour grammar — enforce this everywhere

This is what makes twelve different creatives read as one brand:

- **Teal = the candidate's truth.** Their skills, their matched experience, the improved line.
- **Violet = the AI's suggestion.** Never on anything the candidate wrote.
- **Amber = a gap.** Honest, actionable, never shaming.
- **Struck-through grey = the old version.** Never red. Red on a person's own resume says
  "you were wrong." Grey says "there's a better way to say this." That single decision
  carries the whole brand promise.

### 5.6 The hero object: the diff

**The most ownable visual asset you have is the before/after resume line.** Nobody in this
category shows it, because showing it would reveal that their output is invented.

Canonical construction:

```
┌───────────────────────────────────────────────┐
│  BEFORE                                       │
│  ~~Responsible for handling client tickets~~  │  Geist Mono, grey, strikethrough
│  ~~and attending daily status calls.~~        │
│                                               │
│  AFTER                                ✦ AI    │  violet mark, tiny
│  Owned L2 resolution for a 40-seat client     │  Geist Mono, ink, teal left-rule
│  account; cut average ticket age 9d → 4d.     │
│                                               │
│  ⓘ Every figure came from your onboarding     │  teal, 11pt
│    answers. Nothing was invented.             │
└───────────────────────────────────────────────┘
```

That last line is the ad. Reproduce it on everything.

### 5.7 Secondary motifs

- **Match ring** — circular progress ring, teal arc, big Geist number, with the *reason*
  beside it in three bullets. Never show a score without its reason: that's the product
  principle and it's also what makes the screenshot credible.
- **Highlight underline** — a teal marker stroke under a matched skill inside a pasted JD.
  Implies "we actually read the JD" better than any copy line.
- **The Approve button** — the human-in-the-loop moment rendered literally. Use it as the
  last frame of every video.

### 5.8 Photography and people

- **No stock photos of people in suits shaking hands.** It is the visual signature of the
  exact low-trust category you're differentiating from.
- If people appear: real Indian candidates, real rooms (PG bedrooms, hostel desks, an
  office cafeteria), phone-shot, ungraded. In Reels, authenticity beats production value.
- **Never show a real person's real resume.** Build five fictional personas — Ananya (PM,
  4 yrs), Rohit (SDE-2, ex-services), Meera (returner, 3-yr break), Karthik (fresher,
  Tier-2), Sana (data analyst) — with consistent details reused across every creative. Add
  a small `Illustrative example` label anywhere a screen could be mistaken for real user
  data.
- **No third-party logos.** No LinkedIn wordmark, no Naukri, no employer marks. Say
  "service company" and "your LinkedIn profile" in words. See §14.3.

---

## 6. Campaign structure and targeting specs

### 6.1 Meta (Instagram + Facebook)

Keep the account **flat and consolidated**. India's cheap CPMs tempt people into 15 ad
sets of ₹300/day; every one of them starves in the learning phase. Meta needs roughly
**50 optimisation events per ad set per week** to exit learning.

**Structured in three temperature stages, per §3.5, not as one prospecting campaign.**
jaredrhod's rule on targeting: interests are dead weight now, lookalikes are what work, and a
lookalike is only as good as what you feed it, so the sequence below exists to feed it fast
rather than wait for hundreds of resume uploads before a lookalike exists at all.

```
CAMPAIGN 0 — JM | Content | Video Views / Engagement    [runs first, always on]
  ├─ AS1  Broad India 22–45, Reels + Stories            (no link, no CTA — pure content)
  └─ AS2  Broad India, feed static/carousel             (CAR-01, CAR-05 as organic-feeling posts)
  Job: get pixeled. Builds the video %-watched and engager audiences everything below feeds on.

CAMPAIGN 1 — JM | Lead Magnet | Conversions             [Advantage+ budget, CBO]
  ├─ AS1  Broad India 22–45, all placements             (no interests — creative targets)
  ├─ AS2  Video-viewers 25%+ from Campaign 0, 30d        (already pixeled, already warm)
  ├─ AS3  Advantage+ Audience w/ suggestion: S1 signals
  └─ AS4  Lookalike 1–3% of lead-magnet opt-ins          [seed as soon as ≥100 opt-ins exist —
                                                           do not wait for resume-upload volume]
  Job: the §4.3 PDF opt-in. Optimisation event is the lead magnet, never resume_uploaded.

CAMPAIGN 2 — JM | Retargeting | Conversions             [small budget, high frequency cap]
  ├─ AS1  Lead-magnet opt-ins, no resume uploaded 14d    ← highest-ROI audience you will have
  ├─ AS2  Site visitors 30d, excl. signed-up
  └─ AS3  IG/FB engagers 90d + video 75%-viewers 30d
  Job: pitch the resume upload + the free 30-day pass. This is the only campaign allowed to
  ask for the resume, because it is the only campaign not talking to strangers.

CAMPAIGN 3 — JM | Creative Testing | Engagement/Traffic
  └─ One ad set, 3–4 new creatives at a time, rotate weekly. Past 4, Meta stops splitting
     budget evenly and you can no longer tell who actually won.
```

Once `tailored_resume_generated` clears roughly 500 events, add a second Campaign 1 lookalike
seeded from it rather than from opt-ins, per §12.2 — it is a sharper audience once it exists,
it just doesn't exist on day one.

**Targeting notes that matter in India:**

- **Go broad, let the creative target.** Interests like "Job hunting" and "Naukri.com" are
  noisy, inflate CPM, and jaredrhod's own experience is that interest targeting has stopped
  working for him entirely; lookalikes off a real pixel are what carries the account now.
- Where you do use signals for S1 (AS3 above, as a hypothesis to beat broad, not a default):
  `Job interview`, `Résumé`, `Employment website`, `Information technology`, behaviour
  `Technology early adopters`, combined with education level and 22 to 34 age.
- **Exclusions are more valuable than inclusions.** Exclude existing users from all
  prospecting (upload the hashed email list weekly as a Custom Audience; see §14.4 for the
  consent constraint on doing that).
- Language: run English creatives primarily, but test **Hinglish** copy for S3. It routinely
  halves CPC for student audiences. Keep on-image text English (resume context).
- Geography: start Tier-1 + Tier-2 metros (Bengaluru, Hyderabad, Pune, NCR, Chennai,
  Mumbai, Ahmedabad, Kochi, Indore, Jaipur, Coimbatore, Bhubaneswar). Expand to all-India
  once CPA is stable. Tier-3 CPMs are lower, but intent and payment rates are too.

### 6.2 LinkedIn

Reordered per §2.2: S4 leads this campaign's LinkedIn spend, S1/S2 fold into the same groups
as secondary audiences rather than running as separately-prioritised campaigns.

```
CAMPAIGN GROUP — JM | S4 Laid off, experienced (this campaign's primary)
  ├─ Campaign  Thought Leader Ads (founder posts)      [Engagement — REEL-04, REEL-05 native cuts]
  ├─ Campaign  Single image → site                     [Website visits — IMG-09]
  ├─ Campaign  Carousel → site                         [Website visits — CAR-07]
  └─ Campaign  Document Ad — Experience Tax checklist  [Lead gen form — §4.4's lead magnet]

CAMPAIGN GROUP — JM | S1/S2 Services→Product, Mid-level switchers (secondary, same creative)
  ├─ Campaign  Thought Leader Ads
  ├─ Campaign  Single image → site                     [Website visits]
  └─ Campaign  Document Ad — ATS checklist             [Lead gen form — §4.3's lead magnet]

CAMPAIGN GROUP — JM | Retargeting
  └─ Campaign  Site visitors 90d + doc-ad openers      [Website conversions]
```

**S4 audience build (this campaign's primary spend, per §2.2):**

- **Years of Experience:** 10+ (mechanically excludes S3 per §2.2's exclusion requirement)
- AND **Job Seniority:** Senior, Manager, Director (not Owner/CXO, which skews toward people
  still employed and hiring, not searching)
- AND **Industry:** Information Technology, IT Services, Software Development, Financial
  Services Technology, e-commerce — sectors with visible 2026 restructuring, used as a
  policy-clean proxy per §14.2's compliance note, never paired with layoff-specific copy in
  the same targeting rationale documented for reviewers.
- AND **Locations:** India
- Do **not** add LinkedIn's "Recently changed jobs" facet to this build. It's a legitimate
  field on its own, but combined with this campaign's messaging it reads as exactly the
  employment-status inference §14.2 exists to catch. See §14.2 for the full reasoning.

**S1 audience build (secondary in this campaign, still the one LinkedIn is worth paying for
outside it):**

- **Member Companies:** the large Indian IT-services employers (add 15–25 by name in the
  targeting tool — do not name them in the creative).
- AND **Years of Experience:** 2–6
- AND **Member Skills:** React, Node.js, Java, Python, AWS, Salesforce, SAP, Data
  Analysis, QA Automation (build 3–4 skill-clustered variants rather than one mega-list)
- AND **Locations:** India
- Exclude: Job Seniority `Director`+, Company Size `1–10`

**S2 audience build:**

- **Job Titles:** Product Manager, Associate PM, Business Analyst, Data Analyst, Product
  Designer, UX Designer, Growth Manager, Operations Manager
- AND Years of Experience 3–8, India
- Layer **Member Interests** or **Member Groups** (career/product communities) as a
  variant test.

**S6 audience build:** Member Skills (Remote Work, Distributed Teams) + Job Function
(Engineering, Product, Design) + Years 3–10 + India, with `Member Interests: remote work`.

**LinkedIn settings that silently waste money — change all three:**

1. **Turn OFF "Enable the LinkedIn Audience Network"** for the first month. It spends a
   large share of budget on low-quality third-party inventory and will flatter your CPM
   while destroying your CPA.
2. **Audience expansion: OFF.** You are paying a premium precisely for precision.
3. **Bidding: Manual CPC** to start, well below the suggested range, then raise. LinkedIn's
   "Maximum delivery" will spend to the top of the range immediately.

**Do not use LinkedIn Message/Conversation Ads** for this product. They perform for B2B
enterprise offers and read as intrusive when the subject is someone's personal job search.

---

## 7. Creative formats and specs

| Placement | Ratio | Pixels | Notes |
|---|---|---|---|
| IG Feed (primary) | **4:5** | 1080×1350 | Default for everything. 25% more feed height than 1:1 |
| IG Feed (carousel) | 4:5 or 1:1 | 1080×1350 / 1080×1080 | All cards must share one ratio |
| IG Stories / Reels | 9:16 | 1080×1920 | Keep copy inside the middle 1080×1420 safe zone |
| Reels cover | 9:16 | 1080×1920 | Also crops to 1:1 in grid — design for both |
| FB Feed | 4:5 | 1080×1350 | Same asset as IG |
| LinkedIn single image | 1.91:1 | 1200×627 | Also ship 1:1 1200×1200 — it wins more often in-feed |
| LinkedIn carousel | 1:1 | 1080×1080 | 2–10 cards, ≤10 MB each |
| LinkedIn Document Ad | portrait PDF | A4 / 4:5 pages | 2–300 pages; keep to 8–12 |
| LinkedIn video | 1:1 or 9:16 | 1080×1080 / 1080×1920 | ≤30s for feed |

**Character budgets (before truncation):**

| Field | Meta | LinkedIn |
|---|---|---|
| Primary text / intro | ~125 chars visible | ~150 chars visible |
| Headline | ~27–40 chars | ~70 chars (≤70 avoids truncation) |
| Description | ~27 chars (often hidden) | n/a |

**Universal creative rules for this brand:**

1. Logo bottom-left, small, always. Never centred, never large.
2. One idea per creative. If you can't say it in nine words, it's a carousel.
3. Every creative that shows AI output must show the *provenance line* ("nothing
   invented" / "from your own resume"). It's the differentiator; don't drop it for space.
4. Never put a price in a prospecting creative. The pitch is free.
5. On-image text: Meta no longer enforces the 20% rule, but delivery still degrades with
   heavy text on prospecting creatives. Keep Layer-B headlines big and short, not dense.

---

## 8. Single-image ads — full briefs

Each brief is production-ready: platform, copy, and literal art direction.

### IMG-01 — "It won't invent a job you never had" *(IG, cold, all segments)*

- **Layer:** B (Deep Ink)
- **Format:** 1080×1350
- **Image content:** Full-bleed `#1B2126`. Centred, Geist SemiBold ~132pt, ink-white:
  **"It won't invent a job you never had."** Line breaks after "invent" and "never". Below,
  floating at a 3° tilt with a soft shadow, a small white card (≈620px wide) showing three
  resume lines in Geist Mono, the middle one struck through in grey, replaced beneath in
  teal. Bottom-left: wordmark in teal at 28pt. No other element.
- **Primary text:** "Most AI resume tools quietly add skills you don't have. That's why you
  clear the screen and fail the interview. JobMagnate only rewrites what's already in your
  resume, and shows you every word it changed before you approve it. Free to start."
- **Headline:** "The AI that won't lie for you"
- **CTA:** Learn more
- **Why it works:** it is the single claim no competitor can run.

### IMG-02 — "Every word is yours" *(IG + LinkedIn, brand)*

- **Layer:** A (Document)
- **Format:** 1080×1350 / 1200×1200
- **Image content:** Paper ground `#FBFBFC`. Upper two-thirds: a clean resume fragment in
  Geist Mono at readable size, with four phrases underlined in a teal marker stroke. Lower
  third, Geist Medium 84pt ink: **"Every word is yours."** Under it in muted grey 32pt:
  "We rewrote how it reads. Not what's in it." Thin teal rule, 2px, full width above the
  headline.
- **Primary text:** "Your career isn't a prompt. JobMagnate reads your actual resume,
  interviews you about your goals, and rewrites it into something an ATS and a human can
  both read, using only what's true."
- **Headline:** "Your resume. Rewritten, not reinvented."
- **CTA:** Sign up

### IMG-03 — "The diff" *(IG + LinkedIn, mid-funnel, S1)*

- **Layer:** A
- **Format:** 1080×1350
- **Image content:** The canonical diff card from §5.6, rendered large and alone on paper
  ground, occupying 70% of the frame. Above it, a small amber pill: `BEFORE / AFTER`. Below
  the card, one line in teal 28pt: "Both versions are true. Only one gets read."
- **Primary text:** "Four years at a services company reads as four years of tickets, not
  because you didn't do the work, but because nobody taught you how to write it. Paste it
  in. See the difference. Nothing gets invented."
- **Headline:** "Same experience. Different resume."
- **CTA:** Learn more

### IMG-04 — "Match ring" *(LinkedIn, S2)*

- **Layer:** A
- **Format:** 1200×1200
- **Image content:** White card, generous margin. Left: a 340px teal progress ring at 87%,
  number in Geist Medium 96pt ink, label "match" in muted 24pt. Right: three rows —
  teal check + "8 of 10 required skills", teal check + "Notice period fits their timeline",
  amber dot + "Missing: Kubernetes (2-week course suggested)". Bottom rule, then in
  Geist Mono 22pt muted: `Score explained, not asserted.`
- **Intro text:** "A match score without a reason is a horoscope. JobMagnate shows you
  which of your skills matched, which are missing, and whether the role actually fits your
  notice period and location, before you spend 40 minutes on the application."
- **Headline:** "See why you fit, before you apply"
- **CTA:** Visit website

### IMG-05 — "Free forever" *(IG + LinkedIn, retargeting)*

- **Layer:** B, but inverted — paper card on ink
- **Format:** 1080×1350
- **Image content:** Ink ground. Centred white card with a thin teal border. Inside, a
  two-column list. Left column header `FREE FOREVER` in teal caps 24pt, under it: Job
  matching · Match explanations · Master resume + PDF download · Skill-gap analysis ·
  LinkedIn review · Application tracking. Right column header `PAID LATER` in muted caps:
  Per-job tailored resume · Per-job cover letter · Unlimited autofill. Below the card,
  ink-white Geist 44pt: "Finding a job stays free. Forever."
- **Primary text:** "We'll be honest about the pricing before there is any. Everything you
  need to *find* work (matching, explanations, your master resume and its PDF) is free
  permanently, for everyone. We only ever charge for the per-job writing. Right now, even
  that's free for your first 30 days. No card."
- **Headline:** "Free where it matters. Permanently."
- **CTA:** Sign up
- **Why it works:** it answers the "what's the catch" objection that kills conversion for
  every free AI tool, and it is verifiably true per `monetization_plan.md`.

### IMG-06 — "The 7 seconds" *(IG, cold, S3)*

- **Layer:** B
- **Format:** 1080×1350
- **Image content:** Ink ground. A single enormous teal `0.3s` in Geist at 260pt, centred.
  Under it, ink-white 40pt: "That's how long software spends on your resume before a human
  ever sees it." Small white resume fragment at the bottom edge, half cropped off-frame,
  with two lines highlighted amber and a tag `unparsed`.
- **Primary text:** "Before a recruiter reads you, a parser does. It doesn't care about
  your two-column template, your icons, or your skills chart. It just fails to read them.
  JobMagnate rebuilds your resume so the machine can read it and the human still wants to."
- **Headline:** "Built for the parser. Written for the human."
- **CTA:** Learn more

### IMG-07 — "You don't need to hide the gap" *(IG, S5)*

- **Layer:** A
- **Format:** 1080×1350
- **Image content:** Paper ground. A resume timeline rendered as a horizontal rule with
  role blocks; one 3-year span is empty, marked with a soft teal bracket labelled
  `2022–2025 · career break`. No red, no warning icon, no amber. Beside it in ink 52pt:
  "It's a gap. Not a flaw." Small muted line below: "We won't fill it with freelance work
  you didn't do."
- **Primary text:** "Every AI resume tool we tried offered to invent consulting projects to
  cover a career break. We won't. JobMagnate positions the break honestly, foregrounds what
  you actually did before it, and builds the rest of the resume around real strength."
- **Headline:** "Returning to work? Start honest."
- **CTA:** Sign up

### IMG-08 — "Notice period" *(IG, S4, retargeting only)*

- **Layer:** B
- **Format:** 1080×1350
- **Image content:** Ink ground. A countdown rendered as 60 small squares in a grid; the
  first 9 filled teal, the rest hollow. Above: "Day 9 of 60." Below, ink-white 56pt: "You
  have time. You don't have 40 minutes per application."
- **Primary text:** "Serving notice means a fixed number of weekends to find the next
  thing. JobMagnate cuts the per-application work to minutes: matched roles with reasons,
  a tailored resume and cover letter drafted from your real experience, and you approve
  every word before it leaves."
- **Headline:** "Fewer applications. Better ones."
- **CTA:** Sign up

### IMG-09 — "The org chart, not you" *(LinkedIn + IG, S4, this campaign's lead static)*

- **Layer:** A (Document layer wins for this audience; LinkedIn's dense feed and a senior
  professional's own skepticism both favour restraint over the ink-ground Signal treatment)
- **Format:** 1200×1200 for LinkedIn, 1080×1350 for Instagram
- **Image content:** Paper ground. Upper half: a simple, undecorated org-chart fragment,
  three boxes and connecting lines in muted grey, one box crossed through with a single
  clean teal line, not an X and not red. Small teal caption beside the crossed-out box:
  "restructuring decision. not a performance review." Lower half, Geist Medium 76pt ink:
  "You didn't get worse at your job. The org chart did." Thin teal rule above the headline,
  full width. Wordmark bottom-left, small.
- **Primary text:** "Company after company is calling it 'AI-driven efficiency' this year.
  Whatever the real reason, it wasn't a judgment on fifteen years of real work. The actual
  problem now is different: getting that experience read correctly by whatever screens the
  next application. JobMagnate rewrites it truthfully, shows every word it changed, and you
  approve it before it goes anywhere."
- **Headline:** "Fifteen years, read correctly again."
- **CTA:** Learn more
- **Why it works:** it's the dignity reframe as the entire image, no fear-mongering, no
  invented statistic, one honest sentence next to the crossed-out box doing all the work.

---

## 9. Carousel ads — card by card

Carousels are the highest-value format for this product, because the whole pitch is
*"here is what actually happens, step by step."* Six below. Slide 1 is always Layer B (stop
the scroll); interior slides are Layer A (build trust); the last slide is always the offer.

### CAR-01 — "5 lines quietly killing your resume" *(IG, cold, S3/S4 — the sharing engine)*

Six cards, 1080×1350, 1:1-safe. Interior cards all use the diff construction from §5.6.

| # | On-image content | Card caption |
|---|---|---|
| **1** | **Layer B.** Ink ground. Geist 120pt teal-on-ink: "5 lines quietly killing your resume". Below in muted 30pt: "#3 is on almost every fresher CV." Small `swipe →` in teal, bottom right. | — |
| **2** | Layer A. Diff card. BEFORE (grey, struck): *"Career Objective: Seeking a challenging role in a reputed organisation where I can utilise my skills."* AFTER (teal rule): *"Backend developer, 2 yrs, Java + Spring. Looking for product teams shipping to real users."* | "An objective that could belong to anyone belongs to no one. Say what you are and what you want." |
| **3** | Diff card. BEFORE: *"Responsible for handling client tickets and daily status calls."* AFTER: *"Owned L2 resolution for a 40-seat account; cut average ticket age 9d → 4d."* Small violet `✦ AI` tag + teal note: "the 9d→4d came from your onboarding answers." | "'Responsible for' describes your job description. Recruiters hire for outcomes." |
| **4** | Diff card. BEFORE: a skills bar-chart graphic, greyed, tagged amber `parser sees: nothing`. AFTER: a plain comma-separated skills line, tagged teal `parser sees: 14 skills`. | "Skill rating bars look designed and parse as empty. Plain text wins." |
| **5** | Diff card. BEFORE: two-column layout thumbnail, greyed, amber tag `column order scrambled`. AFTER: single-column thumbnail, teal tag `reads top to bottom`. | "Two columns are beautiful in Canva and unreadable to an ATS." |
| **6** | Diff card. BEFORE: *"Worked on various technologies as per project requirement."* AFTER: *"Java, Spring Boot, PostgreSQL, AWS (EC2, S3), 2 yrs production."* | "'Various technologies' means the keyword filter never matches you." |
| **7** | **Offer card.** Layer B. Ink ground. Teal 72pt: "Upload yours. See all of them in 60 seconds." Muted 28pt: "Free. Nothing gets invented." Wordmark + URL. | "JobMagnate finds these automatically and shows you every fix as a diff, and you approve each one." |

- **Primary text:** "Not one of these is about writing 'better'. They're about being
  readable — to the parser first, the recruiter second. Swipe for all five (#3 is the one
  nobody tells freshers)."
- **Headline:** "Fix them free →"

### CAR-02 — "Service company → product company" *(IG + LinkedIn, S1 — your revenue segment)*

| # | On-image content | Card caption |
|---|---|---|
| **1** | Layer B. Ink. Two words stacked huge: "SERVICE" (muted grey) with a teal arrow down to "PRODUCT" (teal). Under: "The resume rewrite nobody explains." | — |
| **2** | Layer A. Split card: left "what you wrote", right "what they read". Left: *"Worked on client requirements in Agile."* Right, in a grey recruiter-note style: *"No ownership. No product sense."* | "The work was real. The language hid it." |
| **3** | Diff card. BEFORE: *"Handled change requests for the client's billing module."* AFTER: *"Shipped 11 changes to a billing system serving 200k end users; wrote the migration that cut failed invoices 6% → 0.4%."* | "Same job. The second version says who it was for and what moved." |
| **4** | Diff card. BEFORE: *"Followed SDLC and coding standards."* AFTER: *"Set the PR review checklist the 9-person team still uses."* | "Process participation → process ownership. Only if it's true." |
| **5** | Layer A. A callout card, teal border. Big ink text: "We will not write 'led a team of 12' if you didn't." Under it, muted: "Every claim traces to your resume or your onboarding answers. You see the source." | "This is the whole reason the tailored version survives the interview." |
| **6** | Layer A. Match ring at 84% against a mock product-company JD, with three teal matched bullets and one amber gap. | "Then it tells you which product roles you already qualify for, and which one skill is in the way." |
| **7** | Offer card. Layer B. "Your 4 years aren't the problem. The 4 bullets are." Teal CTA. | "Free to start. Upload your resume, see the rewrite." |

- **Primary text (LinkedIn):** "If you're 2–6 years into a services role and every product
  company application disappears, it's usually not the experience. It's that the resume
  describes a project you supported instead of a product you moved. Here's the rewrite,
  line by line."
- **Headline:** "Rewrite it without inventing it"

### CAR-03 — "How it actually works" *(IG + LinkedIn, mid-funnel, all)*

Product-demo carousel. Real UI screenshots, lightly cropped, on paper ground with a teal
step number in the corner of each.

| # | On-image content | Card caption |
|---|---|---|
| 1 | Layer B. "Upload → Match → Tailor → Approve." Each word teal, with connecting rules. Bottom: "Four steps. You approve the last one." | — |
| 2 | Real upload screen + parsed-profile screen, side by side, with teal confidence indicators visible. | "1 · Upload your PDF. It extracts your sections and tells you how confident it is about each field, so you can correct it." |
| 3 | Onboarding chat screenshot, 3 exchanges visible. | "2 · A short conversation about the role, location, notice period and comp you're actually after." |
| 4 | Master resume diff view, split screen. | "3 · Your master resume, rebuilt ATS-clean. Every change shown as a diff. You edit or reject any of them." |
| 5 | Job list with match rings and reasons. | "4 · Matched roles, each with the reason it matched and the skills you're missing." |
| 6 | Tailored resume + cover letter with a prominent **Approve** button, violet AI tags visible. | "5 · Per job, a tailored resume and cover letter, drafted only from what's already true, waiting for your approval." |
| 7 | Offer card: "Steps 1–4 are free. Forever." | "Only the per-job writing is ever paid, and your first 30 days of that are free. No card." |

### CAR-04 — "What 'ATS-friendly' actually means" *(LinkedIn Document Ad + IG carousel, lead magnet)*

Eight cards. Pure education, near-zero product. This is the asset that earns the follow and
the LinkedIn lead.

1. Cover — "What 'ATS-friendly' actually means (and what it doesn't)"
2. "It is not a template." — myth-bust, amber
3. Parsing order: single column, real headings, no text in headers/footers
4. File type: PDF is fine *if* the text layer is real — show a selectable-text demo
5. Keywords: mirror the JD's nouns, never stuff — show a stuffed example tagged amber
6. Dates: one consistent format, `MMM YYYY`, no gaps hidden by year-only tricks
7. The 6 things to delete today: photo, rating bars, icons, tables, text boxes, "References available"
8. "Want it checked automatically? It's free." + URL

### CAR-05 — "Coming back after a break" *(IG, S5)*

| # | Content | Caption |
|---|---|---|
| 1 | Layer B. "Three years out. Not three years behind." Teal. | — |
| 2 | The timeline visual from IMG-07, gap bracketed in teal, not red. | "The gap isn't the problem. Pretending it isn't there is." |
| 3 | Diff card: BEFORE — a resume that jumps 2022 → 2025 with no mention. AFTER — one honest line naming the break plus what was maintained. | "One sentence, stated plainly, removes the question from the recruiter's head." |
| 4 | Callout card, teal border: "We were offered the shortcut too. Every AI tool we tested suggested inventing freelance work. We hard-coded ours not to." | "Because an invented project is a question you can't answer in round two." |
| 5 | Skill-gap screen: three amber gaps, each with a suggested course. | "It shows what actually changed in your field while you were out, and the shortest path back." |
| 6 | Offer card. "Free. All of it." | — |

### CAR-06 — "Everything free vs. everything paid" *(retargeting, all platforms)*

Four cards. Short, pure objection-handling.

1. Layer B: "What's the catch?" (ink, teal question mark)
2. The free/paid split table from IMG-05, full card
3. "Your master resume PDF downloads free, forever. It's your data. Charging for it would be hostile."
4. "30 days of everything, granted on signup. No card, no checkout, nothing to cancel." + CTA

### CAR-07 — "AI took the blame. Here's how to use it instead." *(IG + LinkedIn, S4, this campaign's lead carousel)*

Seven cards. Opens by naming the tension directly, per the copywriting playbook's rule that
addressing the elephant in the room builds more trust than avoiding it, then resolves it with
the product mechanism rather than an argument.

| # | On-image content | Card caption |
|---|---|---|
| **1** | **Layer B.** Ink ground. Geist 108pt, teal on ink: "Everyone's blaming AI for the layoffs." Below, muted 28pt: "Some of that's fair." | — |
| **2** | Layer A. Plain statement, no chart, no stat: "Automation and 'efficiency' restructuring changed real roles this year. Pretending otherwise wouldn't be honest." | "We're not going to argue AI had nothing to do with it." |
| **3** | Layer A. A resume line, amber-tagged, with an invented achievement flagged: *"Spearheaded a cross-functional initiative that transformed departmental efficiency."* Amber tag: `not in your resume`. | "Here's the part that doesn't get said: most of the AI tools you'd use next are the same kind. Fast, confident, and willing to invent things to sound better." |
| **4** | Diff card, the canonical §5.6 construction. BEFORE (grey, struck): a vague inflated line. AFTER (teal rule): the same experience stated as a real, scoped result, with the provenance line beneath it. | "JobMagnate is built the other way. It only rewrites what's already true, and shows you every word it changed." |
| **5** | Match ring at 91%, with three reasons listed, one amber gap. | "It also tells you which parts of a long career this market is actually paying for right now, not just that you're 'a strong candidate.'" |
| **6** | Layer A callout, teal border: "One replaces judgment. Ours is built to respect it." | "That's the actual distinction. Not 'AI good' or 'AI bad.' Which AI, and what it's willing to make up to look impressive." |
| **7** | **Offer card.** Layer B. "Free to find work. Always." Wordmark + URL. | "Upload your resume. See what it actually finds, before you decide anything." |

- **Primary text:** "If a layoff this year got blamed on AI, you're allowed to be skeptical of
  an AI product asking for your resume next. Fair. Here's the one distinction that actually
  matters: whether it invents things to sound better, or shows you exactly what it changed
  and lets you decide. Ours does the second. Free to start."
- **Headline:** "The difference is which AI, and how it's used"

---

## 10. Video, Reels, and LinkedIn-native formats

### 10.1 Why video is not optional on Instagram, and why it doesn't link out

Static + carousel will carry mid-funnel, but Reels is where cheap reach lives in India in
2026. Budget for **at least 40% of Meta spend going to 9:16 video** once the first two
statics prove a message.

**Revised per §3.5: video ads run on the platform, not off it, until the viewer is warm.**
jaredrhod's rule is explicit and it changes this section materially from the original draft:
*"You do not send video viewers to a page. Far more people will watch a video in-feed than
will click off to go watch it somewhere else, and if they watch it on your landing page
instead of on the platform, you lose the pixel data."* A thru-play at ~3 seconds isn't a real
view either; build audiences off percentage watched (25% floor, then layer by depth: 50%,
75%, 95 to 100%), because someone who watched three-quarters of a Reel is a meaningfully
hotter prospect than someone who bailed at the hook.

That means **every Reel below ships as two cuts**, not one:

- **The cold cut (Campaign 0, §6.1):** no link, no URL, no on-screen CTA, no "swipe up." Ends
  on the last story beat. Its only job is the watch, and its only output is a pixeled,
  percentage-watched audience.
- **The warm cut (Campaign 2 retargeting, §6.1):** same footage, same hook, with the CTA
  frame restored at the end (Approve button tap, "free to start," the URL). Shown only to
  people who already cleared the 50%+ watched threshold on the cold cut, or who are already
  in the lead-magnet retargeting pool from §4.3.

**Format spine (the warm cut; drop the last row for the cold cut):**

```
0.0–1.5s   HOOK      one line of speech + one on-screen line. No logo, no intro.
1.5–4.0s   PROBLEM   name the specific pain. Face to camera or screen.
4.0–12s    PROOF     screen recording of the actual product doing the thing.
12–18s     TWIST     "and it won't invent anything." Show the provenance line.
18–22s     CTA       warm cut only. Approve button + "free to start" + URL.
```

Screen recordings should be **real, slightly imperfect, phone-held or screen-captured at
native speed with light trimming.** Over-produced motion graphics read as an ad and get
scrolled.

### 10.2 Reel scripts

**REEL-01 — "The 40-minute application" *(S4, S1)***
> **VO (0–1.5s, over a screen showing a JD):** "This job application took me forty minutes.
> Watch."
> **(1.5–4s):** Fast-cut of a person copy-pasting between a JD, a resume doc, and a cover
> letter template. Frustrated.
> **(4–12s):** Cut to JobMagnate. Paste the JD. Match ring resolves to 87% with three
> reasons. Tap tailor. Resume + cover letter draft appear with violet AI tags.
> **VO:** "Same job. It pulled from what's already on my resume."
> **(12–18s):** Cursor hovers a diff. On-screen text: **"Nothing here was invented."**
> **(18–22s, warm cut only):** Approve button tap. On-screen: "Free to start. jobmagnate.com"
> **(cold cut):** ends at 18s, on the diff. No URL, no CTA frame.

**REEL-02 — "I asked three AI tools to fill my career gap" *(S5, category attack)***
> Face to camera. "I have a three-year career break. I asked three AI resume tools what to
> do about it." Cut to three screen recordings, each suggesting invented freelance or
> consulting work. Beat. "All three offered to make something up. That's not a resume, it's
> a landmine." Cut to JobMagnate handling it honestly. "This one said no, and then it told
> me what I actually still have." CTA on the warm cut only.
> *This is the single highest-ceiling creative in the plan. It is a genuine demonstration, it
> attacks the category on ethics, and it is shareable, which is exactly what a Campaign 0
> content asset with no link should be optimising for. Record competitor screens yourself; do
> not name them on screen.*

**REEL-03 — "Read your own resume the way a parser does" *(S3, educational)***
> Screen recording: drop a beautifully designed two-column Canva resume into a plain text
> extractor. Show the scrambled output. "That's what the software read." Then the
> JobMagnate version, clean. "Same person. One of them is legible." CTA on the warm cut only.

**REEL-04 — Founder piece to camera *(brand, also the LinkedIn Thought Leader asset)***
> 45–60s, unpolished, one take. "I built a resume tool that refuses to lie. Here's why
> that's harder than it sounds." Covers: what every other tool does, the specific prompt
> constraint, the diff + approval step, and the free-forever line. No graphics. Runs as a
> Campaign 0 content asset on Instagram (no link) and unmodified as the LinkedIn Thought
> Leader sponsorship (§10.3), where a link in the comments is the platform norm.

**REEL-05 — "The layoff wasn't the problem. The resume was." *(S4, this campaign's lead
video, dignity + demo)***
> **(0–2s):** Text-on-screen open, no voice yet: **"If a layoff this year got blamed on AI,
> you've probably heard enough about AI."**
> **VO (2–5s), face to camera or clean text-on-screen:** "So here's the part that's actually
> fixable. It was never the fifteen years. It's how they're being read."
> **(5–14s):** Screen recording. Upload a resume. The parsed profile appears with a decade
> of real ownership visible, confidence indicators on each section.
> **VO:** "Most tools would either flatten this into generic bullets, or invent an
> achievement to sound more impressive. This one does neither."
> **(14–20s):** Cursor on a diff. On-screen text: **"Nothing here was invented."** Provenance
> line visible beneath the diff.
> **(20–24s, warm cut only):** Approve button tap. On-screen: "Free to start. jobmagnate.com"
> **(cold cut):** ends at 20s, on the diff, no CTA frame, per §10.1.
> *Runs as this campaign's primary Campaign 0 asset for S4. The opening line is written to
> clear §14.2: it references a public, general phenomenon (this year's AI-attributed
> layoffs), never the viewer's own employment status.*

### 10.3 LinkedIn Thought Leader Ads — the highest-leverage LinkedIn spend

Sponsor the founder's *personal* posts, not the company page's. Mechanics: the founder
posts organically → grant the Page permission in LinkedIn's Content Suggestions/Thought
Leader flow → sponsor the post from Campaign Manager.

**Four posts worth sponsoring, in order of expected performance:**

1. **"I hard-coded our AI to refuse to invent a job."** The prompt constraint, quoted
   verbatim from the codebase, plus why the shortcut is tempting. Technical credibility +
   ethics. This post is why S1/S2 will trust you with a resume.
2. **"Finding a job will be free on our product. Permanently. Here's the business model."**
   Publishing the actual tiering table. Radical-transparency posts perform
   disproportionately on Indian LinkedIn, and it pre-empts every "is it a scam" comment.
3. **"We rewrote 50 services-company resume bullets. Here are the 6 patterns."** Pure
   value, directly aimed at S1.
4. **"Why we won't build auto-apply."** Explains the `BRD.md` §11 gate in plain language.
   Counter-positions against every competitor advertising auto-apply, and turns a missing
   feature into a trust asset.

**Rule:** sponsor only posts that already earned organic engagement. A thought-leader ad on
a flat post just buys impressions for something people already ignored.

### 10.4 LinkedIn Document Ads — the lead magnet

Run CAR-04 as a **10-page PDF Document Ad** with a lead gen form. This is the best
cost-per-lead format on LinkedIn for a professional-consumer product, because the user
reads most of the value in-feed before the gate.

- Gate at page 3 of 10 (LinkedIn shows the first pages free).
- Form fields: first name, email only. Every extra field measurably raises CPL.
- Follow-up is an email sequence (§11.4), not a sales call.
- **Consent matters:** the lead form's custom consent checkbox is what later lets you
  upload that email to a Custom Audience. See §14.4.

---

## 11. Landing and conversion architecture

The best ad in this document will convert at 2% against the wrong landing page. Three
things matter more than the creative.

### 11.1 Do not send paid traffic to the homepage

`frontend/src/app/page.tsx` is a general-purpose landing page ("Get started free", "See why
you fit — before you apply", a Linear PM job card). It is good, and it is aimed at nobody
in particular.

Build **three segment landing pages** that continue the ad's sentence. Message match is the
single highest-leverage conversion lever available to you:

| Path | Segment | Hero line | Proof above the fold |
|---|---|---|---|
| `/services-to-product` | S1 | "Your four years weren't tickets. Your resume says they were." | The services→product diff, live |
| `/honest` | all cold | "It won't invent a job you never had." | The diff + provenance line |
| `/free` | retargeting, S3 | "Finding a job stays free. Forever." | The free/paid table |

Each page: one hero, one proof block, one three-step how-it-works, the free/paid table,
one CTA repeated three times. No nav. No footer links that leak.

### 11.2 The CTA is "Upload your resume", not "Sign up"

Activation for this product is **resume uploaded**, not account created. Every step between
the ad click and the upload box costs you 20–40%.

Strongly consider **letting the upload happen before the account exists** — accept the
file, parse it, show the extracted profile with confidence indicators, and ask for email
only when they want to save it. The parse output *is* the demo, and having seen it, the
signup is a trivially easy yes. If that's too large a change, at minimum put Google OAuth
first and make email/password secondary.

### 11.3 Make the trust promise visible on the page, not just in the ad

The ad's whole claim is trustworthiness. The landing page must pay it off within one
scroll, or the bounce is instant:

- A one-line data promise beside the upload box: *"Your resume is yours. Download or delete
  it any time."* Link to `/privacy` — you already shipped that page.
- The provenance line under any sample AI output.
- "No card required" adjacent to every CTA.

### 11.4 The email sequence, starting from the lead magnet, not from signup

Revised per §3.5: the sequence used to start at signup. It now starts at the actual first
funnel event, the §4.3 lead-magnet opt-in, because that's where an email address first
exists, and because jaredrhod's rule is to alternate deposits and withdrawals on the list
from the very first message, not just after someone becomes a user.

A free-tool signup who doesn't upload within 48 hours is gone. Six emails, the first one
firing before an account even exists:

| # | Timing | Type | Job |
|---|---|---|---|
| 0 | Immediately, on opt-in | Deposit + one small ask | Delivers the §4.3 PDF, then pitches the pass in the same email: "one more thing, upload your resume and JobMagnate finds every line like this automatically, free for 30 days, no card." Subject line: a variant of whichever §4.3 headline won the test in §13.1, per the rule that your subject line is just your page's headline in a different outfit |
| 1 | On signup (from email 0's link) | Deposit | Confirms the pass started, states days remaining plainly, one CTA: upload |
| 2 | +24h, if no upload | Deposit | The single highest-value teaching email, the 5 resume lines, not yet delivered as a full PDF if they skipped email 0. CTA: upload |
| 3 | +3d, after upload | Deposit | Delivers the product's actual best moment: the first 5 matches, each with its reason |
| 4 | +10d | Deposit | Skill-gap report plus one course. Pure value, no ask |
| 5 | Day 24 | Withdrawal, honest one | States plainly what stays free forever and what won't, with days remaining. No pressure, no manufactured urgency; the deadline is real and that's what makes it work |

Email 5 depends on §0.3's two remaining checks (deployment live, Razorpay in Live Mode).
Until both are confirmed, sending it would be a withdrawal with no way to complete the
transaction, which is worse than not sending it.

---

## 12. Measurement

### 12.1 Install this before spending anything

**See `docs/analytics_tracking_plan.md` for the full, file-by-file implementation** — GA4
via gtag, the typed event helper, every instrumentation call site with real line numbers,
server-side purchase tracking, first-touch UTM capture, and consent handling. Summary:

1. **GA4/gtag**, Consent Mode v2 from the first script tag, per that document's §3–§6.
2. **Meta Pixel** in `frontend/src/app/layout.tsx`, plus **Conversions API server-side**
   from the Node backend, deduplicated with a shared `event_id`. Browser-only pixel loses
   30–50% of India iOS conversions; CAPI is not optional in 2026. **Required, not optional**:
   without it, Campaign 0/1/2's lookalike and retargeting audiences in §6.1 cannot be built
   at all (`analytics_tracking_plan.md` §7.1).
3. **LinkedIn Insight Tag** + LinkedIn **Conversions API** for the same reason, required for
   §6.2's campaigns specifically (`analytics_tracking_plan.md` §7.2).
4. **One product analytics tool** (PostHog is the pragmatic choice, self-hostable, which
   matters given the resume-data sensitivity, and it gives you funnels the ad platforms
   can't).
5. **Consent gate.** Given DPDP (§14.4) and that you handle resumes, load marketing tags
   behind a consent banner, and pass Meta's consent mode signals.

### 12.2 The event schema

Revised per §3.5: a lead-magnet event now sits ahead of `sign_up` in the funnel, and it's the
event Campaign 1 (§6.1) actually optimises for, not `sign_up` itself.

| Event | Fires when | Role |
|---|---|---|
| `video_watched_25pct` / `_75pct` | Meta-native video thresholds, Campaign 0 | Builds the retargeting/lookalike pool that feeds Campaign 1 |
| **`lead_magnet_optin`** | §4.3 PDF delivered | **Primary Campaign 1 optimisation event** — the true first ask |
| `Lead` / `sign_up` | Account created | Volume metric; not an ad-optimisation target on its own |
| **`resume_uploaded`** | File accepted + parsed | **Primary Campaign 2 (retargeting) optimisation event** |
| `profile_completed` | Onboarding chat finished | Activation depth |
| `master_resume_generated` | Master v1 saved | True "aha" moment |
| `job_match_viewed` | First match detail opened | Engagement |
| **`tailored_resume_generated`** | First per-job artifact | **Paid-intent proxy, the most valuable signal you have** |
| `cover_letter_generated` | First cover letter | Paid-intent proxy |
| `extension_installed` | Chrome extension installed | Retention signal |
| `purchase` | Razorpay success | Phase B only |

**Optimisation target, staged by funnel position and volume:**

- **Campaign 0 (content):** no conversion event at all. Optimise for ThruPlay / engagement.
  Its entire output is pixel data and the video-watched audiences above.
- **Campaign 1 (lead magnet):** optimise for `lead_magnet_optin` from day one, regardless of
  volume. This is the cold-traffic ask, and it's sized to what a stranger will actually give
  up (§3.5), so it doesn't need `sign_up`'s volume crutch to leave learning.
- **Campaign 2 (retargeting):** optimise for `resume_uploaded`. This is the only campaign
  allowed to ask for it, because it's the only campaign not talking to strangers.
- **Once billing is live:** value-optimise on `purchase`, with `tailored_resume_generated`
  as the lookalike seed.

Seed the Campaign 1 lookalike from `lead_magnet_optin` as soon as ~100 exist (§6.1); move to
`tailored_resume_generated` once it clears ~500, never from all signups. A 1% LAL off 500
people who generated a tailored resume is worth more than a 3% LAL off 10,000 signups.

### 12.3 The north-star ad metric

> **CPAU — Cost Per Activated User** = spend ÷ users who uploaded a resume *and* generated
> a master resume.

Report CPAU by segment, by creative, weekly. Signup CPA is a vanity number for a free tool;
half of it is curiosity.

Secondary: **D7 tailored-resume rate** (of activated users, % who generate a tailored
resume within 7 days). That is your leading indicator of paid conversion, available months
before you have revenue data.

### 12.4 UTM convention

```
?utm_source={li|ig|fb}
&utm_medium=paid_social
&utm_campaign={segment}_{objective}      e.g. s1_prospecting
&utm_content={creative_id}               e.g. car02_v3
&utm_term={audience_id}                  e.g. broad22-45
```

Creative IDs must match the filenames in §15 so a report row maps to a file without a
lookup.

### 12.5 Attribution honesty

Meta will over-claim and LinkedIn will under-claim; both will disagree with PostHog. Pick
**one** source of truth for decisions, your own backend's first-touch UTM on the user record,
and use the platforms only for in-platform optimisation. Run a weekly blended check: total
spend ÷ total new activated users, regardless of what any dashboard claims.

### 12.6 Turn CPAU into a verdict, not a feeling (new, per jaredrhod's analytics playbook)

His rule: decide your thresholds before you look at the number, so the number makes the call
instead of you staring at a dashboard trying to decide how you feel about it. This needs one
input JobMagnate doesn't have yet, so it's staged in two versions.

**Before billing ships (now):** there's no revenue-per-user yet, so there's no real LTV to
threshold against. Use the placeholder rule already in §13's kill criteria (CPAU > ₹400 after
₹25,000 spend across three hooks) as a floor, not a verdict, and don't scale spend on the
strength of it. The 30-day pass means every cohort acquired before billing is unpriced.

**Once billing ships (Phase 2):** compute a real LTV (initial pass revenue + expected renewal,
even a rough first estimate) and set the three thresholds jaredrhod uses on every campaign:

| CPAU as % of LTV | Verdict | Action |
|---|---|---|
| Under 50% | **Scale** | Raise budget on winners |
| 50 to 80% | **Hold** | Leave it running, keep testing creative |
| Over 80% | **Kill zone** | Fix the creative or the page, or turn it off. Don't argue with it |

This replaces "does this feel expensive" with a number that decides for you, and it's the
same logic that already justifies overspending a thin-margin competitor once a real funnel
exists behind the ad: whoever can afford to pay the most for a customer wins, and LTV is the
only number that tells you what you can actually afford.

---

## 13. Phasing, budget and test calendar

### Phase 0 — Unblock (2 weeks, ₹0 media)

Domain registered, mapped, verified on both platforms · Pixel + CAPI + Insight Tag +
PostHog live and event-verified, including the new `lead_magnet_optin` and
`video_watched_25/75pct` events from §12.2 · Meta Business Manager + Page + IG professional
account + LinkedIn Page + Campaign Manager set up and identity-verified (LinkedIn's
advertiser verification takes days, start it first) · three landing pages built · **the §4.3
lead-magnet squeeze page and PDF built and tested end-to-end (opt-in → email delivery →
tripwire pitch)** · five personas' sample assets produced · Razorpay KYC in progress.

**Do not skip the verification lead time.** It is the most common reason a launch date
slips by three weeks.

### Phase 1 — Learn (4 weeks, ~₹60,000), restructured per §3.5 into three real stages

Revised from v1: the original Phase 1 ran everything as one "prospecting" line straight to a
conversion objective. It now follows the Campaign 0/1/2 structure in §6.1, in sequence, not
all at once, because Campaign 1 and 2 need Campaign 0's pixel data to have anything to target.

| Line | Daily | Total | Weeks active |
|---|---|---|---|
| Meta content (Campaign 0, no link) | ₹500 | ₹14,000 | 1–4, always on |
| Meta lead magnet (Campaign 1) | ₹900 | ₹18,900 | Starts week 2, once Campaign 0 has run 7 days |
| Meta creative testing | ₹400 | ₹11,200 | 1–4 |
| Meta retargeting (Campaign 2) | ₹200 | ₹5,600 | Starts week 3, once opt-ins exist to retarget |
| LinkedIn Thought Leader Ads (S1 only, 11 days) | ₹900 | ₹9,900 | 3–4 |

**Week 1:** Campaign 0 only. REEL-01 and REEL-02 cold cuts (no CTA), CAR-01 and CAR-05 as
organic-feeling feed posts. Nothing sends anyone anywhere. The entire job is pixel volume and
building the video-watched audiences. Also run the creative-testing line here, cold, on the
lead-magnet headline options from §4.3, so by week 2 there's already a winner.

**Week 2:** turn on Campaign 1, pointed only at the §4.3 squeeze page, targeted first at
Campaign 0's video-watchers and engagers (already warm), then broad. This is the first ad
that asks for anything, and what it asks for is an email.

**Week 3–4:** turn on Campaign 2 once there's a real opt-in pool to retarget. This is the
only campaign that pitches the resume upload and the free 30-day pass. Add REEL-01/02 warm
cuts here (CTA restored), plus IMG-01, IMG-02 and IMG-05, which all ask for the resume and
therefore never belonged in front of strangers per §3.5.

**What Phase 1 must produce:** a `lead_magnet_optin` cost benchmark and opt-in rate (target
25 to 35%+ on the squeeze page, per jaredrhod's own benchmarks in §4.3), a CPAU benchmark on
the Campaign 2 audience specifically, one hook that beats the others by >30%, and 300 to 700
activated users. It is not expected to produce revenue; billing doesn't exist yet.

**Kill criteria:** CPAU > ₹400 after ₹25,000 spent on Campaign 2 with three distinct hooks
tested. Stop, and treat it as a message or product-onboarding problem, not a budget problem.
If the squeeze page itself is under 25% opt-in after 100+ clicks, that is a page problem
specifically (per jaredrhod's diagnosis rule: good clicks, bad page result means fix the
page, not the ad), and the fix is the headline or the offer, in that order.

### Phase 2 — Validate (4 weeks, ~₹1,50,000) — **requires billing live**

Add: LinkedIn Document Ads + lead gen, LinkedIn S2 campaign, the Campaign 1 lookalike seeded
from `tailored_resume_generated` once it clears ~500 (§12.2), the Reels-heavy rotation, and
the day-24 conversion email (§11.4).

**What Phase 2 must produce:** a real free-to-paid conversion rate on a cohort acquired by
ads, and therefore your first true CAC:LTV number and the real §12.6 thresholds.

### Phase 3 — Scale (ongoing)

Scale only using the §12.6 thresholds once they're real (CPAU under 50% of LTV). Scale by
*budget on winners*, not by adding ad sets. Raise a winning ad set's budget by no more than
25 to 35% every 2 to 3 days; jump it further and you kill the ad's conversion rate on the
spot rather than growing it.

### 13.1 Test calendar

Revised so weeks 1–2 test the actual first ask (the lead magnet), not the resume-upload
pitch, which now only ever runs warm.

| Week | Test | Decision |
|---|---|---|
| 1 | Lead-magnet headline: 3 options from §4.3's swipe-file formulas | Which one clears 25%+ opt-in |
| 2 | Content hook: REEL-01 vs REEL-02 vs CAR-01, cold cut, ThruPlay rate | Where to put Campaign 0 budget |
| 3 | Retargeting hook on the warm pool: IMG-01 (honesty) vs IMG-06 (ATS fear) vs IMG-05 (free) | Which angle converts an already-warm lead into a resume upload |
| 4 | Landing page: `/honest` vs homepage, warm traffic only | Message-match lift, quantified |
| 5 | Layer A vs Layer B on the same message | Settles the design question with data |
| 6 | Hinglish vs English primary text, S3 | CPC reduction |
| 7 | LinkedIn: Thought Leader vs Page single image, same copy | Confirms or kills the LinkedIn thesis |
| 8 | CTA: "Upload your resume" vs "Get started free" | Activation-rate lift |

One variable at a time, 3 to 4 variants per test, never more. Past four, Meta stops splitting
budget evenly and the result stops being readable. Minimum ₹8,000 or 100 clicks per variant
before reading it.

---

## 14. Policy and compliance

The fastest way to lose a month is an ad account restriction. Three of the four risks below
are specific to *this* product category.

### 14.1 Meta Special Ad Category — check before the first campaign

Meta requires ads that promote **employment opportunities** to be declared in a Special Ad
Category, which strips age/gender/detailed targeting and blocks standard lookalikes.

JobMagnate advertises a *tool for candidates*, not a job listing, so it should fall outside
it — but enforcement is automated and imperfect, and the category's geographic scope has
expanded over time. **Verify the current requirement in Ads Manager at setup**, and if the
toggle is required for India, the plan changes materially: no lookalikes, no age targeting,
and §6.1's AS3 is dead. Budget shifts to creative-led broad targeting, which the plan is
already largely built around.

### 14.2 Meta's "personal attributes" policy — the likeliest rejection

You may not imply that you know a person's personal attributes, **including employment
status**. This policy rejects job-seeker ads constantly, and most advertisers never work
out why.

| Will get rejected | Write this instead |
|---|---|
| "Are you unemployed?" | "Job hunting in 2026?" |
| "Struggling to find a job?" | "The job search is broken. Here's a better loop." |
| "You've been rejected 200 times" | "200 applications, 3 replies is normal. It shouldn't be." |
| "Laid off? We can help." | "Between roles? Start with the resume." |
| "Your resume is bad" | "Your resume isn't bad. It's unreadable to the parser." |

**The rule: describe the situation in the third person or as a general truth. Never address
the reader's state with "you are."** Note hook #1 and #3 in §4.2 are already written this
way deliberately — keep that discipline when writing new ones.

The same principle applies on LinkedIn, which has an equivalent restriction.

**How this applies to §2.2 and §4.4's layoffs campaign specifically**, since it's the
highest policy-risk work in this document and the brief behind it is explicitly to target
this population: the policy governs the *ad's copy and imagery*, not the audience-selection
mechanics behind it, and those are two different problems with two different fixes.

- **What every hook in §4.4 already does:** references the layoffs as a public, general
  2026 phenomenon ("companies keep calling it," "this year's restructuring announcements"),
  never as an assertion about the specific viewer's employment status. That's what clears
  review. Any new hook for this campaign must pass the same test before it ships: read it in
  the second person, and if it tells the reader something true about their own life that they
  never told the platform, rewrite it.
- **How to actually reach this audience, since "target laid-off people" isn't a selectable
  field on either platform:**
  - **LinkedIn** has real, policy-clean proxies: Years of Experience (10+), Seniority
    (Senior IC, Manager, Director), and Industry filtered to sectors with visible 2026
    restructuring (tech, IT services, SaaS). These are profile facts the member entered
    themselves, not an inference about their current employment status, which is the
    distinction that keeps it compliant. Do **not** use LinkedIn's "Recently changed jobs"
    facet for this campaign; it's a real, legitimate field, but pairing it with layoff
    messaging reads as exactly the inference the policy exists to prevent, even though the
    targeting mechanic itself is allowed.
  - **Meta** has no comparable seniority facet worth trusting (§6.1's broad-targeting
    reasoning applies doubly here). Reach this audience the way §6.1 already reaches
    everyone: broad, age-floored per §2.2, and let the Campaign 0 content and the REEL-05
    hook do the self-selection. The people this lands for will recognise themselves in it;
    the ad never has to say it for them.
  - **Retargeting** is the compliant version of what "target laid-off people" is actually
    reaching for: anyone who engaged with REEL-05, CAR-07, or IMG-09 has behaviourally
    self-selected into this audience by watching or clicking, which is a real signal Meta is
    allowed to act on, unlike an inferred personal attribute.

### 14.3 Trademarks and platform marks

- **No LinkedIn logo, wordmark, or brand-blue** in any creative — including the LinkedIn
  review feature's ads. Describe it in words: "a review of your LinkedIn profile." LinkedIn's
  ad policies restrict use of its marks, and you'd be using them *on LinkedIn*.
- **No employer logos.** Not TCS, Infosys, Accenture, not the mock job cards. Use
  "a large services company" and invented company names in mockups (the landing page's
  "Linear · Remote" job card should become a fictional company before it appears in an ad).
- **No Naukri/Indeed/Wellfound marks**, and no copy implying integration with them —
  `BRD.md` §7.1 is explicit that no such integration exists.
- **Chrome extension:** once listed, you may say "Chrome extension" but should avoid
  Chrome's logo and colours in ad creative.

### 14.4 India DPDP Act — this one has teeth for a resume product

The Digital Personal Data Protection Act requires clear, purpose-specific consent before
processing personal data, with notice at collection.

Two concrete implications for advertising:

1. **You cannot upload your user email list to Meta or LinkedIn as a Custom Audience unless
   users consented to that use specifically.** Add a marketing-consent checkbox at signup
   and on the LinkedIn lead form, and only upload consenting users. This matters most for
   the *exclusion* audiences in §6.1, which are otherwise your cheapest optimisation.
2. **Tags load after consent.** Load the Pixel and Insight Tag behind the banner, with
   Meta's consent mode signals passed through.

Get the lead form's consent language reviewed. The cost of doing it now is one hour.

### 14.5 Claims substantiation (ASCI)

Any objective claim needs evidence you could produce on request. Ban from all copy until
you have data: interview-rate multiples, ATS pass rates, time-to-hire, "#1", "best". The
`monetization_plan.md` free-forever claim **is** substantiated — it's a written policy — so
it is safe and should be used heavily. If you ever cite a third-party statistic (the "7
seconds" or any percentage), keep the source on file and cite it on the landing page.

### 14.6 Testimonials

Real users, written consent on file, no compensation without disclosure, no invented
personas presented as customers. Until you have consented testimonials, use **product
proof** (the diff, the match explanation) rather than social proof. For this brand that is
arguably stronger anyway — a screenshot of an honest diff is more persuasive than "Great
app! — Rahul S."

---

## 15. Production checklist

### 15.1 Asset list for Phase 1

**Brand kit (once)**
- [ ] Ad-kit token sheet: hex conversions verified at oklch.com, incl. the Deep Ink ground
- [ ] Geist + Geist Mono installed, OFL licence filed with the kit
- [ ] Logo lockups: teal-on-ink, ink-on-paper, mono
- [ ] The diff-card component as a reusable Figma component
- [ ] Match-ring component
- [ ] Five personas, with their resume text written once and reused everywhere
- [ ] `Illustrative example` label component

**Statics** — IMG-01, 02, 05 at 1080×1350 + 1200×1200 + 1080×1920
**Carousels** — CAR-01 (7 cards), CAR-02 (7 cards) at 1080×1350
**Video** — REEL-01, REEL-02 at 1080×1920, with burned-in captions (most viewers are muted)
**Landing** — `/honest`, `/services-to-product`, `/free`
**Doc** — CAR-04 exported as a 10-page PDF for Phase 2

### 15.2 File naming (must match `utm_content`)

```
jm_{type}_{segment}_{shorthook}_{ratio}_v{n}
jm_img_s1_diff_4x5_v1.png
jm_car_s3_5lines_4x5_v2_card03.png
jm_vid_s4_40min_9x16_v1.mp4
```

### 15.3 Weekly operating rhythm

- **Monday:** pull spend, CPAU, D7 tailored-resume rate by creative. Kill anything >1.5×
  the account CPAU after ₹5,000 spend.
- **Wednesday:** launch the week's new creatives into the testing campaign only.
- **Friday:** graduate winners into the prospecting campaign; write next week's test brief.
- **Monthly:** refresh creative. Frequency >2.5 on a prospecting ad set in India means the
  creative is done, not the audience.

---

## 16. Open decisions needed before this plan can execute

1. ~~**Domain**~~ — resolved, `jobmagnate.com` is live. (§0.1)
2. ~~**Public product name**~~ — resolved, `JobMagnate`. (§0.5)
3. **Billing deployment** — is today's payments work committed and deployed, and is Razorpay
   in Live Mode rather than Test Mode? Phase 2 cannot start before both are true. (§0.3)
4. **Who runs the account** — in-house or an agency. At ₹60k/month a freelance media buyer
   at ₹20–30k/month is usually net-negative; at ₹3L/month it is clearly worth it.
5. **Is the founder willing to be on camera and to post personally?** The plan's two
   highest-leverage assets (REEL-02, LinkedIn Thought Leader Ads) depend on yes. If no,
   reallocate that 15% of budget to Meta and accept a weaker LinkedIn ceiling.
6. **Anonymous-upload-before-signup** (§11.2), a product change with large conversion
   impact. Worth scoping as a spike before Phase 2.
7. **Sign-off on the §4.3 lead magnet as the actual first ask**, since it changes Phase 1's
   week-1 media plan from "run the resume-upload ads" to "run content only, then a PDF opt-in,
   then the resume ask." This is the single biggest structural change in this revision and is
   worth a deliberate yes before Phase 0 wraps.

---

## Appendix A — The one-paragraph version

Instagram is the engine, LinkedIn is the scalpel. The campaign platform is **"You didn't get
worse at your job. The org chart did"** for this run specifically: the primary audience is
experienced professionals (5 to 18+ years) hit by 2026's AI-attributed layoffs, chosen
because urgency plus real savings converts to the paid tier, not because freshers are
excluded from the product, just from this particular campaign's budget. The underlying brand
claim, "every word is yours," and the free-forever policy are still the only two claims in
this category that competitors structurally cannot copy, and both are already true in the
codebase; the layoffs angle is this run's specific application of that same honesty, aimed
at people currently skeptical of AI for a very concrete reason. The hero visual is the
before/after resume diff with a provenance line, in a two-layer system: near-white
"Document" for LinkedIn and proof, deep-ink "Signal" for Instagram cold traffic. Cold traffic
never sees the resume-upload ask: content first, a specific lead magnet second (a
senior-specific one for this campaign), the resume upload and free pass only once someone is
already warm, and the paid tailored resume available now that Razorpay is integrated.
Optimise for the lead magnet opt-in on cold traffic and the resume upload on retargeting,
never for signups or the purchase itself. The domain and the payment gateway are both real
as of today; the one thing standing between this plan and a real launch is that no
conversion tracking is installed yet.

---

## Appendix B — What changed in this revision, and why

Run through `jaredrhod-marketing` (installed 2026-09-19, see `09 - Marketing/` in the vault)
on request, to check the plan against a real funnel framework rather than against nothing.
One structural finding, not a copy-polish pass:

**The core mistake:** v1 treated `resume_uploaded` as both the thing to measure and the thing
to ask cold strangers for, on the very first ad they ever saw. Those are different jobs. It's
right as an activation metric and wrong as a cold-traffic ask, because it's a bigger
commitment than jaredrhod's own line for what a lead magnet may ask for, which is an email
and nothing else.

**What that produced, concretely (§3.5, §4.3, §6.1, §10.1, §11.4, §12.2, §12.6, §13):**

- A real lead magnet, a specific PDF, not the resume itself, as cold traffic's actual first
  ask, with its own squeeze page and its own opt-in benchmark.
- The 30-day pass reframed as what it already functionally is: a zero-dollar tripwire, the
  moment of real commitment that should only ever be pitched to someone already warm.
- Meta restructured into three temperature-matched campaigns (content, lead magnet,
  retargeting) instead of one prospecting campaign asking for everything at once.
- Every cold Reel now ships as two cuts, an unlinked content version and a linked warm
  version, because video that sends cold viewers off-platform loses the one thing it was
  building: the pixel.
- A concrete LTV-based scale/hold/kill table (§12.6), replacing "does this feel expensive."
- Seventeen em-dashes removed from copy meant to actually ship in an ad, headline, or email
  subject line, per both the skill's own rule and the standing vault rule against them in
  published copy. Left untouched in this document's own analytical prose, which is a planning
  document, not an ad.

**What didn't change:** the audience segments, the brand system, the OKLCH tokens, the
compliance section, and the core campaign platform line. Those held up against the skill
rather than being contradicted by it. "Every word is yours" already passes jaredrhod's gut
check for a headline: it names the benefit to the reader, not the product, and it survives
the "so what" test (rewrites truthfully → your real experience gets represented → you get
taken seriously → you get the interview) all the way to the actual emotion being sold.

---

## Appendix C — Second revision, same day: real domain, real billing, real campaign brief

Three factual corrections and one new campaign direction, all from direct instruction rather
than further review against the skill.

**Corrections to Appendix B's assumptions:**

- **`jobmagnate.com` is live in production.** `INFRASTRUCTURE.md`'s "no custom domain
  mapped" was stale, not current. §0.1 revised; every reference to the staging `*.run.app`
  hostname removed from this document.
- **Billing is built.** Razorpay Standard Checkout, real pricing (₹399 / ₹999 / ₹4,999),
  signature-verified with a webhook fallback, per `backend/src/routes/payments.routes.ts`.
  §0.3 revised from "not live" to "confirm deployment and Live Mode." Every placeholder
  ₹199–499 price in this document corrected to the real ₹399–999 range.
- **The brand name is `JobMagnate`**, not `Jobmagnate`. Corrected globally.

**What stayed the same, confirmed rather than changed:** the ad-optimisation objective.
Direct instruction: *"I would still like to target the resume-uploads rather than signups or
even paid plans in this campaign."* Billing going live doesn't move this plan off
`resume_uploaded` (§3.5, §12.2); it just means the LTV thresholds in §12.6 will have real
`purchase` data to compute against sooner than expected.

**The new campaign direction (§2.2, §4.4, IMG-09, CAR-07, REEL-05, §6.2, §14.2's addition):**
this run targets experienced, laid-off professionals rather than freshers, built around the
2026 narrative that AI is responsible for a wave of layoffs. The product's existing
anti-hallucination claim turned out to map onto this almost exactly: the same "does this AI
invent things or not" question a laid-off candidate is asking about the labor market is the
exact question this product already answers about itself, so the new platform line ("you
didn't get worse at your job, the org chart did") and the "which AI, not whether AI" reframe
weren't invented from nothing, they were already latent in §1.2's core claims and just
hadn't been pointed at this audience yet. The heaviest engineering-adjacent work in this
revision was §14.2's addition: this is the single highest platform-policy-risk campaign in
the document by a wide margin, because the brief is explicitly to reach people by their
employment circumstance, which is the exact thing Meta's personal-attributes policy exists
to prevent inferring. The resolution throughout is the same one jaredrhod's copywriting
playbook already teaches for a different reason (naming the elephant in the room builds
trust): describe the market in general terms, never the viewer's status in the second
person, and let the targeting mechanics (LinkedIn's real profile facets, Meta's behavioural
retargeting) do the audience-selection work that the copy is not allowed to do.
