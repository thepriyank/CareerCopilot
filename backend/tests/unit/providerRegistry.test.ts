import { resolveChain } from '../../src/services/ai/providerRegistry'

/**
 * resolveChain() reads provider keys straight from an injected env object, so
 * these tests never touch process.env or the real config singleton.
 */

describe('resolveChain()', () => {
  it('returns nothing when no provider keys are set', () => {
    expect(resolveChain({})).toEqual([])
  })

  it('includes only providers whose API-key env var is set', () => {
    const chain = resolveChain({ GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q' })
    expect(chain.map((p) => p.id).sort()).toEqual(['gemini', 'groq'])
    expect(chain.every((p) => p.tier === 'free')).toBe(true)
  })

  it('excludes paid providers unless LLM_ALLOW_PAID is truthy', () => {
    const withoutFlag = resolveChain({ GEMINI_API_KEY: 'g', ANTHROPIC_API_KEY: 'sk-ant' })
    expect(withoutFlag.map((p) => p.id)).toEqual(['gemini'])

    const withFlag = resolveChain({ GEMINI_API_KEY: 'g', ANTHROPIC_API_KEY: 'sk-ant', LLM_ALLOW_PAID: 'true' })
    expect(withFlag.map((p) => p.id)).toEqual(['gemini', 'anthropic'])
  })

  it('always orders every free provider before any paid provider', () => {
    const chain = resolveChain({
      GROQ_API_KEY: 'q',
      ANTHROPIC_API_KEY: 'sk-ant',
      LLM_ALLOW_PAID: '1',
      LLM_PROVIDER_ORDER: 'anthropic,groq', // deliberately puts paid first
    })
    expect(chain.map((p) => p.id)).toEqual(['groq', 'anthropic'])
  })

  it('by default puts Ollama (the topped-up paid backstop) last among free, before any paid provider', () => {
    const chain = resolveChain({
      OLLAMA_API_KEY: 'ol', GROQ_API_KEY: 'gq', GEMINI_API_KEY: 'gm', OPENROUTER_API_KEY: 'or',
      ANTHROPIC_API_KEY: 'sk', LLM_ALLOW_PAID: 'true',
    })
    expect(chain.map((p) => p.id)).toEqual(['groq', 'gemini', 'openrouter', 'ollama', 'anthropic'])
  })

  it('ignores a leftover CEREBRAS_API_KEY (provider removed 2026-09-23)', () => {
    const chain = resolveChain({ CEREBRAS_API_KEY: 'cb', GROQ_API_KEY: 'gq', LLM_PROVIDER_ORDER: 'cerebras,groq' })
    expect(chain.map((p) => p.id)).toEqual(['groq'])
  })

  it('honors LLM_PROVIDER_ORDER for providers within the same tier', () => {
    const chain = resolveChain({
      GROQ_API_KEY: 'q',
      GEMINI_API_KEY: 'g',
      OPENROUTER_API_KEY: 'o',
      LLM_PROVIDER_ORDER: 'gemini,openrouter,groq',
    })
    expect(chain.map((p) => p.id)).toEqual(['gemini', 'openrouter', 'groq'])
  })

  it('accepts a known alias env var for a provider key (GROK_API_KEY -> Groq)', () => {
    const chain = resolveChain({ GROK_API_KEY: 'gsk_typo' })
    expect(chain.map((p) => p.id)).toEqual(['groq'])
    expect(chain[0].apiKey).toBe('gsk_typo')
  })

  it('prefers the canonical key env var over an alias when both are set', () => {
    const chain = resolveChain({ GROQ_API_KEY: 'gsk_real', GROK_API_KEY: 'gsk_typo' })
    expect(chain[0].apiKey).toBe('gsk_real')
  })

  it('resolves each provider model from its *_MODEL env var, then a default', () => {
    const chain = resolveChain({ GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q', GEMINI_MODEL: 'gemini-2.5-pro' })
    expect(chain.find((p) => p.id === 'gemini')?.model).toBe('gemini-2.5-pro')
    expect(chain.find((p) => p.id === 'groq')?.model).toBe('openai/gpt-oss-120b')
  })

  it('falls back to the legacy OPENROUTER_PRESET for the OpenRouter model', () => {
    const chain = resolveChain({ OPENROUTER_API_KEY: 'or', OPENROUTER_PRESET: 'x-ai/grok-4-fast:free' })
    expect(chain.find((p) => p.id === 'openrouter')?.model).toBe('x-ai/grok-4-fast:free')
  })

  it('carries the OpenAI-compatible base URL and protocol for each provider', () => {
    const chain = resolveChain({ GEMINI_API_KEY: 'g', ANTHROPIC_API_KEY: 'sk-ant', LLM_ALLOW_PAID: 'yes' })
    const gemini = chain.find((p) => p.id === 'gemini')
    expect(gemini).toMatchObject({ protocol: 'openai', baseUrl: expect.stringContaining('generativelanguage') })
    const anthropic = chain.find((p) => p.id === 'anthropic')
    expect(anthropic).toMatchObject({ protocol: 'anthropic' })
    expect(anthropic?.baseUrl).toBeUndefined()
  })
})

describe('resolveChain() model lists', () => {
  it('gives OpenRouter its default model plus the fallback list', () => {
    const [or] = resolveChain({ OPENROUTER_API_KEY: 'or' })
    expect(or.model).toBe(or.models[0])
    expect(or.models.length).toBeGreaterThan(1)
    expect(or.models.every((m) => m.endsWith(':free'))).toBe(true)
  })

  it('accepts a comma-separated *_MODEL override, replacing the defaults', () => {
    const [or] = resolveChain({ OPENROUTER_API_KEY: 'or', OPENROUTER_MODEL: ' x:free , y:free ' })
    expect(or.models).toEqual(['x:free', 'y:free'])
    expect(or.model).toBe('x:free')
  })
})
