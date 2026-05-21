'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { Chip } from '@/components/ui/Chip'
import { Icon } from '@/components/ui/Icon'
import { profile as profileApi } from '@/lib/api'

type OnboardingState =
  | 'WELCOME' | 'TARGET_ROLES' | 'INDUSTRIES' | 'LOCATIONS'
  | 'REMOTE_PREFERENCE' | 'SALARY' | 'URGENCY' | 'NOTICE_PERIOD'
  | 'VISA_STATUS' | 'DONE'

interface Message { from: 'ai' | 'user'; text: string; rationale?: boolean }

const QUICK_REPLIES: Partial<Record<OnboardingState, string[]>> = {
  REMOTE_PREFERENCE: ['Remote only', 'Hybrid preferred', 'On-site OK', 'Flexible'],
  URGENCY: ['Actively looking', 'Open to offers', 'Just exploring', 'Not right now'],
  SALARY: ['$120–150k', '$150–180k', '$180–220k', '$220k+', 'Prefer not to say'],
}

const PROFILE_FIELDS: Record<string, string> = {
  'Target roles': '',
  'Industries': '',
  'Location': '',
  'Remote pref': '',
  'Salary': '',
}

export default function OnboardingPage() {
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [messages, setMessages] = useState<Message[]>([
    { from: 'ai', text: "Hi Maya! I've parsed your resume. Let's talk about what you're looking for. What kind of role are you targeting next?" },
  ])
  const [input, setInput] = useState('')
  const [currentState, setCurrentState] = useState<OnboardingState>('TARGET_ROLES')
  const [loading, setLoading] = useState(false)
  const [completionPct, setCompletionPct] = useState(10)
  const [profilePreview, setProfilePreview] = useState(PROFILE_FIELDS)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    setInput('')
    setMessages(prev => [...prev, { from: 'user', text }])
    setLoading(true)

    try {
      const res = await profileApi.onboarding(text, currentState)
      setMessages(prev => [
        ...prev,
        { from: 'ai', text: res.message },
      ])
      if (res.state) setCurrentState(res.state)
      if (res.profileUpdates) setProfilePreview(prev => ({ ...prev, ...res.profileUpdates }))
      setCompletionPct(Math.min(90, completionPct + 12))
      if (res.isComplete || res.state === 'DONE') {
        setTimeout(() => router.push('/resume'), 1200)
      }
    } catch {
      setMessages(prev => [...prev, { from: 'ai', text: "Sorry, I hit an error. Could you try again?" }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Topbar
        eyebrow="Onboarding · Step 2 of 3"
        title="Tell me about your search"
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{completionPct}% complete</div>
            <div style={{ width: 80, height: 4, background: 'var(--paper-3)', borderRadius: 999 }}>
              <div style={{ width: completionPct + '%', height: '100%', background: 'var(--ink-900)', borderRadius: 999, transition: 'width .4s' }} />
            </div>
          </div>
        }
      />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 340px', overflow: 'hidden' }}>

        {/* Chat */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--line-2)', background: 'var(--paper)' }}>
          <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {messages.map((msg, i) => (
              msg.from === 'user' ? (
                <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '80%', background: 'var(--ink-900)', color: 'var(--text-onink)', padding: '10px 14px', borderRadius: '14px 14px 4px 14px', fontSize: 13.5, lineHeight: 1.5 }}>
                  {msg.text}
                </div>
              ) : (
                <div key={i} style={{ display: 'flex', gap: 10, maxWidth: '88%' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 999, background: 'var(--ochre-100)', color: 'var(--ochre-900)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon.Sparkle size={14} />
                  </div>
                  <div style={{ background: msg.rationale ? 'var(--ochre-100)' : 'var(--surface)', border: '1px solid ' + (msg.rationale ? 'var(--ochre-200)' : 'var(--line-2)'), padding: '10px 14px', borderRadius: '4px 14px 14px 14px', fontSize: 13.5, lineHeight: 1.5 }}>
                    {msg.rationale && <div className="eyebrow" style={{ color: 'var(--ochre-900)', marginBottom: 4 }}>Why I&rsquo;m asking</div>}
                    {msg.text}
                  </div>
                </div>
              )
            ))}
            {loading && (
              <div style={{ display: 'flex', gap: 10, maxWidth: '88%' }}>
                <div style={{ width: 30, height: 30, borderRadius: 999, background: 'var(--ochre-100)', color: 'var(--ochre-900)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon.Sparkle size={14} />
                </div>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--line-2)', padding: '12px 14px', borderRadius: '4px 14px 14px 14px', display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--text-muted)', display: 'inline-block', animation: `bounce .9s ${i * 0.15}s ease-in-out infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick replies */}
          {QUICK_REPLIES[currentState] && (
            <div style={{ padding: '0 24px 8px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {QUICK_REPLIES[currentState]!.map(r => (
                <button key={r} className="chip" onClick={() => sendMessage(r)} style={{ cursor: 'pointer' }}>{r}</button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '8px 16px 16px' }}>
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px' }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
                placeholder="Type your answer…"
                style={{ flex: 1, border: 0, outline: 0, background: 'transparent', fontSize: 14, fontFamily: 'inherit' }}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
              >
                <Icon.Send size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Live profile preview */}
        <div style={{ overflow: 'auto', padding: 24, background: 'var(--paper-2)' }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Your profile — filling in</div>
          <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(profilePreview).map(([k, v]) => (
              <div key={k} style={{ padding: '10px 0', borderBottom: '1px solid var(--line-2)' }}>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.1, marginBottom: 4 }}>{k}</div>
                {v ? (
                  <div style={{ fontSize: 14 }}>{v}</div>
                ) : (
                  <div style={{ height: 10, borderRadius: 999, background: 'var(--paper-3)', width: '50%' }} />
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18, padding: 14, background: 'var(--ochre-100)', borderRadius: 10, fontSize: 12.5, color: 'var(--ochre-900)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Icon.Sparkle size={14} />
              <span className="eyebrow" style={{ color: 'var(--ochre-900)' }}>Why I&rsquo;m asking</span>
            </div>
            Each answer makes job matching more precise and the tailoring prompts more specific to your actual situation.
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-4px); }
        }
      `}</style>
    </>
  )
}
