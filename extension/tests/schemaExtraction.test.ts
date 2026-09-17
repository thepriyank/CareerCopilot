import { describe, it, expect, afterEach } from 'vitest'
import { extractFormFields } from '../src/lib/schemaExtraction'

function setBody(html: string): void {
  document.body.innerHTML = html
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('extractFormFields', () => {
  it('reads a label via <label for>', () => {
    setBody(`<label for="fn">First name</label><input id="fn" name="first_name" type="text" />`)
    const fields = extractFormFields()
    expect(fields).toHaveLength(1)
    expect(fields[0].schema).toEqual({ fieldKey: 'first_name', type: 'text', label: 'First name', placeholder: null })
  })

  it('reads a label that wraps the input', () => {
    setBody(`<label>Email <input name="email" type="email" /></label>`)
    const fields = extractFormFields()
    expect(fields[0].schema.label).toBe('Email')
  })

  it('falls back to aria-label when there is no <label>', () => {
    setBody(`<input name="phone" type="tel" aria-label="Phone number" />`)
    expect(extractFormFields()[0].schema.label).toBe('Phone number')
  })

  it('reads a placeholder', () => {
    setBody(`<input name="website" type="url" placeholder="https://your-site.com" />`)
    expect(extractFormFields()[0].schema.placeholder).toBe('https://your-site.com')
  })

  it('prefers name over id as the fieldKey', () => {
    setBody(`<input id="input-3" name="location" type="text" />`)
    expect(extractFormFields()[0].fieldKey).toBe('location')
  })

  it('falls back to id when there is no name', () => {
    setBody(`<input id="loc-field" type="text" />`)
    expect(extractFormFields()[0].fieldKey).toBe('loc-field')
  })

  it('skips a field with neither name nor id — nothing to report a mapping back against', () => {
    setBody(`<input type="text" placeholder="orphan" />`)
    expect(extractFormFields()).toHaveLength(0)
  })

  it('skips hidden inputs', () => {
    setBody(`<input name="csrf" type="hidden" value="abc" />`)
    expect(extractFormFields()).toHaveLength(0)
  })

  it('skips inputs hidden via CSS', () => {
    setBody(`<input name="honeypot" type="text" style="display:none" />`)
    expect(extractFormFields()).toHaveLength(0)
  })

  it('skips disabled fields', () => {
    setBody(`<input name="locked" type="text" disabled />`)
    expect(extractFormFields()).toHaveLength(0)
  })

  it('skips radio buttons entirely — a shared name would break the one-fieldKey-per-element assumption', () => {
    setBody(`
      <input name="gender" type="radio" value="m" id="g1" />
      <input name="gender" type="radio" value="f" id="g2" />
    `)
    expect(extractFormFields()).toHaveLength(0)
  })

  it('skips checkboxes', () => {
    setBody(`<input name="agree" type="checkbox" />`)
    expect(extractFormFields()).toHaveLength(0)
  })

  it('extracts a select as type "select"', () => {
    setBody(`<label for="cty">Country</label><select id="cty" name="country"><option value="IN">India</option></select>`)
    const fields = extractFormFields()
    expect(fields[0].schema.type).toBe('select')
  })

  it('extracts a textarea as type "textarea"', () => {
    setBody(`<textarea name="cover_letter"></textarea>`)
    expect(extractFormFields()[0].schema.type).toBe('textarea')
  })

  it('extracts a file input (schema only — v1 does not fill it, but the mapper still needs to see it)', () => {
    setBody(`<input name="resume" type="file" />`)
    const fields = extractFormFields()
    expect(fields).toHaveLength(1)
    expect(fields[0].schema.type).toBe('file')
  })

  it('de-dupes two elements that happen to share the same name/id', () => {
    setBody(`<input name="email" type="email" /><input name="email" type="email" />`)
    expect(extractFormFields()).toHaveLength(1)
  })

  it('pierces an open shadow root to find the real input (SmartRecruiters spl-input pattern)', () => {
    const host = document.createElement('spl-input')
    host.id = 'first-name-input'
    host.setAttribute('label', 'First name')
    document.body.appendChild(host)
    const shadow = host.attachShadow({ mode: 'open' })
    shadow.innerHTML = `<input id="first-name-input" type="text" autocomplete="given-name" />`

    const fields = extractFormFields()
    expect(fields).toHaveLength(1)
    expect(fields[0].fieldKey).toBe('first-name-input')
    expect(fields[0].schema.label).toBe('First name')
    expect(fields[0].element).toBe(shadow.querySelector('input'))
  })

  it('falls back to the shadow host id when the inner element has neither name nor id of its own', () => {
    const host = document.createElement('spl-input')
    host.id = 'email-input'
    document.body.appendChild(host)
    const shadow = host.attachShadow({ mode: 'open' })
    shadow.innerHTML = `<input type="email" />` // no id, no name — matches the real SPL markup

    const fields = extractFormFields()
    expect(fields[0].fieldKey).toBe('email-input')
  })

  it('pierces nested shadow roots (a shadow host inside another shadow host)', () => {
    const outer = document.createElement('spl-form-field')
    document.body.appendChild(outer)
    const outerShadow = outer.attachShadow({ mode: 'open' })
    const inner = document.createElement('spl-input')
    inner.id = 'city-input'
    inner.setAttribute('label', 'City')
    outerShadow.appendChild(inner)
    const innerShadow = inner.attachShadow({ mode: 'open' })
    innerShadow.innerHTML = `<input type="text" />`

    const fields = extractFormFields()
    expect(fields).toHaveLength(1)
    expect(fields[0].fieldKey).toBe('city-input')
    expect(fields[0].schema.label).toBe('City')
  })

  it('does not see inside a closed shadow root — nothing else can either', () => {
    const host = document.createElement('spl-input')
    document.body.appendChild(host)
    const shadow = host.attachShadow({ mode: 'closed' })
    shadow.innerHTML = `<input name="secret" type="text" />`

    expect(extractFormFields()).toHaveLength(0)
  })

  it('a realistic multi-field form extracts every fillable field with the right shape', () => {
    setBody(`
      <form>
        <label for="fn">First Name</label><input id="fn" name="first_name" type="text" />
        <label for="ln">Last Name</label><input id="ln" name="last_name" type="text" />
        <label for="em">Email</label><input id="em" name="email" type="email" placeholder="you@example.com" />
        <input name="resume" type="file" />
        <label>Why do you want to work here?<textarea name="why_us"></textarea></label>
      </form>
    `)
    const fields = extractFormFields()
    expect(fields.map((f) => f.fieldKey)).toEqual(['first_name', 'last_name', 'email', 'resume', 'why_us'])
  })
})
