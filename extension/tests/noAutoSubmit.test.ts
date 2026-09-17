import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

/**
 * The "never submits" property must be structural, not a matter of
 * discipline — see "Guardrails, enforced in CI" in
 * docs/assisted_apply_extension_plan.md. There is no feature flag for
 * autosubmit anywhere in this codebase, because there is no code path for
 * one to enable — this test is what keeps that true.
 */
const FORBIDDEN_PATTERNS: RegExp[] = [
  /\.submit\s*\(/, // form.submit()
  /requestSubmit/, // form.requestSubmit()
  /\[type\s*=\s*['"]?submit['"]?\]/, // querying for a submit button, the usual prelude to clicking one
]

function walk(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) files.push(...walk(full))
    else if (full.endsWith('.ts')) files.push(full)
  }
  return files
}

describe('no auto-submit guardrail', () => {
  it('the extension source never triggers a form submission', () => {
    const srcDir = join(__dirname, '..', 'src')
    const violations: string[] = []

    for (const file of walk(srcDir)) {
      const content = readFileSync(file, 'utf-8')
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) violations.push(`${file} matches ${pattern}`)
      }
    }

    expect(violations).toEqual([])
  })
})
