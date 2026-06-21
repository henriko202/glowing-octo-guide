import { beforeEach } from 'vitest'
import { resolveTheme, getStoredTheme, setStoredTheme, applyTheme } from './theme'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.className = ''
  document.documentElement.style.colorScheme = ''
})

describe('resolveTheme', () => {
  it('returns the explicit preference unchanged', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
  it('resolves "system" from prefersDark', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})

describe('stored theme', () => {
  it('defaults to "system" when nothing stored', () => {
    expect(getStoredTheme()).toBe('system')
  })
  it('round-trips a stored preference', () => {
    setStoredTheme('dark')
    expect(getStoredTheme()).toBe('dark')
  })
  it('ignores a junk stored value', () => {
    localStorage.setItem('theme', 'banana')
    expect(getStoredTheme()).toBe('system')
  })
})

describe('applyTheme', () => {
  it('adds the dark class and sets color-scheme for dark', () => {
    applyTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })
  it('removes the dark class for light', () => {
    document.documentElement.classList.add('dark')
    applyTheme('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('light')
  })
})
