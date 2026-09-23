# Chrome Web Store Listing — JobMagnate — Assisted Apply

> Last Updated: 2026-09-23

**Status: LIVE** on the Chrome Web Store (2026-09-23).
- Listing: https://chromewebstore.google.com/detail/jobmagnate-%E2%80%94-assisted-app/gkfhjcfjdpaipbmhjgcjdpldeojimdfi
- Extension ID: `gkfhjcfjdpaipbmhjgcjdpldeojimdfi`
- Both are baked into the web app as defaults in `frontend/src/lib/extension.ts` (overridable via `NEXT_PUBLIC_CHROME_WEBSTORE_URL` / `NEXT_PUBLIC_EXTENSION_ID`) and linked from Settings → Extensions, `/extension/connect`, and the landing-page footer.

Generated per the `modern-web-guidance:chrome-extensions` skill's
convention — the single place to copy-paste from when filling out the
Developer Dashboard. Update this file whenever `manifest.json`,
permissions, or user-facing behavior changes; see the "When to update"
rule in the skill.

## Store Listing

**Extension Name** [REQUIRED]
JobMagnate — Assisted Apply
<!-- Matches manifest.json "name" exactly. -->

**Short Description** [REQUIRED] (104/132 chars)
Fills job application forms with your JobMagnate profile. You review and click submit — it never does.

**Detailed Description** [REQUIRED]
```
Fills job application forms on company career sites using the profile you already built in JobMagnate — you review every field and click submit yourself.

FEATURES
• Automatically maps almost any employer's application form — not a fixed list of sites — and fills what it recognizes: name, email, phone, location, LinkedIn, and more.
• Deliberately leaves screening questions, EEO fields, and "why do you want to work here?" prompts blank rather than guessing — those still need your own words.
• Shows exactly which fields it filled so you can review before submitting.
• Works with the résumé and cover letter you've already approved for a specific job in JobMagnate, once that piece is fully wired up (see below).

HOW TO USE
1. Open a job application on an employer's own career site.
2. Click the JobMagnate icon in your toolbar.
3. Click "Fill this form."
4. Review every field, then click Submit on the site itself — the extension never does this for you.

PRIVACY
This extension never sees your password. It reads your profile from your own JobMagnate account and fills it into the form you're looking at. When you click Fill, it also sends the page's web address and the form's field labels (never what you've typed into them) to JobMagnate, so it can figure out which fields mean what. See our full privacy policy for details.

PERMISSIONS
• "Read and change data on the site you're on" — only activates on the specific page you click Fill on, and only to read the form's structure and fill in matched fields.
• Storage — remembers your connection to JobMagnate on this device.

Currently excluded: LinkedIn, Naukri, Indeed, Glassdoor, and Wellfound. Applications on those platforms are not supported by this extension.

SUPPORT
Questions or issues? support@jobmagnate.com

Version 0.1.0 — first release.
```

**Category** [REQUIRED]
Productivity

**Single Purpose** [REQUIRED]
Fills job application forms on company career sites using the candidate's saved JobMagnate profile.

**Primary Language** [REQUIRED]
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `icons/icon-128.png` (same mark as the JobMagnate web app's favicon/PWA icon — `npm run icons` regenerates from `frontend/public/icons/icon-512.png` if the brand mark ever changes) |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Not created | needs a real Chrome install against a live form — see Review Notes |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | |

### Screenshot Notes
Good candidates once captured: (1) the popup showing "Connected" + remaining-fill count, (2) a real job application form mid-fill with green highlights visible on the filled fields, (3) the result message ("Filled X of Y matched fields").

## Permissions Justification

| Permission | Type | Justification |
|------------|------|----------------|
| `activeTab` | permissions | Grants temporary access to only the specific tab the user is on when they click Fill in the popup — lets the extension read that one page's form and fill it, with no standing access to any other tab or site. |
| `scripting` | permissions | Injects the form-filling script into the current tab only when the user clicks Fill — never runs automatically or on page load. |
| `storage` | permissions | Stores the extension's own connection token locally (`chrome.storage.local`) so the user stays connected to their JobMagnate account between sessions. Nothing is synced to Google's servers — local storage only, not `chrome.storage.sync`. |
| `tabs` | permissions | Reads the current tab's URL when the user clicks Fill, to identify which employer's form it is and to tell JobMagnate's backend which site to map (and to check the small list of excluded platforms — LinkedIn, Naukri, Indeed, Glassdoor, Wellfound — before doing anything). No `host_permissions` are requested; this is metadata (the URL string) only, not page content access. |

No `host_permissions` are declared — content-script injection relies on `activeTab`, scoped per-click, not blanket access to any domain. This is deliberate (see `docs/assisted_apply_extension_plan.md`'s "no `<all_urls>`" guardrail) and should read as a strong point in review, not something to loosen.

`externally_connectable` (not a CWS-reviewed permission, but worth noting): scopes which web origins may hand the extension a connection token (`jobmagnate.com` and `localhost:3000` for local dev). No other site can message this extension.

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** Yes

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|--------------------------|---------|------------------------------|
| Personally identifiable info (name, email, phone, location, social links) | Yes — read from the user's own JobMagnate account, not scraped from pages | Yes, to JobMagnate's own backend (api.jobmagnate.com) | Filling application-form fields the user asks to fill | No — except the LLM provider used to map an unfamiliar form's field *structure* (see Website content row; no PII is sent to it) |
| Authentication info | Yes — a JobMagnate-issued connection token, not a password | Yes, sent as a bearer token to JobMagnate's backend on every request | Authenticating the extension's API calls as the connected user | No |
| Website content | Yes — the current tab's URL, and the target form's field *structure* (name/id/type/label/placeholder — never the values typed into them) | Yes, to JobMagnate's backend, which forwards the field structure (not the URL) to an LLM provider to determine field mapping | Identifying which job/employer the form belongs to, and mapping unfamiliar form fields to the right profile data | Yes — the form's field *structure* only (no PII, no field values) is sent to JobMagnate's LLM provider for mapping unrecognized forms |
| Health info | No | — | — | — |
| Financial info | No | — | — | — |
| Personal communications | No | — | — | — |
| Location (geolocation) | No — "location" here means the profile's saved city/region text field, not device geolocation | — | — | — |
| Web history | No — only the single current tab's URL at the moment of an explicit click, never passive browsing history | — | — | — |
| User activity | No | — | — | — |

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL** [REQUIRED] — ✅ live at `/privacy` (2026-09-17)

Built as a real Next.js page (`frontend/src/app/privacy/page.tsx`), not the standalone draft text that used to live in this doc — that way it's one page covering both the web app and the extension, and it can't drift out of sync with two separate copies. Linked from the landing page footer and from the "Get the extension" card in Settings.

- Staging: `https://jobmagnate-frontend-staging-w4642vyi6a-as.a.run.app/privacy`
- Production: `https://jobmagnate.com/privacy` — **verified live (HTTP 200) on 2026-09-21.** Use this one for the actual Chrome Web Store submission.

**Terms of Service / Refund Policy**: `/terms` and `/refund-policy` — live on production (verified HTTP 200, 2026-09-21), alongside the full Razorpay billing rollout (see Version History).

## Distribution

**Visibility**: [decide: Public / Unlisted first for a soft launch / Private]
**Regions**: All regions

## Developer Info

**Publisher Name** [REQUIRED] — NowMagnate Innovations (per the web app's footer attribution)
**Contact Email** [REQUIRED] — support@jobmagnate.com — confirm this inbox is actually monitored (or forwards somewhere that is) before submitting; Google sends policy/takedown notices here, and it's shown publicly on the listing.
**Support URL / Email** [RECOMMENDED] — support@jobmagnate.com
**Homepage URL** [RECOMMENDED] — https://jobmagnate.com

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 0.1.0 | 2026-09-14 | First release candidate. Generic (Tier-2/LLM) form-field mapping for any employer-hosted form; text fields only, résumé/cover-letter attachment not yet wired (see Known Issues). Real app-icon set. | Draft |
| 0.1.0 | 2026-09-21 | **Fixed a production-breaking bug found during this readiness audit**: the default build (`npm run build`, no flags — i.e. exactly what a real submission build uses) pointed `API_BASE_URL` at `https://api.jobmagnate.com`, which had no DNS record at all at the time (confirmed by direct lookup — `Could not resolve host`). No Cloud Run domain mapping for that subdomain existed yet; only the apex `jobmagnate.com` was mapped, to the frontend. Every API call from a real install would have failed outright. Repointed the default (`src/background/api.ts` + `scripts/build.mjs`) to the backend's actual live Cloud Run URL as an immediate fix. Submitted for Chrome Web Store review in this state. | Approved — live 2026-09-23 |
| 0.1.1 | 2026-09-21 | **Follow-up, not urgent** — 0.1.0 already worked correctly against the Cloud Run URL. A proper `api.jobmagnate.com` Cloud Run domain mapping was added (Terraform, `google_cloud_run_domain_mapping.backend`), DNS (CNAME → `ghs.googlehosted.com`) configured at the registrar, and Google's managed cert finished provisioning (`Ready`/`CertificateProvisioned` both `True`, verified 2026-09-21). Repointed `API_BASE_URL` back to the branded `https://api.jobmagnate.com`. Also bumped `manifest.json`/`package.json` to 0.1.1. Verified: built bundle only embeds `api.jobmagnate.com` (grepped), `npm test` (38/38) and `tsc --noEmit` pass, `curl https://api.jobmagnate.com/api/payments/plans` returns the expected `401 UNAUTHORIZED` (route exists, auth required) rather than a connection/DNS error. Same-day as this fix, production also got its full Razorpay billing rollout (live keys, webhook, 3-tier pricing, Terms/Refund pages) — unrelated to the extension itself, but why `/terms` and `/refund-policy` now correctly return 200 on production. Packaged `jobmagnate-assisted-apply-0.1.1.zip`. | Ready to upload as a Package-tab update once 0.1.0 clears review |

## Review Notes

### Known Issues / Limitations
- **Résumé/cover-letter attachment isn't live yet.** The mapping vocabulary and backend artifact resolution exist, but the content script currently skips filling `resume`/`coverLetter` fields, and the download routes are session-JWT-only (not yet extension-token-authed). Don't claim this in store copy until it ships.
- **No auto-detect.** Filling only happens on an explicit popup click, never automatically on page load — by design for now, but worth knowing if a reviewer asks "does this run automatically."
- **`activeTab` + popup-button interaction**: `activeTab`'s temporary grant is triggered by the toolbar-icon click that opens the popup; clicking "Fill this form" *inside* that already-open popup relies on that same grant still being valid, since nothing has navigated the tab away in between. This is a standard, widely-shipped pattern (this is how most icon+popup extensions that act on the current page work) but hasn't been confirmed against a real Chrome install for this specific extension — do that once before submitting, per the skill's "test early" guidance in a real browser, not just via the fixture-based unit tests this repo has.

### Still needed before submitting — none of this can be done from the codebase, all manual/Developer Dashboard steps
- **Load `extension/dist/` unpacked in a real Chrome and smoke-test it against a live job form first**, before anything else below. `chrome://extensions` → Developer mode → "Load unpacked" → select `extension/dist/`. This is also the moment to confirm the `activeTab` + popup-click pattern actually works end to end (see Known Issues) — it's never been run in a real Chrome, only against the fixture-based unit tests. `jobmagnate-assisted-apply-0.1.0.zip` (repo root of `extension/`) is the same build, already zipped, ready to upload once this checks out.
- **Screenshots (1 required, 1 recommended) + small promo tile (recommended).** Capture these during that same real-Chrome session: (1) the popup showing "Connected" + remaining-fill count, (2) a real job application form mid-fill with green highlights visible, (3) the result message. An automated browser tool can't load an unpacked extension or drive Chrome's own extension UI, so this has to be by hand.
- **A one-time $5 Chrome Web Store developer registration fee**, if this Google account hasn't registered as a CWS developer before — a real payment on a real Google account, so this is on you to do directly in the Developer Dashboard, not something to hand off.
- **Visibility decision** (Public vs. Unlisted for a soft launch first) — a launch-strategy call, not a technical one. Unlisted first is a reasonable default if you want to test the real install flow with a small group before it's publicly searchable.
- **Confirm support@jobmagnate.com is actually a monitored inbox** (or set up a forward) before it goes out on a public listing and this privacy policy.
- Once all of the above is done: submit for review using the production privacy policy URL (`https://jobmagnate.com/privacy`, not staging's), uploading `jobmagnate-assisted-apply-0.1.0.zip`.
- ~~**After the listing goes live**: set `NEXT_PUBLIC_CHROME_WEBSTORE_URL` and `NEXT_PUBLIC_EXTENSION_ID`.~~ Done 2026-09-23 — rather than per-environment env vars, the public listing URL and extension id are now code defaults in `frontend/src/lib/extension.ts`, so Settings shows a real "Add to Chrome" link and `/extension/connect` hands the token off automatically on every environment.

### Separate, non-blocking finding from this audit: production is well behind `main`
Not a Chrome Web Store requirement, but worth flagging since it affects what a real user reaches right after installing the extension: the `production` branch hasn't been merged since the privacy-policy merge and job-cleanup work (`72af4e5`, `8b455ad`). Everything since — the full Razorpay integration + webhook, the 3-tier pricing page, Terms of Service, Refund Policy, and the mobile-layout fix for the Plan tab — exists only on `main` (staging). Production's Secret Manager also has no Razorpay secrets provisioned at all (`infra/terraform/environments/production/` has zero references to Razorpay), so merging `main` → `production` as-is would break the production backend on deploy (missing secrets) — that merge needs its own terraform work (mirroring `5fa4735`'s staging provisioning) and a decision on live vs. test Razorpay keys first. Flagging this separately rather than bundling it into the extension launch; happy to take it on next if wanted.

### Rejection History
None — 0.1.0 approved on first submission (live 2026-09-23).
