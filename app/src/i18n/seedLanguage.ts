/**
 * Decide which UI language to seed from a scraped LinkedIn primaryLocale.
 * Returns null when the user already chose a language (stored pref) or when the
 * locale is missing/unsupported — so the existing language switcher always wins.
 */
export function pickSeedLanguage(
  primaryLocale: string | undefined,
  supported: readonly string[],
  hasStoredPref: boolean
): string | null {
  if (hasStoredPref) return null
  if (!primaryLocale) return null
  const lang = primaryLocale.split(/[-_]/)[0].toLowerCase()
  return supported.includes(lang) ? lang : null
}
