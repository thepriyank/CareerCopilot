'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { Icon } from '@/components/ui/Icon'
import { settings as settingsApi, profile as profileApi, account as accountApi, ApiError } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import type { ModelConnectionStatus, CandidateProfile, RemotePreference, SearchUrgency } from '@/types'

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

function ComingSoonTab({ label }: { label: string }) {
  return (
    <div className="card" style={{ padding: 22, maxWidth: 640, fontSize: 13, color: 'var(--text-muted)' }}>
      {label} isn&rsquo;t available yet.
    </div>
  )
}

const SUB_NAV = ['Profile', 'API keys', 'Privacy & data', 'Plan', 'Notifications', 'Export']

const TAB_TITLES: Record<string, string> = {
  'Profile': 'Your career profile',
  'API keys': 'API keys & model strategy',
  'Privacy & data': 'Privacy & data',
  'Plan': 'Plan & billing',
  'Notifications': 'Notifications',
  'Export': 'Export your data',
}

export default function SettingsPage() {
  const [activeNav, setActiveNav] = useState('API keys')

  return (
    <>
      <Topbar
        eyebrow="Settings"
        title={TAB_TITLES[activeNav]}
      />
      <div className="grid-stack-scroll" style={{ flex: 1, display: 'grid', gridTemplateColumns: '220px 1fr', overflow: 'hidden' }}>
        {/* Sub-nav */}
        <div style={{ borderRight: '1px solid var(--line-2)', padding: 20, background: 'var(--paper)' }}>
          {SUB_NAV.map(n => (
            <div
              key={n}
              onClick={() => setActiveNav(n)}
              style={{ padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 2, color: activeNav === n ? 'var(--accent-text)' : 'var(--text-soft)', background: activeNav === n ? 'var(--accent-subtle)' : 'transparent', fontWeight: activeNav === n ? 500 : 400, cursor: 'pointer' }}
            >
              {n}
            </div>
          ))}
        </div>

        {/* Form */}
        <div style={{ overflow: 'auto', padding: '28px 36px', background: 'var(--paper-2)' }}>
          {activeNav === 'Profile' && <ProfileTab />}
          {activeNav === 'Privacy & data' && <PrivacyTab />}
          {activeNav === 'Export' && <ExportTab />}
          {activeNav === 'Plan' && <ComingSoonTab label="Plan & billing" />}
          {activeNav === 'Notifications' && <ComingSoonTab label="Notifications" />}

          {activeNav === 'API keys' && (
            <>
              <div style={{ maxWidth: 760, marginBottom: 26 }}>
                <div className="serif" style={{ fontSize: 26 }}>Bring your own model — or use ours.</div>
                <div style={{ fontSize: 13.5, color: 'var(--text-soft)', marginTop: 8, lineHeight: 1.55 }}>
                  We use embeddings on our own servers for matching. For rewriting, tailoring, and cover letters you can plug in your own keys —
                  we&rsquo;ll route generation through them and never see the content. If you don&rsquo;t add a key, we fall back to our hosted
                  open-source model.
                </div>
              </div>

              <ModelConnectionCard />
            </>
          )}
        </div>
      </div>
    </>
  )
}
