import { describe, it, expect, vi, afterEach } from 'vitest'
import { setNativeValue, setSelectValue, highlightField } from '../src/lib/domFill'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('setNativeValue', () => {
  it('sets the value and dispatches input + change events', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)

    const inputHandler = vi.fn()
    const changeHandler = vi.fn()
    input.addEventListener('input', inputHandler)
    input.addEventListener('change', changeHandler)

    setNativeValue(input, 'Priya Sharma')

    expect(input.value).toBe('Priya Sharma')
    expect(inputHandler).toHaveBeenCalledTimes(1)
    expect(changeHandler).toHaveBeenCalledTimes(1)
  })

  it('works on a textarea too', () => {
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    setNativeValue(textarea, 'A cover letter.')
    expect(textarea.value).toBe('A cover letter.')
  })
})

describe('setSelectValue', () => {
  function buildSelect(): HTMLSelectElement {
    const select = document.createElement('select')
    select.innerHTML = `
      <option value="in">India</option>
      <option value="us">United States</option>
    `
    document.body.appendChild(select)
    return select
  }

  it('matches by exact option value', () => {
    const select = buildSelect()
    expect(setSelectValue(select, 'us')).toBe(true)
    expect(select.value).toBe('us')
  })

  it('falls back to a case-insensitive label match', () => {
    const select = buildSelect()
    expect(setSelectValue(select, 'india')).toBe(true)
    expect(select.value).toBe('in')
  })

  it('returns false and leaves the value unchanged when nothing matches', () => {
    const select = buildSelect()
    const before = select.value
    expect(setSelectValue(select, 'Germany')).toBe(false)
    expect(select.value).toBe(before)
  })

  it('dispatches a change event on a successful match', () => {
    const select = buildSelect()
    const changeHandler = vi.fn()
    select.addEventListener('change', changeHandler)
    setSelectValue(select, 'us')
    expect(changeHandler).toHaveBeenCalledTimes(1)
  })
})

describe('highlightField', () => {
  it('sets an outline and reverts it after the duration', () => {
    vi.useFakeTimers()
    const el = document.createElement('input')
    el.style.outline = 'none'
    document.body.appendChild(el)

    highlightField(el, 1000)
    expect(el.style.outline).toContain('22c55e')

    vi.advanceTimersByTime(1000)
    expect(el.style.outline).toBe('none')

    vi.useRealTimers()
  })
})
