'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Topbar } from '@/components/layout/Topbar'
import { Icon } from '@/components/ui/Icon'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { settings as settingsApi, profile as profileApi, account as accountApi, auth as authApi, extension as extensionApi, payments as paymentsApi, ApiError, PassType, PassPlan } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import { loadRazorpayCheckout } from '@/lib/razorpay'
import { CHROME_WEBSTORE_URL } from '@/lib/extension'
import type { ModelConnectionStatus, CandidateProfile, RemotePreference, SearchUrgency, User, ExtensionTokenSummary } from '@/types'

function ModelConnectionCard() {
  const [status, setStatus] = useState<ModelConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')

  useEffect(() => {
    settingsApi
      .getModelConnection()
      .then(setStatus)
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  const trimmed = value.trim()
  const detected = /^https?:\/\//i.test(trimmed) ? 'local' : trimmed ? 'cloud' : null

  async function handleSave() {
    setSaving(true)
    setError('')
    setWarning('')
    try {
      const res = await settingsApi.setModelConnection(trimmed)
      setStatus(res)
      setValue('')
      if (res.warning) setWarning(res.warning)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this connection')
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    setSaving(true)
    setError('')
    try {
      const res = await settingsApi.clearModelConnection()
      setStatus(res)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove this connection')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card" style={{ padding: 22, maxWidth: 980, marginBottom: 22 }}>
      <div className="eyebrow" style={{ marginBottom: 4 }}>Model connection</div>
      <div className="serif" style={{ fontSize: 20, marginBottom: 10 }}>One field, any provider</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.55, maxWidth: 640 }}>
        Paste a cloud API key (Anthropic), or a local/self-hosted OpenAI-compatible endpoint with the model
        in a <code>#model=</code> fragment — e.g. <span className="mono" style={{ fontSize: 12 }}>http://localhost:11434/v1#model=gemma4:e4b</span> for
        Ollama. Works the same way against LM Studio, vLLM, or any other OpenAI-compatible server — just the
        host changes. Leave it empty to use the platform default.
      </div>

      {loading ? (
        <div className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</div>
      ) : (
        <>
          {status?.configured && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--sage-100)', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
              <Icon.CheckCircle size={14} color="var(--sage-900)" />
              <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-mono)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {status.kind === 'local' ? 'Local' : 'Cloud'} · {status.preview}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={handleClear} disabled={saving}>Remove</button>
            </div>
          )}

          {error && <div style={{ fontSize: 12, color: 'var(--error)', marginBottom: 8 }}>{error}</div>}
          {warning && <div style={{ fontSize: 12, color: 'var(--error)', marginBottom: 8 }}>{warning}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="sk-ant-... or http://localhost:11434/v1#model=gemma4:e4b"
              style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--line)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}
            />
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !trimmed}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
          {detected && (
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
              Detected: {detected === 'local' ? 'local/self-hosted endpoint' : 'cloud API key'}
              {detected === 'local' && !/#model=/.test(value) && ' — remember the #model= fragment'}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ProfileTab() {
  const [profile, setProfile] = useState<CandidateProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [error, setError] = useState('')

  const [targetRoles, setTargetRoles] = useState('')
  const [yearsOfExperience, setYearsOfExperience] = useState('')
  const [industries, setIndustries] = useState('')
  const [locations, setLocations] = useState('')
  const [remotePreference, setRemotePreference] = useState<RemotePreference>('OPEN')
  const [salaryMin, setSalaryMin] = useState('')
  const [salaryMax, setSalaryMax] = useState('')
  const [urgency, setUrgency] = useState<SearchUrgency>('ACTIVELY_LOOKING')
  const [noticePeriod, setNoticePeriod] = useState('')
  const [visaStatus, setVisaStatus] = useState('')
  const [avoidTechnologies, setAvoidTechnologies] = useState('')

  useEffect(() => {
    profileApi
      .get()
      .then((res) => {
        setProfile(res.profile)
        if (res.profile) {
          setTargetRoles(res.profile.targetRoles.join(', '))
          setYearsOfExperience(res.profile.yearsOfExperience != null ? String(res.profile.yearsOfExperience) : '')
          setIndustries(res.profile.industries.join(', '))
          setLocations(res.profile.locations.join(', '))
          setRemotePreference(res.profile.remotePreference)
          setSalaryMin(res.profile.salaryMin != null ? String(res.profile.salaryMin) : '')
          setSalaryMax(res.profile.salaryMax != null ? String(res.profile.salaryMax) : '')
          setUrgency(res.profile.urgency)
          setNoticePeriod(res.profile.noticePeriod ?? '')
          setVisaStatus(res.profile.visaStatus ?? '')
          setAvoidTechnologies((res.profile.avoidTechnologies ?? []).join(', '))
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load your profile'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setError('')
    setSaveMsg('')
    try {
      const res = await profileApi.upsert({
        targetRoles: targetRoles.split(',').map((s) => s.trim()).filter(Boolean),
        yearsOfExperience: yearsOfExperience ? Number(yearsOfExperience) : null,
        industries: industries.split(',').map((s) => s.trim()).filter(Boolean),
        locations: locations.split(',').map((s) => s.trim()).filter(Boolean),
        remotePreference,
        salaryMin: salaryMin ? Number(salaryMin) : undefined,
        salaryMax: salaryMax ? Number(salaryMax) : undefined,
        urgency,
        noticePeriod: noticePeriod || undefined,
        visaStatus: visaStatus || undefined,
        avoidTechnologies: avoidTechnologies.split(',').map((s) => s.trim()).filter(Boolean),
      })
      setProfile(res.profile)
      setSaveMsg('Saved!')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your profile')
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(''), 3000)
    }
  }

  if (loading) return <div className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</div>

  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13 }
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, marginBottom: 6, display: 'block' }

  return (
    <div className="card" style={{ padding: 22, maxWidth: 640 }}>
      <div className="eyebrow" style={{ marginBottom: 4 }}>Profile</div>
      <div className="serif" style={{ fontSize: 20, marginBottom: 16 }}>What you&rsquo;re looking for</div>

      {error && <div style={{ fontSize: 12, color: 'var(--error)', marginBottom: 12 }}>{error}</div>}
      {!profile && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>No profile yet — filling this in creates one, same as onboarding does.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>Target roles (comma separated)</label>
          <input style={inputStyle} value={targetRoles} onChange={(e) => setTargetRoles(e.target.value)} placeholder="Senior Backend Engineer, Staff Engineer" />
        </div>
        <div>
          <label style={labelStyle}>Years of experience</label>
          <input style={inputStyle} type="number" min={0} max={60} value={yearsOfExperience} onChange={(e) => setYearsOfExperience(e.target.value)} placeholder="10" />
        </div>
        <div>
          <label style={labelStyle}>Industries</label>
          <input style={inputStyle} value={industries} onChange={(e) => setIndustries(e.target.value)} placeholder="Fintech, SaaS" />
        </div>
        <div>
          <label style={labelStyle}>Locations</label>
          <input style={inputStyle} value={locations} onChange={(e) => setLocations(e.target.value)} placeholder="Bengaluru, Remote" />
        </div>
        <div className="grid-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={labelStyle}>Remote preference</label>
            <select style={inputStyle} value={remotePreference} onChange={(e) => setRemotePreference(e.target.value as RemotePreference)}>
              <option value="OPEN">Open to all</option>
              <option value="REMOTE">Remote only</option>
              <option value="HYBRID">Hybrid</option>
              <option value="ONSITE">On-site</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Urgency</label>
            <select style={inputStyle} value={urgency} onChange={(e) => setUrgency(e.target.value as SearchUrgency)}>
              <option value="ACTIVELY_LOOKING">Actively looking</option>
              <option value="OPEN_TO_OPPORTUNITIES">Open to opportunities</option>
              <option value="NOT_LOOKING">Not looking</option>
            </select>
          </div>
        </div>
        <div className="grid-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={labelStyle}>Salary min</label>
            <input style={inputStyle} type="number" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Salary max</label>
            <input style={inputStyle} type="number" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Notice period</label>
          <input style={inputStyle} value={noticePeriod} onChange={(e) => setNoticePeriod(e.target.value)} placeholder="2 weeks" />
        </div>
        <div>
          <label style={labelStyle}>Visa / work authorization</label>
          <input style={inputStyle} value={visaStatus} onChange={(e) => setVisaStatus(e.target.value)} placeholder="No constraints" />
        </div>
        <div>
          <label style={labelStyle}>Technologies to avoid</label>
          <input style={inputStyle} value={avoidTechnologies} onChange={(e) => setAvoidTechnologies(e.target.value)} placeholder="e.g. PHP, jQuery — from older experience you'd rather not repeat" />
          <p style={{ marginTop: 6, fontSize: 11.5, color: 'var(--text-muted)' }}>
            Jobs that require any of these as a must-have skill are filtered out of your board entirely.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18 }}>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
        {saveMsg && <span style={{ fontSize: 12, color: 'var(--success)' }}>{saveMsg}</span>}
      </div>
    </div>
  )
}

function PrivacyTab() {
  const router = useRouter()
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setDeleting(true)
    setError('')
    try {
      await accountApi.deleteAccount()
      clearToken()
      router.push('/login')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete your account')
      setDeleting(false)
    }
  }

  return (
    <div className="card" style={{ padding: 22, maxWidth: 640, borderColor: 'var(--error)' }}>
      <div className="eyebrow" style={{ color: 'var(--error)', marginBottom: 4 }}>Danger zone</div>
      <div className="serif" style={{ fontSize: 20, marginBottom: 10 }}>Delete your account</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 16 }}>
        This permanently deletes your account and everything tied to it — resumes, parsed data, jobs, matches,
        generated versions, and approval history. This cannot be undone.
      </div>
      {error && <div style={{ fontSize: 12, color: 'var(--error)', marginBottom: 12 }}>{error}</div>}
      <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 6, display: 'block' }}>Type DELETE to confirm</label>
      <input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        style={{ width: '100%', maxWidth: 240, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13, marginBottom: 14 }}
      />
      <div>
        <button
          className="btn btn-primary btn-sm"
          style={{ background: 'var(--error)', borderColor: 'var(--error)' }}
          disabled={confirmText !== 'DELETE' || deleting}
          onClick={handleDelete}
        >
          {deleting ? 'Deleting…' : 'Permanently delete my account'}
        </button>
      </div>
    </div>
  )
}

function ExportTab() {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  async function handleExport() {
    setDownloading(true)
    setError('')
    try {
      const data = await accountApi.exportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'career-copilot-export.json'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not export your data')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="card" style={{ padding: 22, maxWidth: 640 }}>
      <div className="eyebrow" style={{ marginBottom: 4 }}>Export</div>
      <div className="serif" style={{ fontSize: 20, marginBottom: 10 }}>Download your data</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 16 }}>
        A JSON file with your profile, resumes (metadata, not file bytes), jobs, matches, generated resumes and
        cover letters, and approval history.
      </div>
      {error && <div style={{ fontSize: 12, color: 'var(--error)', marginBottom: 12 }}>{error}</div>}
      <button className="btn btn-primary btn-sm" onClick={handleExport} disabled={downloading}>
        {downloading ? 'Preparing…' : 'Download my data'}
      </button>
    </div>
  )
}

function daysLeft(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

// Must match backend/src/services/plan/freeTierQuota.ts and
// backend/src/services/extension/quota.ts exactly — display-only copies,
// not read from an API (these three numbers change rarely enough that a
// dedicated endpoint isn't worth it, unlike pricing — see GET /api/payments/plans).
const FREE_MONTHLY_TAILOR_LIMIT = 3
const FREE_MONTHLY_COVER_LETTER_LIMIT = 3
const FREE_MONTHLY_AUTOFILL_LIMIT = 5

// Always free, for every user regardless of plan — see docs/monetization_plan.md's
// tiering table's "Free permanently" row.
const ALWAYS_FREE_FEATURES = [
  'Unlimited job discovery & matching',
  'Unlimited match-score explanations',
  'Unlimited skill-gap analysis & course recommendations',
  'Unlimited LinkedIn review',
  'Unlimited application tracking',
  'Master résumé PDF download',
]

// What a paid pass (or the trial) additionally unlocks — same set for all
// three tiers, only the duration differs. See services/plan/freeTierQuota.ts
// and services/extension/quota.ts for the FREE-tier numbers these remove.
const PAID_FEATURES = [
  'Unlimited tailored résumés',
  'Unlimited cover letters',
  'Unlimited Assisted Apply autofills',
  'Everything in Free, included',
]

function FeatureList({ items, tone }: { items: string[]; tone: 'muted' | 'default' }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {items.map((item) => (
        <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: tone === 'muted' ? 'var(--text-muted)' : 'var(--text-soft)', lineHeight: 1.5, marginBottom: 8 }}>
          <Icon.Check size={12} color="var(--accent)" style={{ marginTop: 2, flexShrink: 0 }} />
          {item}
        </li>
      ))}
    </ul>
  )
}

function PlanTab() {
  const [user, setUser] = useState<User | null>(null)
  const [plans, setPlans] = useState<PassPlan[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [activating, setActivating] = useState(false)
  const [activateError, setActivateError] = useState('')

  useEffect(() => {
    Promise.all([authApi.me(), paymentsApi.getPlans()])
      .then(([{ user }, { plans }]) => {
        setUser(user)
        setPlans(plans)
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Could not load your plan'))
      .finally(() => setLoading(false))
  }, [])

  async function handleActivate() {
    setActivating(true)
    setActivateError('')
    try {
      await accountApi.activatePass()
      // Reload rather than just updating local state — the sidebar reads
      // plan via its own independent auth.me() call, and this is the
      // simplest way to keep it in sync with no new shared user store.
      window.location.reload()
    } catch (err) {
      setActivateError(err instanceof ApiError ? err.message : 'Could not activate your trial')
      setActivating(false)
    }
  }

  if (loading) {
    return <div className="card" style={{ padding: 22, maxWidth: 640, fontSize: 13, color: 'var(--text-muted)' }}>Loading…</div>
  }
  if (!user) {
    return <div className="card" style={{ padding: 22, maxWidth: 640, fontSize: 13, color: 'var(--error)' }}>{loadError || 'Could not load your plan'}</div>
  }

  const isPremium = user.plan === 'PREMIUM'
  // The purchasable-plan grid's Buy button only makes sense for a plain FREE
  // user with no pending trial offer — someone pass-eligible sees the trial
  // offer above instead, and someone already PREMIUM sees the grid purely
  // for reference (their own tier called out, no CTA — see PlansGrid).
  const showBuyCta = !isPremium && !user.passEligible
  const currentTierPlan = isPremium && user.activePlanTier ? plans?.find((p) => p.passType === user.activePlanTier) : undefined

  return (
    <div style={{ maxWidth: 900 }}>
      <div className="card" style={{ padding: 22, marginBottom: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>Current Plan</div>
        {isPremium && user.planExpiresAt ? (
          <>
            <div className="serif" style={{ fontSize: 20, marginBottom: 10 }}>
              {user.activePlanTier === 'TRIAL' ? 'Free Trial' : currentTierPlan?.label ?? 'Full access'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 16 }}>
              {daysLeft(user.planExpiresAt)} {daysLeft(user.planExpiresAt) === 1 ? 'day' : 'days'} left —
              unlimited tailored résumés, cover letters, and Assisted Apply autofills while it&rsquo;s active.
            </div>
            <FeatureList items={ALWAYS_FREE_FEATURES.concat(PAID_FEATURES.slice(0, 3))} tone="default" />
          </>
        ) : user.passEligible ? (
          <>
            <div className="serif" style={{ fontSize: 20, marginBottom: 10 }}>Your free trial is ready</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 16 }}>
              Activate whenever you&rsquo;re ready to use it — 15 days of unlimited tailored résumés, cover letters, and
              Assisted Apply autofills, starting the day you accept.
            </div>
            {activateError && <div style={{ fontSize: 12, color: 'var(--error)', marginBottom: 12 }}>{activateError}</div>}
            <button className="btn btn-primary btn-sm" onClick={handleActivate} disabled={activating}>
              {activating ? 'Activating…' : 'Activate my free trial'}
            </button>
          </>
        ) : (
          <>
            <div className="serif" style={{ fontSize: 20, marginBottom: 10 }}>Free</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8 }}>Always free, unlimited</div>
            <FeatureList items={ALWAYS_FREE_FEATURES} tone="default" />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, margin: '16px 0 8px' }}>Also included, limited</div>
            <FeatureList
              items={[
                `${FREE_MONTHLY_TAILOR_LIMIT} tailored résumés / month`,
                `${FREE_MONTHLY_COVER_LETTER_LIMIT} cover letters / month`,
                `${FREE_MONTHLY_AUTOFILL_LIMIT} Assisted Apply autofills / month`,
              ]}
              tone="muted"
            />
          </>
        )}
      </div>

      {plans && (
        <div className="card" style={{ padding: 22 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>All plans</div>
          <PlansGrid plans={plans} currentTier={isPremium ? user.activePlanTier ?? null : null} showBuyCta={showBuyCta} />
        </div>
      )}
    </div>
  )
}

function formatRupees(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`
}

// Razorpay Standard Checkout — see docs/monetization_plan.md's "Phase B" and
// lib/razorpay.ts. Always rendered (for reference/comparison) once plans
// have loaded — `showBuyCta` is false for anyone already PREMIUM (trial or
// paid), so those users see the same three cards with no purchase button,
// per PlanTab's caller. A successful verify reloads the page, same as
// activatePass() above, so every plan-derived UI (this tab, the sidebar
// banner) picks up the new expiry from one shared source (GET /api/auth/me)
// rather than needing its own local state to stay in sync.
//
// Plans are fetched from GET /api/payments/plans rather than hardcoded here
// — backend/src/services/payments/passPricing.ts is the one place prices
// live, so this can never drift from what create-order actually charges.
// Rendered as a single, non-wrapping row (CSS grid, not flex-wrap) with the
// recommended tier visually larger — a horizontal scrollbar is the fallback
// on a narrow viewport rather than letting the row wrap to a second line.
function PlansGrid({ plans, currentTier, showBuyCta }: { plans: PassPlan[]; currentTier: User['activePlanTier'] | null; showBuyCta: boolean }) {
  const [payingFor, setPayingFor] = useState<PassType | null>(null)
  const [error, setError] = useState('')

  async function handleBuy(passType: PassType) {
    setPayingFor(passType)
    setError('')
    try {
      await loadRazorpayCheckout()
      const order = await paymentsApi.createOrder(passType)

      if (!window.Razorpay) throw new Error('Razorpay Checkout failed to load')
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'JobMagnate',
        description: order.label,
        handler: async (response) => {
          try {
            await paymentsApi.verify(response)
            window.location.reload()
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Payment succeeded but verification failed — contact support before retrying')
            setPayingFor(null)
          }
        },
        modal: {
          // The user closed the modal without paying — not an error, just
          // back to the buy buttons.
          ondismiss: () => setPayingFor(null),
        },
        theme: { color: '#0f172a' },
      })
      checkout.on('payment.failed', (response) => {
        setError(response.error?.description || 'Payment failed — you were not charged')
        setPayingFor(null)
      })
      checkout.open()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start checkout — try again')
      setPayingFor(null)
    }
  }

  return (
    <div>
      {error && <div style={{ fontSize: 12.5, color: 'var(--error)', marginBottom: 14 }}>{error}</div>}
      <div style={{ overflowX: 'auto', paddingTop: 14, paddingBottom: 4 }}>
        <div className="plans-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(220px, 1fr))', gap: 16, minWidth: 700, alignItems: 'stretch' }}>
          {plans.map((plan) => {
            const discountPct = Math.round((1 - plan.amount / plan.listPrice) * 100)
            const isCurrent = currentTier === plan.passType
            return (
              <div
                key={plan.passType}
                className={plan.recommended ? 'plan-card-recommended' : undefined}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  border: plan.recommended || isCurrent ? '2px solid var(--accent)' : '1px solid var(--line-2)',
                  borderRadius: 12,
                  padding: plan.recommended ? 26 : 18,
                  background: plan.recommended ? 'var(--accent-subtle)' : 'var(--paper)',
                  transform: plan.recommended ? 'scale(1.05)' : 'none',
                  zIndex: plan.recommended ? 1 : 0,
                }}
              >
                {(plan.recommended || isCurrent) && (
                  <div
                    style={{
                      position: 'absolute', top: -11, left: 18, background: 'var(--accent)', color: '#fff',
                      fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 999, letterSpacing: 0.3,
                    }}
                  >
                    {isCurrent ? 'YOUR PLAN' : 'RECOMMENDED'}
                  </div>
                )}
                <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 2 }}>{plan.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                  <span className="serif" style={{ fontSize: plan.recommended ? 28 : 24 }}>{formatRupees(plan.amount)}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'line-through' }}>{formatRupees(plan.listPrice)}</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 16 }}>{discountPct}% off — limited-time price</div>
                <div style={{ flex: 1, marginBottom: 16 }}>
                  <FeatureList items={PAID_FEATURES} tone="default" />
                </div>
                {showBuyCta ? (
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => handleBuy(plan.passType)}
                    disabled={payingFor !== null}
                  >
                    {payingFor === plan.passType ? 'Opening checkout…' : 'Buy'}
                  </button>
                ) : isCurrent ? (
                  <div style={{ fontSize: 12, color: 'var(--accent-text)', fontWeight: 600, textAlign: 'center', padding: '8px 0' }}>Your current plan</div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 16 }}>
        One-time purchase, not a recurring subscription. By buying a pass you agree to the{' '}
        <Link href="/terms" target="_blank" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>Terms of Service</Link> and{' '}
        <Link href="/refund-policy" target="_blank" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>Refund Policy</Link>.
      </div>
    </div>
  )
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

// The Assisted Apply browser extension isn't built yet (see
// docs/assisted_apply_extension_plan.md — Phase 1+), but the backend and
// this revoke UI are live now so a token can be minted for local extension
// development ahead of that. A token is a long-lived, individually
// revocable credential — distinct from the web session — meant to live in
// the extension's storage; see docs/assisted_apply_extension_plan.md's
// "Authentication" section.
function ExtensionsTab() {
  const [tokens, setTokens] = useState<ExtensionTokenSummary[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [minting, setMinting] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<{ token: string; label: string } | null>(null)
  const [labelInput, setLabelInput] = useState('')

  function load() {
    setLoading(true)
    extensionApi
      .listTokens()
      .then((res) => setTokens(res.tokens))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your connected extensions'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handleMint() {
    setMinting(true)
    setError('')
    try {
      const res = await extensionApi.mintToken(labelInput.trim() || undefined)
      setRevealed({ token: res.token, label: res.label })
      setLabelInput('')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate a token')
    } finally {
      setMinting(false)
    }
  }

  async function handleRevoke(id: string) {
    setRevokingId(id)
    setError('')
    try {
      await extensionApi.revokeToken(id)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not revoke this token')
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <>
      <GetExtensionCard />

      <div className="card" style={{ padding: 22, maxWidth: 760 }}>
      <div className="eyebrow" style={{ marginBottom: 4 }}>Extensions</div>
      <div className="serif" style={{ fontSize: 20, marginBottom: 10 }}>Connected extensions</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 18 }}>
        Tokens the Assisted Apply browser extension uses to act on your behalf — distinct from your regular
        sign-in, and revocable individually at any time.
      </div>

      {error && <div style={{ fontSize: 12, color: 'var(--error)', marginBottom: 14 }}>{error}</div>}

      {revealed && (
        <div style={{ padding: 14, borderRadius: 10, background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle-bd)', marginBottom: 18 }}>
          <div style={{ fontSize: 12.5, color: 'var(--accent-text)', marginBottom: 8 }}>
            <strong>{revealed.label}</strong> — copy this now, you won&rsquo;t see it again.
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code className="mono" style={{ flex: 1, fontSize: 12, padding: '8px 10px', background: 'var(--paper)', borderRadius: 6, overflow: 'auto', whiteSpace: 'nowrap' }}>
              {revealed.token}
            </code>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigator.clipboard?.writeText(revealed.token)}
            >
              Copy
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setRevealed(null)}>Done</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Label (optional) — e.g. Chrome on MacBook"
          value={labelInput}
          onChange={(e) => setLabelInput(e.target.value)}
          style={{ flex: 1, padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--line-2)', background: 'var(--paper)' }}
        />
        <button className="btn btn-primary btn-sm" onClick={handleMint} disabled={minting}>
          {minting ? 'Generating…' : 'Generate a token'}
        </button>
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</div>
      ) : !tokens || tokens.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No connected extensions yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tokens.map((t) => (
            <div
              key={t.id}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 12px', borderRadius: 8, background: 'var(--paper-2)' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{t.label}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  Created {formatDateTime(t.createdAt)} · Last used {t.lastUsedAt ? formatDateTime(t.lastUsedAt) : 'never'}
                </div>
              </div>
              {t.revokedAt ? (
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Revoked</span>
              ) : (
                <button className="btn btn-ghost btn-sm" disabled={revokingId === t.id} onClick={() => handleRevoke(t.id)}>
                  {revokingId === t.id ? 'Revoking…' : 'Revoke'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      </div>
    </>
  )
}

// Chrome removed inline (one-click, no-redirect) installation years ago —
// there's no API left that installs an extension straight from a third-
// party page. The honest version of "add it from our site" is a link to
// the extension's own Chrome Web Store listing, where the user clicks
// Google's own "Add to Chrome" button.
function GetExtensionCard() {
  return (
    <div className="card" style={{ padding: 22, maxWidth: 760, marginBottom: 18 }}>
      <div className="eyebrow" style={{ marginBottom: 4 }}>Get the extension</div>
      <div className="serif" style={{ fontSize: 20, marginBottom: 10 }}>Assisted Apply for Chrome</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 12 }}>
        Fills job application forms on company career sites using your JobMagnate profile — you review
        every field and click submit yourself.
      </div>
      <ul style={{ fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.7, paddingLeft: 18, marginBottom: 16 }}>
        <li>Works on almost any employer&rsquo;s application form, not a fixed list of sites</li>
        <li>Fills name, email, phone, location, LinkedIn and other profile fields it recognizes</li>
        <li>Leaves screening questions and EEO fields blank for you to answer in your own words</li>
        <li>Never submits a form for you</li>
      </ul>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 16 }}>
        <strong style={{ color: 'var(--text-soft)' }}>Setup:</strong> 1. Add it from the Chrome Web Store.
        2. <Link href="/extension/connect" style={{ color: 'var(--text-soft)', textDecoration: 'underline' }}>Connect it to your account</Link>.
        3. Open a job application and click the JobMagnate icon → <em>Fill this form</em>.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a href={CHROME_WEBSTORE_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
          Add to Chrome
        </a>
        <Link href="/extension/connect" className="btn btn-ghost btn-sm">
          Connect extension
        </Link>
      </div>
      <div style={{ marginTop: 12 }}>
        <Link href="/privacy" target="_blank" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'underline' }}>
          Privacy policy
        </Link>
      </div>
    </div>
  )
}

function ComingSoonTab({ label }: { label: string }) {
  return (
    <div className="card" style={{ padding: 22, maxWidth: 640, fontSize: 13, color: 'var(--text-muted)' }}>
      {label} isn&rsquo;t available yet.
    </div>
  )
}

const SUB_NAV = ['Profile', 'API keys', 'Privacy & data', 'Plan', 'Extensions', 'Notifications', 'Export']

const TAB_TITLES: Record<string, string> = {
  'Profile': 'Your career profile',
  'API keys': 'API keys & model strategy',
  'Privacy & data': 'Privacy & data',
  'Plan': 'Plan & billing',
  'Extensions': 'Connected extensions',
  'Notifications': 'Notifications',
  'Export': 'Export your data',
}

export default function SettingsPage() {
  const [activeNav, setActiveNav] = useState('API keys')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const router = useRouter()

  function handleSignOut() {
    clearToken()
    router.push('/login')
  }

  // Shared between the desktop sub-nav column and the mobile drawer — same
  // list, same handlers, just a different container (see .settings-subnav
  // / .settings-drawer in globals.css for why the drawer exists at all).
  function renderSubNavList(closeDrawerOnSelect: boolean) {
    return (
      <>
        {SUB_NAV.map(n => (
          <div
            key={n}
            onClick={() => {
              setActiveNav(n)
              if (closeDrawerOnSelect) setMobileMenuOpen(false)
            }}
            style={{ padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 2, color: activeNav === n ? 'var(--accent-text)' : 'var(--text-soft)', background: activeNav === n ? 'var(--accent-subtle)' : 'transparent', fontWeight: activeNav === n ? 500 : 400, cursor: 'pointer' }}
          >
            {n}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div
          onClick={() => setConfirmingSignOut(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer', marginTop: 12, borderTop: '1px solid var(--line-2)', paddingTop: 16 }}
        >
          <Icon.LogOut size={14} />
          Sign out
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar
        eyebrow="Settings"
        title={TAB_TITLES[activeNav]}
        mobileExtra={
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open settings menu"
            style={{ display: 'flex', alignItems: 'center', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
          >
            <Icon.Menu size={16} />
          </button>
        }
      />
      <div className="grid-stack-scroll" style={{ flex: 1, display: 'grid', gridTemplateColumns: '220px 1fr', overflow: 'hidden' }}>
        {/* Sub-nav — desktop only below 768px, see .settings-subnav */}
        <div className="settings-subnav" style={{ borderRight: '1px solid var(--line-2)', padding: 20, background: 'var(--paper)', flexDirection: 'column' }}>
          {renderSubNavList(false)}
        </div>

        {/* Form */}
        <div style={{ overflow: 'auto', padding: '28px 36px', background: 'var(--paper-2)' }}>
          {activeNav === 'Profile' && <ProfileTab />}
          {activeNav === 'Privacy & data' && <PrivacyTab />}
          {activeNav === 'Export' && <ExportTab />}
          {activeNav === 'Plan' && <PlanTab />}
          {activeNav === 'Extensions' && <ExtensionsTab />}
          {activeNav === 'Notifications' && <ComingSoonTab label="Notifications" />}

          {activeNav === 'API keys' && (
            <>
              <div style={{ maxWidth: 760, marginBottom: 26 }}>
                <div className="serif" style={{ fontSize: 26 }}>Bring your own model — or use ours.</div>
                <div style={{ fontSize: 13.5, color: 'var(--text-soft)', marginTop: 8, lineHeight: 1.55 }}>
                  We use embeddings on our own servers for matching. For rewriting, tailoring, and cover letters you can plug in your own keys —
                  we&rsquo;ll route generation through them and never see the content. If you don&rsquo;t add a key, we fall back to our own hosted models.
                  It&rsquo;s also what keeps match scores, tailored résumés and cover letters working if your paid plan or trial ends — those pause on the
                  free tier otherwise.
                </div>
              </div>

              <ModelConnectionCard />
            </>
          )}
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="settings-drawer-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="settings-drawer" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div className="eyebrow" style={{ margin: 0 }}>Settings</div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close"
                style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <Icon.X size={14} />
              </button>
            </div>
            {renderSubNavList(true)}
          </div>
        </div>
      )}

      {confirmingSignOut && (
        <ConfirmDialog
          title="Sign out?"
          body="You'll need to sign back in to get to your dashboard, résumés, and matched jobs."
          confirmLabel="Sign out"
          onConfirm={handleSignOut}
          onCancel={() => setConfirmingSignOut(false)}
        />
      )}
    </>
  )
}
