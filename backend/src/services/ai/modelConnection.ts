/**
 * Parses the single "model connection" field (Settings → API keys) into
 * either a cloud API key or a local/self-hosted OpenAI-compatible endpoint.
 *
 * Convention: if it looks like a URL, it's a local endpoint and the model
 * name rides in a `#model=` fragment (fragments are never sent over the
 * wire — purely a client-side annotation); otherwise it's treated as a raw
 * cloud API key, exactly as `userApiKey` already worked before this file
 * existed.
 *
 *   http://localhost:11434/v1#model=gemma4:e4b   → local (Ollama's OpenAI-
 *                                                    compatible endpoint)
 *   sk-ant-...                                    → cloud (Anthropic)
 *
 * The same mechanism works for any OpenAI-compatible server, local or
 * hosted — LM Studio, llama.cpp's server, vLLM, text-generation-webui,
 * koboldcpp, LocalAI, OpenRouter, Groq, Together.ai, OpenAI itself — since
 * they all speak the same wire protocol; only the base URL changes.
 */

export interface LocalModelConnection {
  kind: 'local'
  baseUrl: string
  model: string
}

export interface CloudModelConnection {
  kind: 'cloud'
  apiKey: string
}

export type ModelConnection = LocalModelConnection | CloudModelConnection

// Well-known cloud instance-metadata addresses. Not a general SSRF
// allowlist — arbitrary localhost/private-network endpoints are the whole
// point of this feature — just a floor against the single most common,
// most dangerous SSRF target. See ARCHITECTURE.md's note on why this is
// only appropriate for a self-hosted, single-operator deployment.
const BLOCKED_HOSTNAMES = new Set([
  '169.254.169.254', // AWS / GCP / Azure / OCI instance metadata
  '169.254.170.2', // AWS ECS task metadata
  'fd00:ec2::254', // AWS IMDSv2, IPv6
  'metadata.google.internal', // GCP metadata (also resolves to 169.254.169.254)
])

function parseLocalConnection(raw: string): LocalModelConnection {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`Invalid URL in model connection: ${raw}`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Local model endpoints must use http:// or https://')
  }

  const hostname = url.hostname.toLowerCase()
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error(`Refusing to connect to a cloud metadata address: ${hostname}`)
  }

  const model = new URLSearchParams(url.hash.replace(/^#/, '')).get('model')
  if (!model) {
    throw new Error(
      'Local model endpoints need a model name in a #model= fragment, e.g. "http://localhost:11434/v1#model=gemma4:e4b"'
    )
  }

  return { kind: 'local', baseUrl: url.origin + url.pathname + url.search, model }
}

export function parseModelConnection(raw: string): ModelConnection {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error('Model connection cannot be empty')
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return parseLocalConnection(trimmed)
  }

  return { kind: 'cloud', apiKey: trimmed }
}
