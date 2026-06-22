// landing/lib/theme.ts
import { getCookie, setCookie } from './cookies'

export type ThemePref = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const THEME_COLORS: Record<ResolvedTheme, string> = { light: '#f2eee6', dark: '#0e1320' }

export function getStoredTheme(): ThemePref {
  // Cookie is the cross-site source of truth; the localStorage mirror survives a cookie clear on this origin.
  const v = getCookie(STORAGE_KEY) ?? (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

export function setStoredTheme(pref: ThemePref): void {
  setCookie(STORAGE_KEY, pref)
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, pref)
}

export function resolveTheme(pref: ThemePref, prefersDark: boolean): ResolvedTheme {
  if (pref === 'system') return prefersDark ? 'dark' : 'light'
  return pref
}

export function applyTheme(resolved: ResolvedTheme): void {
  const el = document.documentElement
  el.classList.toggle('dark', resolved === 'dark')
  el.style.colorScheme = resolved
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved])
}
