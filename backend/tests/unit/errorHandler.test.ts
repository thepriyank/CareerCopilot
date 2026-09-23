jest.mock('../../src/utils/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

import { ZodError, z } from 'zod'
import { createError, tagError, errorHandler, looksTechnical, FRIENDLY_BY_CODE } from '../../src/middleware/errorHandler'

function run(err: unknown) {
  const json = jest.fn()
  const status = jest.fn(() => ({ json }))
  errorHandler(err as never, { path: '/api/x' } as never, { status } as never, jest.fn())
  const [[statusCode]] = status.mock.calls as unknown as [[number]]
  const [[body]] = json.mock.calls as unknown as [[{ error: { code: string; message: string } }]]
  return { statusCode, ...body.error }
}

describe('errorHandler — never leaks technical detail to the client', () => {
  it('passes a curated createError message through unchanged', () => {
    expect(run(createError(400, 'NO_MASTER_RESUME', 'Generate a master resume first'))).toEqual({
      statusCode: 400, code: 'NO_MASTER_RESUME', message: 'Generate a master resume first',
    })
  })

  it('replaces the AI chain failure with friendly copy (the 2026-09-23 LinkedIn leak)', () => {
    const err = tagError(
      new Error('Every LLM provider in the chain failed for this call. Last attempt "openrouter": 404 This model is unavailable for free.'),
      503,
      'AI_UNAVAILABLE'
    )
    const out = run(err)
    expect(out).toEqual({ statusCode: 503, code: 'AI_UNAVAILABLE', message: FRIENDLY_BY_CODE.AI_UNAVAILABLE })
    expect(out.message).not.toMatch(/openrouter|LLM|404/i)
  })

  it('hides raw messages of plain 500s', () => {
    const out = run(new Error('relation "users" does not exist'))
    expect(out.statusCode).toBe(500)
    expect(out.code).toBe('INTERNAL_ERROR')
    expect(out.message).not.toMatch(/relation|users/)
  })

  it('withholds a curated message that nevertheless looks technical', () => {
    const out = run(createError(503, 'NOT_CONFIGURED', 'RAZORPAY_WEBHOOK_SECRET is not set'))
    expect(out.message).not.toMatch(/RAZORPAY|SECRET/)
  })

  it("does not trust a library error's own message or code (body-parser / http-errors)", () => {
    const libErr = Object.assign(new Error('Unexpected token } in JSON at position 12'), {
      statusCode: 400, status: 400, expose: true, type: 'entity.parse.failed', code: 'ESOMETHING',
    })
    const out = run(libErr)
    expect(out.statusCode).toBe(400)
    expect(out.code).toBe('REQUEST_ERROR')
    expect(out.message).not.toMatch(/Unexpected token|JSON/)
  })

  it("ignores an SDK error's upstream .status (a provider 401 is not the user's session)", () => {
    const sdkErr = Object.assign(new Error('401 invalid x-api-key'), { status: 401 })
    const out = run(sdkErr)
    expect(out.statusCode).toBe(500)
    expect(out.message).not.toMatch(/x-api-key|401/)
  })

  it('returns friendly copy and no schema details for Zod validation errors', () => {
    let zerr: ZodError | undefined
    try { z.object({ raw: z.string() }).parse({}) } catch (e) { zerr = e as ZodError }
    const out = run(zerr)
    expect(out).toEqual({ statusCode: 400, code: 'VALIDATION_ERROR', message: expect.any(String) })
    expect(out).not.toHaveProperty('details')
  })
})

describe('looksTechnical()', () => {
  it.each([
    '402 status code (no body)',
    'connect ECONNREFUSED 10.0.0.4:5432',
    'No response text from ollama model "gpt-oss:20b"',
    'SETTINGS_ENCRYPTION_KEY is missing',
    "Cannot read properties of undefined (reading 'id')",
    'see https://internal.example/debug',
  ])('flags %p', (m) => expect(looksTechnical(m)).toBe(true))

  it.each([
    'Generate a master resume first',
    "You've used all 5 autofills for this period",
    "This isn't available on the free tier. Add your own API key in Settings, or upgrade to unlock it.",
    'Add the model name to the end of the address, like #model=gemma4:e4b',
  ])('allows %p', (m) => expect(looksTechnical(m)).toBe(false))
})
