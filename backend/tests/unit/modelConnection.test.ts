import { parseModelConnection } from '../../src/services/ai/modelConnection'

describe('parseModelConnection', () => {
  it('parses a local Ollama connection string', () => {
    const result = parseModelConnection('http://localhost:11434/v1#model=gemma4:e4b')
    expect(result).toEqual({ kind: 'local', baseUrl: 'http://localhost:11434/v1', model: 'gemma4:e4b' })
  })

  it('is case-insensitive on the https prefix', () => {
    const result = parseModelConnection('HTTPS://my-server.example/v1#model=llama3')
    expect(result.kind).toBe('local')
  })

  it('works against any OpenAI-compatible host, not just Ollama', () => {
    const result = parseModelConnection('http://localhost:1234/v1#model=local-model')
    expect(result).toEqual({ kind: 'local', baseUrl: 'http://localhost:1234/v1', model: 'local-model' })
  })

  it('throws a clear error when the model fragment is missing', () => {
    expect(() => parseModelConnection('http://localhost:11434/v1')).toThrow(/model name/)
  })

  it('throws when the model fragment is present but empty', () => {
    expect(() => parseModelConnection('http://localhost:11434/v1#model=')).toThrow(/model name/)
  })

  it('rejects a cloud metadata address', () => {
    expect(() => parseModelConnection('http://169.254.169.254/v1#model=x')).toThrow(/metadata/)
  })

  it('rejects a malformed URL', () => {
    expect(() => parseModelConnection('http://')).toThrow(/Invalid URL/)
  })

  it('treats a plain string as a cloud API key', () => {
    expect(parseModelConnection('sk-ant-abc123')).toEqual({ kind: 'cloud', apiKey: 'sk-ant-abc123' })
  })

  it('trims whitespace around a cloud key', () => {
    expect(parseModelConnection('  sk-ant-abc123  ')).toEqual({ kind: 'cloud', apiKey: 'sk-ant-abc123' })
  })

  it('rejects an empty or whitespace-only value', () => {
    expect(() => parseModelConnection('')).toThrow(/empty/)
    expect(() => parseModelConnection('   ')).toThrow(/empty/)
  })
})
