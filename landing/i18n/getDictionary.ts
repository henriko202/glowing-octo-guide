import 'server-only'
import type { Locale } from './config'

// Per-locale dynamic import so each route ships only its own dictionary.
const dictionaries = {
  en: () => import('./dictionaries/en.json').then(m => m.default),
  pt: () => import('./dictionaries/pt.json').then(m => m.default),
  es: () => import('./dictionaries/es.json').then(m => m.default)
}

// The English dictionary is the canonical shape; pt/es must match it key-for-key.
export type Dictionary = Awaited<ReturnType<(typeof dictionaries)['en']>>

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return (dictionaries[locale] ?? dictionaries.en)()
}
