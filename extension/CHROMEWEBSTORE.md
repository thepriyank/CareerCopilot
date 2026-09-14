# Chrome Web Store Listing — JobMagnate — Assisted Apply

> Last Updated: 2026-09-14

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
Questions or issues? [support email/URL — fill in before submitting]

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

**Privacy Policy URL** [REQUIRED] — ⬜ not yet live

Full policy text drafted below — needs a real hosted URL before submission (a `/privacy` page on jobmagnate.com is the natural home; not built yet, offered as a next step). The Chrome Web Store auto-rejects a dead or placeholder link, so don't submit until this resolves to a real page.

```
Privacy Policy for JobMagnate — Assisted Apply

Last updated: 2026-09-14

WHAT DATA WE COLLECT
Your name, email, phone, location, and social/portfolio links, as already saved in your JobMagnate account — used to fill job application forms you choose to fill. The web address of the page you're on and the target form's field structure (field names, types, and labels — never what you've typed into them), used to identify the job and map the form correctly.

HOW DATA IS STORED
A connection token is stored locally in your browser (chrome.storage.local) and is never synced to Google's servers. Your profile data itself lives in your JobMagnate account, not in the extension.

HOW DATA IS USED
Solely to fill a job application form you explicitly ask the extension to fill, and to identify which job it belongs to. The extension never submits a form on your behalf — you always review and click submit yourself.

THIRD-PARTY SERVICES
When the extension encounters a form structure it hasn't seen before, JobMagnate's backend sends that form's field structure (never your personal data or anything you've typed) to a large-language-model provider to determine how to map it. This mapping is cached and reused for every user who encounters that same form afterward — most forms need this only once, ever.

DATA SHARING
We do not sell your data. Aside from the field-structure mapping described above, your data is not shared with third parties.

DATA RETENTION AND DELETION
You can disconnect the extension at any time from its popup, or revoke its access from JobMagnate Settings → Extensions — this immediately invalidates its connection token. Deleting your JobMagnate account deletes the data described above along with everything else in your account.

CHANGES TO THIS POLICY
We'll update this policy if what we collect or how we use it changes, and update the "Last updated" date above.

CONTACT
[support email — fill in before publishing]
```

## Distribution

**Visibility**: [decide: Public / Unlisted first for a soft launch / Private]
**Regions**: All regions

## Developer Info

**Publisher Name** [REQUIRED] — [fill in — e.g. "NowMagnate Innovations", per the web app's footer attribution]
**Contact Email** [REQUIRED] — [fill in — a monitored address; Google sends policy/takedown notices here, and it's shown publicly on the listing]
**Support URL / Email** [RECOMMENDED] — [fill in]
**Homepage URL** [RECOMMENDED] — https://jobmagnate.com

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 0.1.0 | 2026-09-14 | First release candidate. Generic (Tier-2/LLM) form-field mapping for any employer-hosted form; text fields only, résumé/cover-letter attachment not yet wired (see Known Issues). Real app-icon set. | Draft |

## Review Notes

### Known Issues / Limitations
- **Résumé/cover-letter attachment isn't live yet.** The mapping vocabulary and backend artifact resolution exist, but the content script currently skips filling `resume`/`coverLetter` fields, and the download routes are session-JWT-only (not yet extension-token-authed). Don't claim this in store copy until it ships.
- **No auto-detect.** Filling only happens on an explicit popup click, never automatically on page load — by design for now, but worth knowing if a reviewer asks "does this run automatically."
- **`activeTab` + popup-button interaction**: `activeTab`'s temporary grant is triggered by the toolbar-icon click that opens the popup; clicking "Fill this form" *inside* that already-open popup relies on that same grant still being valid, since nothing has navigated the tab away in between. This is a standard, widely-shipped pattern (this is how most icon+popup extensions that act on the current page work) but hasn't been confirmed against a real Chrome install for this specific extension — do that once before submitting, per the skill's "test early" guidance in a real browser, not just via the fixture-based unit tests this repo has.
- No screenshots yet — needs a real Chrome install against a live job form (see extension/README.md's local-dev instructions).
- Publisher name, contact email, and the privacy policy's hosted URL are placeholders — must be filled in with real values before submission.

### Rejection History
None yet — first submission not made.
