/**
 * NM-29 — model catalog, probes, alerts and catalog-driven model selection.
 * Everything here is network- and DB-free: fetch is faked, the alert store is
 * in-memory, and the runtime catalog cache is set directly.
 */

jest.mock('../../src/config', () => ({
  config: { llm: { providers: [], cooldownMs: 900_000, billingCooldownMs: 3_600_000, fatalCooldownMs: 21_600_000, catalogCacheTtlMs: 600_000, allowPaid: false } },
}))
jest.mock('../../src/config/dataSource', () => ({ AppDataSource: { isInitialized: false, getRepository: jest.fn() } }))
jest.mock('../../src/utils/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

import { LlmModelStatus } from '../../src/entities/enums'
import { classifyProbeResponse, isCorrectExtraction, statusForOutcome } from '../../src/services/ai/catalog/probe'
import { groqDailyUsage, isCandidateModel, listModels } from '../../src/services/ai/catalog/providerAdapters'
import { accountState, paramBillions, rankRows } from '../../src/services/ai/catalog/catalogJobs'
import { AlertStore, dispatchAlerts, evaluateAlerts, ProviderHealth, REALERT_AFTER_MS, slackSender } from '../../src/services/ai/catalog/alerts'
import { setCatalogCacheForTests } from '../../src/services/ai/catalog/modelCatalog'
import { usableModels, resetBench, benchProvider, modelKey } from '../../src/services/ai/providerChain'
import type { ActiveProvider } from '../../src/services/ai/providerRegistry'

const GOOD_JSON = '{"name":"Priya Sharma","title":"Senior Backend Engineer","skills":["Go","PostgreSQL","Kafka"],"years_experience":7}'
const chat = (content: string | null) => ({ choices: [{ message: { content } }] })

describe('probe: quality bar and classification', () => {
  it('accepts the correct extraction, including fenced or wrapped JSON', () => {
    expect(isCorrectExtraction(GOOD_JSON)).toBe(true)
    expect(isCorrectExtraction('```json\n' + GOOD_JSON + '\n```')).toBe(true)
    expect(isCorrectExtraction('Here you go: ' + GOOD_JSON)).toBe(true)
  })

  it('rejects wrong or unparseable answers', () => {
    expect(isCorrectExtraction('OK')).toBe(false)
    expect(isCorrectExtraction(GOOD_JSON.replace('"years_experience":7', '"years_experience":5'))).toBe(false)
    expect(isCorrectExtraction('{"name": "Priya", broken')).toBe(false)
  })

  it.each([
    [200, chat(GOOD_JSON), 'ok'],
    [200, chat('not json'), 'bad_quality'],
    [200, chat(null), 'bad_quality'],
    [402, null, 'billing'],
    [401, null, 'auth'],
    [429, null, 'rate_limited'],
    [503, null, 'rate_limited'],
    [404, null, 'unavailable'],
    [403, null, 'unavailable'], // e.g. OpenRouter "only available on agentic harnesses"
    [200, { error: { code: 429, message: 'upstream rate limited' } }, 'rate_limited'], // OpenRouter 200-with-error
  ])('status %p → %p', (status, body, outcome) => {
    expect(classifyProbeResponse(status as number, body).outcome).toBe(outcome)
  })

  it('maps outcomes to catalog statuses; account-level outcomes leave the row alone', () => {
    expect(statusForOutcome('ok')).toBe(LlmModelStatus.ACTIVE)
    expect(statusForOutcome('timeout')).toBe(LlmModelStatus.UNAVAILABLE)
    expect(statusForOutcome('billing')).toBeNull()
    expect(statusForOutcome('auth')).toBeNull()
  })
})

describe('provider adapters', () => {
  it.each([
    ['gemini', 'gemini-3.5-flash-lite', true],
    ['gemini', 'gemini-2.5-flash-preview-tts', false],
    ['gemini', 'gemini-embedding-2', false],
    ['gemini', 'veo-3.1-generate-preview', false],
    ['gemini', 'gemini-3.1-flash-live-preview', false],
    ['groq', 'meta-llama/llama-prompt-guard-2-86m', false],
    ['groq', 'openai/gpt-oss-safeguard-20b', false],
    ['groq', 'openai/gpt-oss-120b', true],
    ['openrouter', 'google/gemma-4-31b-it:free', true],
    ['openrouter', 'google/gemma-4-31b-it', false], // paid variant
    ['openrouter', 'nvidia/nemotron-3.5-content-safety:free', false],
    ['openrouter', 'cohere/north-mini-code:free', false],
    ['openrouter', 'inclusionai/ling-3.0-flash-fin:free', false],
    ['ollama', 'gpt-oss:120b', true],
  ])('%s %s → candidate %p', (provider, model, expected) => {
    expect(isCandidateModel(provider, model)).toBe(expected)
  })

  it('lists models, stripping Gemini\'s "models/" prefix and reading limits', async () => {
    const fetchImpl = jest.fn(async () =>
      new Response(JSON.stringify({ data: [{ id: 'models/gemini-3.5-flash-lite' }, { id: 'x:free', context_length: 1000, top_provider: { max_completion_tokens: 200 } }] }), { status: 200 })
    )
    const p = { id: 'gemini', baseUrl: 'https://g.example/v1beta/openai/', apiKey: 'k' } as ActiveProvider
    const res = await listModels(p, fetchImpl as never)
    expect(fetchImpl).toHaveBeenCalledWith('https://g.example/v1beta/openai/models', expect.anything())
    expect(res).toEqual({
      ok: true,
      models: [
        { id: 'gemini-3.5-flash-lite', isFree: true, contextWindow: null, maxOutputTokens: null },
        { id: 'x:free', isFree: true, contextWindow: 1000, maxOutputTokens: 200 },
      ],
    })
  })

  it('reports a failed listing with its status', async () => {
    const fetchImpl = jest.fn(async () => new Response('nope', { status: 402 }))
    const res = await listModels({ id: 'gemini', baseUrl: 'https://g', apiKey: 'k' } as ActiveProvider, fetchImpl as never)
    expect(res).toMatchObject({ ok: false, status: 402 })
  })

  it("reads Groq's requests-per-day usage from response headers", () => {
    expect(groqDailyUsage(new Headers({ 'x-ratelimit-limit-requests': '1000', 'x-ratelimit-remaining-requests': '150' }))).toBeCloseTo(0.85)
    expect(groqDailyUsage(new Headers())).toBeNull()
    expect(groqDailyUsage(undefined)).toBeNull()
  })
})

describe('ranking and provider state', () => {
  it('ranks ACTIVE by latency, then RATE_LIMITED; everything else unranked', () => {
    const rows = [
      { modelId: 'a-70b', status: LlmModelStatus.RATE_LIMITED, lastProbeLatencyMs: null, rank: 0 },
      { modelId: 'b-70b', status: LlmModelStatus.ACTIVE, lastProbeLatencyMs: 5000, rank: 0 },
      { modelId: 'c-70b', status: LlmModelStatus.UNAVAILABLE, lastProbeLatencyMs: null, rank: 0 },
      { modelId: 'd-70b', status: LlmModelStatus.ACTIVE, lastProbeLatencyMs: 1200, rank: 0 },
    ]
    rankRows(rows)
    expect(rows.map((r) => r.rank)).toEqual([3, 2, 1000, 1])
  })

  it("keeps the registry's curated models first and small models last, regardless of speed", () => {
    // The first real run: Groq's fastest passing model was allam-2-7b (177ms).
    const rows = [
      { modelId: 'allam-2-7b', status: LlmModelStatus.ACTIVE, lastProbeLatencyMs: 177, rank: 0 },
      { modelId: 'qwen/qwen3.8-27b', status: LlmModelStatus.ACTIVE, lastProbeLatencyMs: 253, rank: 0 },
      { modelId: 'openai/gpt-oss-20b', status: LlmModelStatus.ACTIVE, lastProbeLatencyMs: 511, rank: 0 },
      { modelId: 'openai/gpt-oss-120b', status: LlmModelStatus.ACTIVE, lastProbeLatencyMs: 667, rank: 0 },
    ]
    rankRows(rows, ['openai/gpt-oss-120b'])
    const order = [...rows].sort((a, b) => a.rank - b.rank).map((r) => r.modelId)
    expect(order).toEqual(['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'allam-2-7b'])
  })

  it.each([
    ['allam-2-7b', 7],
    ['openai/gpt-oss-120b', 120],
    ['nvidia/nemotron-3-ultra-550b-a55b:free', 550],
    ['gemma4:31b', 31],
    ['gemini-3.5-flash-lite', null],
  ])('paramBillions(%p) = %p', (id, expected) => {
    expect(paramBillions(id)).toBe(expected)
  })

  it('treats 402 / 401 as account-level only when no model on the provider works', () => {
    expect(accountState([{ outcome: 'billing' }, { outcome: 'billing' }])).toBe('billing')
    expect(accountState([{ outcome: 'auth' }])).toBe('auth')
    // Ollama: premium models 402 while free ones pass → a per-model paywall, not billing.
    expect(accountState([{ outcome: 'ok' }, { outcome: 'billing' }])).toBeNull()
    expect(accountState([{ outcome: 'rate_limited' }, { outcome: 'unavailable' }])).toBeNull()
  })
})

const health = (over: Partial<ProviderHealth>): ProviderHealth => ({
  providerId: 'groq', label: 'Groq', state: 'ok', workingModels: 5, dailyUsage: null, detail: '1/1 probed model(s) passed', ...over,
})

describe('evaluateAlerts()', () => {
  it('raises nothing for a healthy provider', () => {
    expect(evaluateAlerts([health({})])).toEqual([])
  })

  it('raises one alert per account-level state, without piling on', () => {
    expect(evaluateAlerts([health({ state: 'billing', workingModels: 0 })]).map((c) => c.key)).toEqual(['billing:groq'])
    expect(evaluateAlerts([health({ state: 'auth' })]).map((c) => c.key)).toEqual(['key:groq'])
    expect(evaluateAlerts([health({ state: 'down', workingModels: 0 })]).map((c) => c.key)).toEqual(['down:groq'])
  })

  it('warns on too few working models (OpenRouter needs 3) and on ≥80% daily usage', () => {
    expect(evaluateAlerts([health({ providerId: 'openrouter', label: 'OpenRouter', workingModels: 2 })]).map((c) => c.key)).toEqual(['few-models:openrouter'])
    expect(evaluateAlerts([health({ workingModels: 1 })])).toEqual([]) // others need 1
    expect(evaluateAlerts([health({ dailyUsage: 0.85 })]).map((c) => c.key)).toEqual(['quota:groq'])
    expect(evaluateAlerts([health({ dailyUsage: 0.5 })])).toEqual([])
  })
})

function memoryStore(initial: { id: string; alertKey: string; lastSentAt: Date; resolvedAt?: Date | null }[] = []): AlertStore & { rows: typeof initial } {
  const rows = initial.map((r) => ({ resolvedAt: null, ...r }))
  let n = rows.length
  return {
    rows,
    openAlerts: async () => rows.filter((r) => !r.resolvedAt),
    create: async (alertKey, _m, sentAt) => { rows.push({ id: String(++n), alertKey, lastSentAt: sentAt, resolvedAt: null }) },
    markSent: async (id, _m, sentAt) => { rows.find((r) => r.id === id)!.lastSentAt = sentAt },
    resolve: async (id, at) => { rows.find((r) => r.id === id)!.resolvedAt = at },
  }
}

describe('dispatchAlerts() de-duplication', () => {
  const now = new Date('2026-09-24T02:30:00Z')
  const cond = { key: 'billing:gemini', message: '*Gemini* needs billing action.' }

  it('sends a new alert once and records it', async () => {
    const store = memoryStore()
    const send = jest.fn(async () => true)
    const s = await dispatchAlerts([cond], ['gemini'], store, send, now)
    expect(s.sent).toEqual(['billing:gemini'])
    expect(send).toHaveBeenCalledWith(expect.stringContaining('needs billing action'))
    expect(store.rows).toHaveLength(1)
  })

  it('suppresses a repeat within 24h, reminds after 24h', async () => {
    const recent = memoryStore([{ id: '1', alertKey: 'billing:gemini', lastSentAt: new Date(now.getTime() - 3600_000) }])
    const send = jest.fn(async () => true)
    expect((await dispatchAlerts([cond], ['gemini'], recent, send, now)).suppressed).toEqual(['billing:gemini'])
    expect(send).not.toHaveBeenCalled()

    const old = memoryStore([{ id: '1', alertKey: 'billing:gemini', lastSentAt: new Date(now.getTime() - REALERT_AFTER_MS) }])
    expect((await dispatchAlerts([cond], ['gemini'], old, send, now)).reminded).toEqual(['billing:gemini'])
    expect(send).toHaveBeenCalledWith(expect.stringContaining('Still happening'))
  })

  it('resolves a cleared alert, but only for providers this run evaluated', async () => {
    const store = memoryStore([
      { id: '1', alertKey: 'billing:gemini', lastSentAt: now },
      { id: '2', alertKey: 'down:ollama', lastSentAt: now },
    ])
    const send = jest.fn(async () => true)
    const s = await dispatchAlerts([], ['gemini'], store, send, now)
    expect(s.resolved).toEqual(['billing:gemini'])
    expect(store.rows.find((r) => r.id === '2')!.resolvedAt).toBeNull()
  })

  it("doesn't record an alert Slack failed to receive, so the next run retries it", async () => {
    const store = memoryStore()
    await dispatchAlerts([cond], ['gemini'], store, async () => false, now)
    expect(store.rows).toHaveLength(0)
  })

  it('slackSender without a webhook logs instead of posting', async () => {
    const fetchImpl = jest.fn()
    expect(await slackSender(undefined, fetchImpl as never)('hello')).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('slackSender posts the tagged text to the webhook', async () => {
    const fetchImpl = jest.fn(async () => new Response('ok', { status: 200 }))
    expect(await slackSender('https://hooks.slack.test/x', fetchImpl as never)('hello')).toBe(true)
    expect(fetchImpl).toHaveBeenCalledWith('https://hooks.slack.test/x', expect.objectContaining({ body: JSON.stringify({ text: '[JobMagnate LLM] hello' }) }))
  })
})

describe('usableModels(): env pin → catalog → hardcoded', () => {
  const provider = (over: Partial<ActiveProvider> = {}): ActiveProvider => ({
    id: 'openrouter', label: 'OpenRouter', tier: 'free', protocol: 'openai', apiKey: 'k',
    model: 'hard-a:free', models: ['hard-a:free', 'hard-b:free'], ...over,
  })
  afterEach(() => { setCatalogCacheForTests(new Map()); resetBench() })

  it('uses the hardcoded list when the catalog is empty', () => {
    setCatalogCacheForTests(new Map())
    expect(usableModels(provider())).toEqual(['hard-a:free', 'hard-b:free'])
  })

  it('prefers the catalog when it has models for the provider', () => {
    setCatalogCacheForTests(new Map([['openrouter', ['cat-1:free', 'cat-2:free']]]))
    expect(usableModels(provider())).toEqual(['cat-1:free', 'cat-2:free'])
  })

  it('ignores the catalog when *_MODEL pinned the list', () => {
    setCatalogCacheForTests(new Map([['openrouter', ['cat-1:free']]]))
    expect(usableModels(provider({ modelsPinned: true }))).toEqual(['hard-a:free', 'hard-b:free'])
  })

  it('still drops individually benched models', () => {
    setCatalogCacheForTests(new Map([['openrouter', ['cat-1:free', 'cat-2:free']]]))
    benchProvider(modelKey('openrouter', 'cat-1:free'), 60_000)
    expect(usableModels(provider())).toEqual(['cat-2:free'])
  })
})
