import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  type ThemePref,
  type ResolvedTheme,
  getStoredTheme,
  setStoredTheme,
  resolveTheme,
  applyTheme
} from '@/lib/theme'

type ThemeContextValue = { pref: ThemePref; resolved: ResolvedTheme; setPref: (pref: ThemePref) => void }
const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(() => getStoredTheme())
  const [resolved, setResolved] = useState<ResolvedTheme>('light')

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => {
      const next = resolveTheme(pref, mq.matches)
      setResolved(next)
      applyTheme(next)
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [pref])

  const setPref = useCallback((next: ThemePref) => {
    setStoredTheme(next)
    setPrefState(next)
  }, [])

  const value = useMemo(() => ({ pref, resolved, setPref }), [pref, resolved, setPref])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
