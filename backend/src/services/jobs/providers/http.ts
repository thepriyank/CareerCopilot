/**
 * HTTP transport helper shared across job providers.
 *
 * Ported from santifer/career-ops (`providers/_http.mjs`, MIT License,
 * Copyright (c) 2026 Santiago Fernández de Valderrama).
 */

import { FetchOptions, ProviderContext } from './types'

const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; jobmagnate/0.1)'

interface HttpError extends Error {
  status?: number
  body?: string
  retryAfter?: string | null
}

async function fetchWithTimeout(url: string, opts: FetchOptions = {}): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers = {}, redirect = 'follow', method = 'GET', body } = opts
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method,
      headers: { 'user-agent': DEFAULT_USER_AGENT, ...headers },
      body,
      redirect,
      signal: controller.signal,
    })
    if (!res.ok) {
      const responseText = await res.text().catch(() => '')
      const err: HttpError = new Error(`HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`)
      err.status = res.status
      err.body = responseText
      err.retryAfter = res.headers.get('retry-after')
      throw err
    }
    return res
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchJson(url: string, opts: FetchOptions = {}): Promise<unknown> {
  const res = await fetchWithTimeout(url, opts)
  return res.json()
}

export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  const res = await fetchWithTimeout(url, opts)
  return res.text()
}

export function makeHttpContext(): ProviderContext {
  return { fetchJson, fetchText, sleep: (ms: number) => new Promise((r) => setTimeout(r, ms)) }
}
