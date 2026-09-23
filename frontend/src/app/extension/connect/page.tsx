'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { isAuthenticated } from '@/lib/auth'
import { extension as extensionApi, ApiError } from '@/lib/api'
import { EXTENSION_ID, CHROME_WEBSTORE_URL } from '@/lib/extension'

// Chrome injects this typing at runtime; declared loosely here rather than
// pulling in @types/chrome for one optional call.
declare const chrome:
  | { runtime?: { sendMessage?: (extensionId: string, message: unknown, callback?: (response: unknown) => void) => void } }
  | undefined

type Step = 'loading' | 'signed-out' | 'consent' | 'connecting' | 'connected' | 'manual' | 'error'

// The consent screen POST /api/extension/tokens's callers land on before a
// token is minted — see "Authentication" in docs/assisted_apply_extension_plan.md.
// Names exactly what's granted; on approve, hands the token to the
// extension automatically when it can, and falls back to "copy this token"
// when it can't (extension not installed, or a local unpacked build whose id
// doesn't match EXTENSION_ID).
export default function ExtensionConnectPage() {
  const [step, setStep] = useState<Step>('loading')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setStep(isAuthenticated() ? 'consent' : 'signed-out')
  }, [])

  async function handleApprove() {
    setStep('connecting')
    setError('')
    try {
      const res = await extensionApi.mintToken('Browser extension')
      setToken(res.token)

      const sendMessage = typeof chrome !== 'undefined' ? chrome?.runtime?.sendMessage : undefined
      if (EXTENSION_ID && sendMessage) {
        let settled = false
        sendMessage(EXTENSION_ID, { type: 'JOBMAGNATE_CONNECT', token: res.token }, (response: unknown) => {
          settled = true
          setStep((response as { ok?: boolean } | undefined)?.ok ? 'connected' : 'manual')
        })
        // The extension may not be installed at all, in which case the
        // callback above never fires — don't leave the user staring at
        // "Connecting…" forever.
        setTimeout(() => {
          if (!settled) setStep('manual')
        }, 1500)
      } else {
        setStep('manual')
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate a token')
      setStep('error')
    }
  }

  return (
    <div className="app-root" style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 22, textDecoration: 'none', color: 'var(--text)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a small static brand asset, not worth next/image's overhead here */}
            <img src="/icons/logo-mark.png" alt="" width={74} height={22} />
            <span className="wordmark">JobMagnate</span>
          </Link>
          <div style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 8 }}>Connect the Assisted Apply extension</div>
        </div>

        <div className="card" style={{ padding: 28 }}>
          {step === 'loading' && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</div>}

          {step === 'signed-out' && (
            <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>
              Sign in first, then come back to this page. Need the extension?{' '}
              <a href={CHROME_WEBSTORE_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-soft)', textDecoration: 'underline' }}>
                Add it to Chrome
              </a>
              .
              <div style={{ marginTop: 16 }}>
                <Link href="/login" className="btn btn-primary btn-sm">Sign in</Link>
              </div>
            </div>
          )}

          {(step === 'consent' || step === 'connecting') && (
            <>
              <div className="serif" style={{ fontSize: 18, marginBottom: 12 }}>This extension will be able to:</div>
              <ul style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.7, paddingLeft: 18, marginBottom: 20 }}>
                <li>Read your profile fields (name, email, phone, location, links) to fill application forms</li>
                <li>Read which résumé and cover letter you&rsquo;ve <strong>approved</strong> for a job, to attach the right one</li>
                <li>Log when you mark a job as applied</li>
              </ul>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                It never sees your password, and it never submits a form for you — you always review and click submit yourself.
                You can revoke this anytime from Settings → Extensions.
              </div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', height: 40 }} onClick={handleApprove} disabled={step === 'connecting'}>
                {step === 'connecting' ? 'Connecting…' : 'Approve'}
              </button>
            </>
          )}

          {step === 'connected' && (
            <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>
              <strong>Connected.</strong> You can close this tab and start using the extension.
            </div>
          )}

          {step === 'manual' && (
            <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>
              <div style={{ marginBottom: 10 }}>
                <strong>Token generated.</strong> Couldn&rsquo;t hand it to the extension automatically — paste it into the extension&rsquo;s popup instead.
              </div>
              <code className="mono" style={{ display: 'block', fontSize: 12, padding: '8px 10px', background: 'var(--paper-2)', borderRadius: 6, overflow: 'auto', whiteSpace: 'nowrap', marginBottom: 10 }}>
                {token}
              </code>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>This won&rsquo;t be shown again — copy it now. You can always generate a new one from Settings → Extensions.</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
                Don&rsquo;t have the extension yet?{' '}
                <a href={CHROME_WEBSTORE_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-soft)', textDecoration: 'underline' }}>
                  Add it from the Chrome Web Store
                </a>
                , then paste this token into its popup.
              </div>
            </div>
          )}

          {step === 'error' && (
            <div style={{ fontSize: 13.5 }}>
              <div style={{ color: 'var(--error)', marginBottom: 12 }}>{error}</div>
              <button className="btn btn-primary btn-sm" onClick={handleApprove}>Try again</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
