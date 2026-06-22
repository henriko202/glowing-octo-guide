import { describe, it, expect, beforeEach } from 'vitest'
import { resolveTheme, getStoredTheme, setStoredTheme, applyTheme } from './theme'

function clearCookies() {
  document.cookie.split(';').forEach(c => {
    const name = c.split('=')[0].trim()
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`
  })
}

beforeEach(() => {
  clearCookies()
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

describe('theme storage (cookie-primary, localStorage mirror)', () => {
  it('defaults to system when nothing stored', () => {
    expect(getStoredTheme()).toBe('system')
  })
  it('setStoredTheme writes both cookie and localStorage', () => {
    setStoredTheme('dark')
    expect(document.cookie).toContain('theme=dark')
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(getStoredTheme()).toBe('dark')
  })
  it('prefers the cookie over a stale localStorage value', () => {
    localStorage.setItem('theme', 'light')
    document.cookie = 'theme=dark; Path=/'
    expect(getStoredTheme()).toBe('dark')
  })
  it('ignores an invalid stored value', () => {
    document.cookie = 'theme=bogus; Path=/'
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
