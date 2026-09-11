import { useEffect } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../convex'
import i18n from '../i18n'

const SUPPORTED = ['en', 'pt', 'es'] as const
export type UiLanguage = (typeof SUPPORTED)[number]

function currentUiLanguage(): UiLanguage {
  const short = (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0]?.toLowerCase()
  return (SUPPORTED as readonly string[]).includes(short ?? '') ? (short as UiLanguage) : 'en'
}

/**
 * Keeps users.language in step with the UI language so transactional email matches the interface.
 * Two effects on purpose: the first catches a language chosen on the landing site (or any drift) as
 * soon as the session loads, the second catches every in-app switch by listening to i18next. The
 * mutation is a no-op when nothing changed, and a failed sync is not worth interrupting the UI:
 * the cookie still drives the current session, and the next change retries.
 */
export function useLanguageSync(me: { language?: string } | null | undefined, sessionToken: string | undefined): void {
  const setLanguage = useMutation(api.users.setLanguage)
  const stored = me?.language?.split('-')[0]?.toLowerCase()

  useEffect(() => {
    if (!me || !sessionToken) return
    const current = currentUiLanguage()
    if (current !== stored) void setLanguage({ sessionToken, language: current }).catch(() => {})
  }, [me, sessionToken, stored, setLanguage])

  useEffect(() => {
    if (!sessionToken) return
    const onChange = (): void => {
      const current = currentUiLanguage()
      if (current !== stored) void setLanguage({ sessionToken, language: current }).catch(() => {})
    }
    i18n.on('languageChanged', onChange)
    return () => {
      i18n.off('languageChanged', onChange)
    }
  }, [sessionToken, stored, setLanguage])
}
