import { isAllowedOrigin } from '../../src/config/corsOrigin'

const configured = ['https://jobmagnate-frontend-staging-w4642vyi6a-as.a.run.app']

describe('isAllowedOrigin', () => {
  it('allows a request with no Origin header (curl, health checks)', () => {
    expect(isAllowedOrigin(undefined, configured)).toBe(true)
  })

  it('allows an origin from the configured list', () => {
    expect(isAllowedOrigin(configured[0] as string, configured)).toBe(true)
  })

  it('rejects an origin not in the configured list', () => {
    expect(isAllowedOrigin('https://evil.example.com', configured)).toBe(false)
  })

  it('allows any chrome-extension:// origin — the Assisted Apply extension calls this API directly', () => {
    expect(isAllowedOrigin('chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef', configured)).toBe(true)
  })

  it('does not treat a lookalike http(s) origin as the extension scheme', () => {
    expect(isAllowedOrigin('https://chrome-extension.evil.example.com', configured)).toBe(false)
  })
})
