'use client'

import { useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Toggle } from '@/components/ui/Toggle'
import { Icon } from '@/components/ui/Icon'

type KeyStatus = 'connected' | 'empty' | 'advanced'

interface KeyCardProps {
  provider: string
  status: KeyStatus
  keyValue?: string
  placeholder?: string
  lastUsed?: string
  models?: string[]
  primary?: boolean
  host?: string
}

function KeyCard({ provider, status, keyValue, placeholder, lastUsed, models = [], primary, host }: KeyCardProps) {
  const STATUS_STYLE: Record<KeyStatus, [string, string, string]> = {
    connected: ['var(--sage-100)',  'var(--sage-900)',  'Connected'],
    empty:     ['var(--paper-3)',   'var(--text-soft)', 'Not configured'],
    advanced:  ['var(--ink-100)',   'var(--ink-900)',   'Advanced · local'],
  }
  const [bg, fg, label] = STATUS_STYLE[status]

  return (
    <div className="card" style={{ padding: 18, position: 'relative' }}>
      {primary && <div className="pill pill-ai" style={{ position: 'absolute', top: 14, right: 14 }}>Primary</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--ink-900)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 16 }}>{provider[0]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{provider}</div>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: bg, color: fg, letterSpacing: 0.02 }}>{label}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-soft)', background: 'var(--paper-2)' }}>
        {host ? <Icon.Compass size={13} /> : <Icon.Lightning size={13} />}
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{keyValue || host || placeholder}</span>
        {keyValue && <button className="btn btn-ghost btn-sm">Rotate</button>}
        {!keyValue && !host && <button className="btn btn-primary btn-sm">Add key</button>}
      </div>
      {lastUsed && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Last used · {lastUsed}</div>}
      {models.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 12 }}>
          {models.map(m => <span key={m} className="mono" style={{ fontSize: 10.5, padding: '3px 7px', borderRadius: 999, background: 'var(--paper-2)', color: 'var(--text-soft)', border: '1px solid var(--line-2)' }}>{m}</span>)}
        </div>
      )}
    </div>
  )
}

const GUARDRAILS: [string, boolean][] = [
  ['Truth-layer check on resume rewrites', true],
  ['Hallucination diff before approval',   true],
  ['Block on unverifiable employers',      true],
  ['Mention model used in tooltip',        false],
]

const ROUTING = [
  ['Resume tailoring',      'Anthropic · claude-sonnet-4-6',  'Higher craft for nuanced rewrites'],
  ['Cover letter drafting', 'OpenAI · gpt-4.1',               'Strong long-form coherence'],
  ['Match explanations',    'Platform · hosted',               'Cheap, fast, no PII leaves us'],
  ['Skill-gap rationale',   'Platform · hosted',               'Cheap, fast, no PII leaves us'],
  ['LinkedIn rewrites',     'Anthropic · claude-haiku-4-5',   'Light, low cost'],
]

const SUB_NAV = ['Profile', 'API keys', 'Privacy & data', 'Plan', 'Notifications', 'Export']

export default function SettingsPage() {
  const [activeNav, setActiveNav] = useState('API keys')
  const [guardrails, setGuardrails] = useState<boolean[]>(GUARDRAILS.map(([, v]) => v))

  return (
    <>
      <Topbar
        eyebrow="Settings"
        title="API keys & model strategy"
        right={
          <>
            <button className="btn btn-secondary btn-sm">Cancel</button>
            <button className="btn btn-primary btn-sm">Save changes</button>
          </>
        }
      />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '220px 1fr', overflow: 'hidden' }}>
        {/* Sub-nav */}
        <div style={{ borderRight: '1px solid var(--line-2)', padding: 20, background: 'var(--paper)' }}>
          {SUB_NAV.map(n => (
            <div
              key={n}
              onClick={() => setActiveNav(n)}
              style={{ padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 2, color: activeNav === n ? 'var(--ink-900)' : 'var(--text-soft)', background: activeNav === n ? 'var(--ink-100)' : 'transparent', fontWeight: activeNav === n ? 500 : 400, cursor: 'pointer' }}
            >
              {n}
            </div>
          ))}
        </div>

        {/* Form */}
        <div style={{ overflow: 'auto', padding: '28px 36px', background: 'var(--paper-2)' }}>
          <div style={{ maxWidth: 760, marginBottom: 26 }}>
            <div className="serif" style={{ fontSize: 26 }}>Bring your own model — or use ours.</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-soft)', marginTop: 8, lineHeight: 1.55 }}>
              We use embeddings on our own servers for matching. For rewriting, tailoring, and cover letters you can plug in your own keys —
              we&rsquo;ll route generation through them and never see the content. If you don&rsquo;t add a key, we fall back to our hosted
              open-source model.
            </div>
          </div>

          {/* Key cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, maxWidth: 980, marginBottom: 22 }}>
            <KeyCard provider="OpenAI"    status="connected" keyValue="sk-…N3p2"    lastUsed="2m ago · cover letter"    models={['gpt-4.1', 'gpt-4.1-mini']} />
            <KeyCard provider="Anthropic" status="connected" keyValue="sk-ant-…f9c" lastUsed="14m ago · resume tailor"  models={['claude-sonnet-4-6', 'claude-haiku-4-5']} primary />
            <KeyCard provider="Google"    status="empty"     placeholder="AIza…"                                          models={['gemini-2.5-pro']} />
            <KeyCard provider="Local · vLLM" status="advanced"  host="http://localhost:8000" models={['llama-3.3-70b']} />
          </div>

          {/* Routing rules */}
          <div className="card" style={{ padding: 22, maxWidth: 980, marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div className="eyebrow">Routing rules</div>
                <div className="serif" style={{ fontSize: 20, marginTop: 2 }}>Which model handles what</div>
              </div>
              <button className="btn btn-ghost btn-sm">Reset to defaults</button>
            </div>
            {ROUTING.map(([task, model, why]) => (
              <div key={task} style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr 100px', gap: 14, alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--line-2)', fontSize: 13 }}>
                <div style={{ fontWeight: 500 }}>{task}</div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--text-soft)' }}>{model}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{why}</div>
                <button className="btn btn-ghost btn-sm" style={{ justifySelf: 'end' }}>Change</button>
              </div>
            ))}
          </div>

          {/* Usage + guardrails */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, maxWidth: 980 }}>
            <div className="card" style={{ padding: 22 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Usage this month</div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div className="display" style={{ fontSize: 42 }}>1.2M</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>tokens · est. cost on your keys</div>
                  <div className="serif" style={{ fontSize: 22, marginTop: 2 }}>$3.84</div>
                </div>
              </div>
              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[['Anthropic', 62], ['OpenAI', 24], ['Platform', 12], ['Local', 2]].map(([n, p]) => (
                  <div key={String(n)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                      <span>{n}</span><span className="mono" style={{ color: 'var(--text-muted)' }}>{p}%</span>
                    </div>
                    <div className="score-bar" style={{ marginTop: 4 }}><i style={{ width: p + '%' }} /></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card" style={{ padding: 22 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Guardrails</div>
              {GUARDRAILS.map(([n], idx) => (
                <div key={String(n)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--line-2)', fontSize: 13 }}>
                  <span>{n}</span>
                  <Toggle on={guardrails[idx]} onChange={v => setGuardrails(prev => prev.map((x, i) => i === idx ? v : x))} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
