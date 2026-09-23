import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — JobMagnate',
  description: 'How JobMagnate collects, uses, and protects your data, including the Assisted Apply browser extension.',
}

const LAST_UPDATED = '2026-09-17'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 className="serif" style={{ fontSize: 20, marginBottom: 10 }}>{title}</h2>
      <div style={{ fontSize: 14, color: 'var(--text-soft)', lineHeight: 1.7 }}>{children}</div>
    </section>
  )
}

// Standalone doc page (no shared marketing chrome — see extension/connect's
// pattern), not gated behind auth: Chrome Web Store review, and anyone
// evaluating the product before signing up, both need to reach this without
// an account. Content is a straight description of what this codebase
// actually does (see ARCHITECTURE.md's "Job source policy", the
// docs/monetization_plan.md pass, and extension/CHROMEWEBSTORE.md's data-use
// table) — not aspirational language, so keep this in sync with the code
// rather than the other way around.
export default function PrivacyPolicyPage() {
  return (
    <div className="app-root" style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '56px 24px 96px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 18, textDecoration: 'none', color: 'var(--text)', marginBottom: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a small static brand asset, not worth next/image's overhead here */}
          <img src="/icons/logo-mark.png" alt="" width={64} height={19} />
          <span className="wordmark">JobMagnate</span>
        </Link>

        <div className="eyebrow" style={{ marginTop: 24, marginBottom: 8 }}>Legal</div>
        <h1 className="display" style={{ fontSize: 36, marginBottom: 8 }}>Privacy Policy</h1>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 40 }}>Last updated: {LAST_UPDATED}</div>

        <Section title="Overview">
          This policy covers JobMagnate&rsquo;s web app and its Assisted Apply browser extension, both
          published by NowMagnate Innovations. It&rsquo;s written to describe what we actually do, not
          what a generic template says — if you find a mismatch between this page and the product&rsquo;s
          real behavior, tell us at the address below and we&rsquo;ll fix whichever one is wrong.
        </Section>

        <Section title="What we collect">
          <p style={{ marginBottom: 14 }}><strong>Account information.</strong> Your email address, and either a
          password (stored as a bcrypt hash, never in plain text) or, if you sign in with Google, an
          identity confirmed by Firebase Authentication — we never see or store your Google password.</p>
          <p style={{ marginBottom: 14 }}><strong>Résumé and profile data.</strong> The résumé file you upload
          (PDF or DOCX), the structured profile we parse from it, and anything you tell us during
          onboarding — career goals, skills, preferences like remote/hybrid/onsite or technologies you
          want to avoid.</p>
          <p style={{ marginBottom: 14 }}><strong>Generated content.</strong> Job-specific resume versions and
          cover letters JobMagnate drafts for you, and your approval decisions on them — nothing is
          submitted anywhere on your behalf without your review.</p>
          <p style={{ marginBottom: 14 }}><strong>Job activity.</strong> Which jobs you&rsquo;ve saved, applied to,
          or been matched against, and your match scores. Job postings themselves come from public job
          boards and employer career sites, not from you.</p>
          <p><strong>Extension usage (if connected).</strong> A connection token scoped to your account, the
          web address of the page you click &ldquo;Fill&rdquo; on, and that page&rsquo;s form field structure
          (field names/types/labels) — never what you&rsquo;ve typed into the form, and never your password.
          See &ldquo;The browser extension&rdquo; below for detail.</p>
        </Section>

        <Section title="How we use it">
          <p style={{ marginBottom: 14 }}>To parse your résumé into a structured profile, match you against job
          postings and explain why, draft tailored resumes and cover letters for jobs you choose, identify
          skill gaps and suggest courses, and give feedback on a LinkedIn profile you paste in.</p>
          <p>Job discovery is system-wide, not per-candidate: the background job that searches public job
          boards and aggregators runs against a shared list of role titles, not your individual profile —
          your résumé and profile data are never sent to a job board or aggregator to search on your
          behalf. Matching against your profile happens afterward, entirely on our side.</p>
        </Section>

        <Section title="AI processing">
          <p style={{ marginBottom: 14 }}>Parsing, matching, tailoring, and skill-gap analysis are done by
          large-language-model providers (Google Gemini, Groq, Ollama Cloud, OpenRouter, and,
          only if we&rsquo;ve explicitly enabled paid providers, DeepSeek, Anthropic, or OpenAI) — we send the
          relevant résumé, profile, or job-description text to whichever provider is active for that
          request.</p>
          <p>We use these providers under API terms that exclude submitted data from being used to train
          their models — your résumé and profile data are never used to train an AI model, ours or
          theirs.</p>
        </Section>

        <Section title="The browser extension">
          <p style={{ marginBottom: 14 }}>The Assisted Apply extension fills job application forms on
          employer career sites using the profile you already built in JobMagnate. It only activates on
          the specific tab you click &ldquo;Fill this form&rdquo; on — it has no standing access to any other tab
          or site, and it never runs automatically.</p>
          <p style={{ marginBottom: 14 }}>When you click Fill, the extension sends the page&rsquo;s web address
          and the target form&rsquo;s field structure (never what you&rsquo;ve typed into it) to JobMagnate&rsquo;s
          backend, so it can identify the job and figure out which fields mean what. An unfamiliar form&rsquo;s
          field structure may be sent to an LLM provider (see &ldquo;AI processing&rdquo; above) to determine the
          mapping; that mapping is cached and reused for every user who meets the same form afterward, so
          most forms only need this once, ever.</p>
          <p>The extension never sees your password, and it never submits a form for you — you always
          review every field and click submit yourself. Its connection token is stored locally in your
          browser (<code className="mono">chrome.storage.local</code>), never synced to Google&rsquo;s servers.
          You can disconnect it anytime from its popup or from Settings → Extensions.</p>
        </Section>

        <Section title="Where data is stored">
          Résumé files are stored in Google Cloud Storage. Account, profile, job, and generated-content
          data live in a Postgres database (hosted by Neon). The application itself runs on Google Cloud
          Run. We don&rsquo;t operate our own data centers — all of this is standard managed cloud
          infrastructure, and none of these providers are given access beyond what&rsquo;s needed to host and
          run the service.
        </Section>

        <Section title="What we don't do">
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            <li style={{ marginBottom: 6 }}>We don&rsquo;t sell your data, to anyone, ever.</li>
            <li style={{ marginBottom: 6 }}>We don&rsquo;t use your data for advertising or for any purpose unrelated to the features described above.</li>
            <li style={{ marginBottom: 6 }}>We don&rsquo;t submit a job application, message an employer, or take any other irreversible action on your behalf without your explicit review and approval.</li>
            <li style={{ marginBottom: 6 }}>We don&rsquo;t store your third-party credentials (LinkedIn, Naukri, Indeed, or any other site) to scrape or auto-apply for you — this is a hard rule for this product, not a launch-stage limitation.</li>
            <li>We currently don&rsquo;t process payments or collect financial information — JobMagnate is free during this stage of the product.</li>
          </ul>
        </Section>

        <Section title="Your controls">
          <p style={{ marginBottom: 14 }}>You can review and edit your profile at any time from your
          dashboard, approve or reject any AI-generated resume or cover letter before it&rsquo;s considered
          final, and disconnect the browser extension from Settings → Extensions or its own popup.</p>
          <p>You can permanently delete your account from Settings — this removes your account, résumé
          files, profile, job history, and generated content. It cannot be undone.</p>
        </Section>

        <Section title="Changes to this policy">
          If what we collect or how we use it changes, we&rsquo;ll update this page and the &ldquo;Last updated&rdquo;
          date above.
        </Section>

        <Section title="Contact">
          Questions about this policy or your data: <a href="mailto:support@jobmagnate.com" style={{ color: 'var(--text-soft)', textDecoration: 'underline' }}>support@jobmagnate.com</a>.
        </Section>
      </div>
    </div>
  )
}
