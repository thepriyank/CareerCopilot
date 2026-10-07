import { describe, it, expect, afterEach, vi } from 'vitest'

const attachFileSpy = vi.fn()
vi.mock('../src/lib/domFill', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/domFill')>()
  return { ...actual, attachFile: (...args: unknown[]) => attachFileSpy(...args) }
})

import { fillForm } from '../src/content/index'
import type { FieldMappingEntry, FillableProfileFields } from '../src/lib/fieldSchema'

afterEach(() => {
  document.body.innerHTML = ''
  attachFileSpy.mockReset()
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
    expect(result).toEqual({ filled: 2, mappable: 2, attached: [] })
  })

  it('counts a mapped field toward "mappable" even when there is no value to fill it with', () => {
    document.body.innerHTML = `<input name="phone" type="tel" />`
    const result = fillForm({ phone: null }, [{ fieldKey: 'phone', profileKey: 'phone' }])
    expect(result).toEqual({ filled: 0, mappable: 1, attached: [] })
  })

  it('never counts a screening question (profileKey: null) as mappable', () => {
    document.body.innerHTML = `<textarea name="why_us"></textarea>`
    const result = fillForm({}, [{ fieldKey: 'why_us', profileKey: null }])
    expect(result).toEqual({ filled: 0, mappable: 0, attached: [] })
  })

  it('leaves a résumé file field empty (but mappable) when there is nothing to attach', () => {
    document.body.innerHTML = `<input name="resume" type="file" />`
    const result = fillForm({}, [{ fieldKey: 'resume', profileKey: 'resume' }])
    expect(result).toEqual({ filled: 0, mappable: 1, attached: [] })
    expect(attachFileSpy).not.toHaveBeenCalled()
  })

  it('attaches the résumé to a file input as a real File (NM-4)', () => {
    document.body.innerHTML = `<input name="resume" type="file" />`
    const base64 = btoa('%PDF-1.4 hello')
    const result = fillForm({}, [{ fieldKey: 'resume', profileKey: 'resume' }], {
      resume: { base64, filename: 'Priya_Sharma_Resume.pdf', mimeType: 'application/pdf' },
    })

    expect(result).toEqual({ filled: 1, mappable: 1, attached: ['resume'] })
    const [el, file] = attachFileSpy.mock.calls[0] as [HTMLInputElement, File]
    expect(el.name).toBe('resume')
    expect(file.name).toBe('Priya_Sharma_Resume.pdf')
    expect(file.type).toBe('application/pdf')
    expect(file.size).toBe('%PDF-1.4 hello'.length)
  })

  it('attaches the cover letter PDF to a cover-letter file input', () => {
    document.body.innerHTML = `<input name="cover" type="file" />`
    const result = fillForm({}, [{ fieldKey: 'cover', profileKey: 'coverLetter' }], {
      coverLetterFile: { base64: btoa('pdf'), filename: 'Priya_Sharma_Cover_Letter.pdf', mimeType: 'application/pdf' },
    })
    expect(result).toEqual({ filled: 1, mappable: 1, attached: ['coverLetter'] })
    expect((attachFileSpy.mock.calls[0][1] as File).name).toBe('Priya_Sharma_Cover_Letter.pdf')
  })

  it('pastes the cover letter text into a textarea, React-safely', () => {
    document.body.innerHTML = `<textarea name="cover_letter"></textarea>`
    const el = document.querySelector('[name="cover_letter"]') as HTMLTextAreaElement
    const onInput = vi.fn()
    el.addEventListener('input', onInput)

    const result = fillForm({}, [{ fieldKey: 'cover_letter', profileKey: 'coverLetter' }], {
      coverLetterText: 'Dear team,\n\nHello.',
    })

    expect(el.value).toBe('Dear team,\n\nHello.')
    expect(onInput).toHaveBeenCalled() // React picks up the change from the bubbling input event
    expect(result).toEqual({ filled: 1, mappable: 1, attached: ['coverLetter'] })
    expect(attachFileSpy).not.toHaveBeenCalled()
  })

  it('never pastes text into a résumé field, and never attaches a résumé to a cover-letter field', () => {
    document.body.innerHTML = `<textarea name="resume_text"></textarea><input name="cover" type="file" />`
    const result = fillForm(
      {},
      [
        { fieldKey: 'resume_text', profileKey: 'resume' },
        { fieldKey: 'cover', profileKey: 'coverLetter' },
      ],
      { resume: { base64: btoa('pdf'), filename: 'R.pdf', mimeType: 'application/pdf' }, coverLetterText: 'text only' }
    )
    expect(result).toEqual({ filled: 0, mappable: 2, attached: [] })
    expect((document.querySelector('[name="resume_text"]') as HTMLTextAreaElement).value).toBe('')
    expect(attachFileSpy).not.toHaveBeenCalled()
  })

  it('degrades gracefully when a mapped field no longer exists in the DOM', () => {
    document.body.innerHTML = `<input name="email" type="email" />`
    const result = fillForm(
      { firstName: 'Priya' },
      [{ fieldKey: 'first_name', profileKey: 'firstName' }] // no matching element on the page
    )
    expect(result).toEqual({ filled: 0, mappable: 1, attached: [] })
  })

  it('fills a select field', () => {
    document.body.innerHTML = `<select name="country"><option value="in">India</option><option value="us">US</option></select>`
    const result = fillForm({ location: 'in' }, [{ fieldKey: 'country', profileKey: 'location' }])
    expect((document.querySelector('[name="country"]') as HTMLSelectElement).value).toBe('in')
    expect(result).toEqual({ filled: 1, mappable: 1, attached: [] })
  })
})
