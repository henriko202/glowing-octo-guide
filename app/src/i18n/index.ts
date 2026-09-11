import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en.json'
import pt from './locales/pt.json'
import es from './locales/es.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      pt: { translation: pt },
      es: { translation: es }
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'pt', 'es'],
    detection: {
      // 'cookie' first so the shared cross-site `lang` cookie (written by the landing's
      // LanguageSelector and by the app itself) wins. localStorage stays as a fast local mirror.
      order: ['cookie', 'localStorage', 'querystring', 'navigator'],
      lookupCookie: 'lang',
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'i18nextLng',
      caches: ['cookie', 'localStorage'],
      cookieMinutes: 525600, // ~1 year
      cookieDomain: (import.meta.env.VITE_COOKIE_DOMAIN as string | undefined) || undefined,
      cookieOptions: { path: '/', sameSite: 'lax', secure: window.location.protocol === 'https:' }
    },
    interpolation: {
      escapeValue: false
    }
  })

export default i18n
