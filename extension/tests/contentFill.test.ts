import { describe, it, expect, afterEach } from 'vitest'
import { fillForm } from '../src/content/index'
import type { FieldMappingEntry, FillableProfileFields } from '../src/lib/fieldSchema'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('fillForm', () => {
  it('fills every mapped field it has a value for', () => {
    document.body.innerHTML = `
      <input name="first_name" type="text" />
      <input name="email" type="email" />
    `
    const profile: FillableProfileFields = { firstName: 'Priya', email: 'priya@example.com' }
    const mapping: FieldMappingEntry[] = [
      { fieldKey: 'first_name', profileKey: 'firstName' },
      { fieldKey: 'email', profileKey: 'email' },
    ]

    const result = fillForm(profile, mapping)

    expect((document.querySelector('[name="first_name"]') as HTMLInputElement).value).toBe('Priya')
    expect((document.querySelector('[name="email"]') as HTMLInputElement).value).toBe('priya@example.com')
    expect(result).toEqual({ filled: 2, mappable: 2 })
  })

  it('counts a mapped field toward "mappable" even when there is no value to fill it with', () => {
    document.body.innerHTML = `<input name="phone" type="tel" />`
    const result = fillForm({ phone: null }, [{ fieldKey: 'phone', profileKey: 'phone' }])
    expect(result).toEqual({ filled: 0, mappable: 1 })
  })

  it('never counts a screening question (profileKey: null) as mappable', () => {
    document.body.innerHTML = `<textarea name="why_us"></textarea>`
    const result = fillForm({}, [{ fieldKey: 'why_us', profileKey: null }])
    expect(result).toEqual({ filled: 0, mappable: 0 })
  })

  it('does not attempt to fill a resume/coverLetter mapping — file attachment is Phase 2', () => {
    document.body.innerHTML = `<input name="resume" type="file" />`
    const result = fillForm({}, [{ fieldKey: 'resume', profileKey: 'resume' }])
    expect(result).toEqual({ filled: 0, mappable: 0 })
    expect((document.querySelector('[name="resume"]') as HTMLInputElement).files).toHaveLength(0)
  })

  it('degrades gracefully when a mapped field no longer exists in the DOM', () => {
    document.body.innerHTML = `<input name="email" type="email" />`
    const result = fillForm(
      { firstName: 'Priya' },
      [{ fieldKey: 'first_name', profileKey: 'firstName' }] // no matching element on the page
    )
    expect(result).toEqual({ filled: 0, mappable: 1 })
  })

  it('fills a select field', () => {
    document.body.innerHTML = `<select name="country"><option value="in">India</option><option value="us">US</option></select>`
    const result = fillForm({ location: 'in' }, [{ fieldKey: 'country', profileKey: 'location' }])
    expect((document.querySelector('[name="country"]') as HTMLSelectElement).value).toBe('in')
    expect(result).toEqual({ filled: 1, mappable: 1 })
  })
})
