'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { auth as authApi } from '@/lib/api'
import { setToken } from '@/lib/auth'
import { isGoogleSignInAvailable } from '@/lib/firebase'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token } = await authApi.login(email, password)
      setToken(token)
      router.push('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-root" style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 22, textDecoration: 'none', color: 'var(--text)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a small static brand asset, not worth next/image's overhead here */}
            <img src="/icons/logo-mark.png" alt="" width={93} height={28} />
            <span className="wordmark">JobMagnate</span>
          </Link>
          <div style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 8 }}>Sign in to your account</div>
        </div>

        <div className="card" style={{ padding: 28 }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required autoFocus
                style={{ width: '100%', height: 36, padding: '0 12px', border: '1px solid var(--line-strong)', borderRadius: 'var(--r-2)', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: 'var(--surface)', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                style={{ width: '100%', height: 36, padding: '0 12px', border: '1px solid var(--line-strong)', borderRadius: 'var(--r-2)', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: 'var(--surface)', boxSizing: 'border-box' }}
              />
            </div>
            {error && (
              <div style={{ padding: '8px 12px', background: 'var(--error-bg)', border: '1px solid var(--error)', borderRadius: 'var(--r-2)', fontSize: 13, color: 'var(--error)', marginBottom: 16 }}>
                {error}
              </div>
            )}
            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', height: 40 }} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {isGoogleSignInAvailable() && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--line-strong)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>or</span>
                <div style={{ flex: 1, height: 1, background: 'var(--line-strong)' }} />
              </div>
              <GoogleSignInButton onError={setError} />
            </>
          )}

          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 20 }}>
            Don&rsquo;t have an account?{' '}
            <Link href="/register" style={{ color: 'var(--accent-text)', fontWeight: 500 }}>Create one</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
