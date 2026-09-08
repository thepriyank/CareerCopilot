/**
 * Shared provider contract, adapted from santifer/career-ops's
 * `providers/_types.js` (MIT License, Copyright (c) 2026 Santiago Fernández
 * de Valderrama).
 */

export interface ProviderEntry {
  name: string
  careersUrl?: string
  api?: string
  provider?: string
}

export interface NormalizedJob {
  title: string
  url: string
  company: string
  location?: string
  description?: string
  postedAt?: number
  salary?: { min: number; max: number; currency: string } | null
  /** Per-job remote signal, when the provider's API actually states one (e.g.
   * JSearch's `job_is_remote`) — more trustworthy than inferring remote-ness
   * from which provider a job came from. Undefined when the provider doesn't say. */
  isRemote?: boolean
}

export interface FetchOptions {
  redirect?: 'error' | 'follow' | 'manual'
  timeoutMs?: number
  headers?: Record<string, string>
  method?: 'GET' | 'POST'
  body?: string
}

export interface ProviderContext {
  fetchJson: (url: string, opts?: FetchOptions) => Promise<unknown>
  fetchText: (url: string, opts?: FetchOptions) => Promise<string>
  sleep?: (ms: number) => Promise<void>
}

export interface Provider {
  id: string
  /** Cheap, synchronous-ish check for whether this provider can handle `entry`, without making a request. */
  detect(entry: ProviderEntry): { url: string } | null
  fetch(entry: ProviderEntry, ctx: ProviderContext): Promise<NormalizedJob[]>
}
