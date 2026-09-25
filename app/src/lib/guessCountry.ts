// app/src/lib/guessCountry.ts
// The member's likely country from the browser alone: no network call, no permission prompt. The
// time zone comes first because the OS sets it from where the device is; the browser language's
// region ("es-MX" → MX) is the fallback, for engines without time-zone data (Firefox) or a zone
// with no country (UTC). App.tsx sends the result to users.fillGuessedCountry, which only fills an
// empty country and stops once the member saved their profile.
import { COUNTRY_CODES, isValidCountry } from '../../../convex/lib/profileOptions'

// Intl Locale Info: V8 has getTimeZones(), older Safari the timeZones getter. Not in TS's lib yet.
type LocaleWithZones = Intl.Locale & { getTimeZones?: () => string[]; timeZones?: string[] }

let zoneCountries: Map<string, string> | undefined

/** Time zone → country, built once from the engine's own ICU tables. */
function countryOfZone(timeZone: string): string | undefined {
  if (!zoneCountries) {
    zoneCountries = new Map()
    for (const code of COUNTRY_CODES) {
      const locale = new Intl.Locale(`und-${code}`) as LocaleWithZones
      for (const zone of locale.getTimeZones?.() ?? locale.timeZones ?? []) zoneCountries.set(zone, code)
    }
  }
  try {
    // The tables use ICU's ids, so resolve an alias first (Asia/Kolkata → Asia/Calcutta).
    return zoneCountries.get(new Intl.DateTimeFormat('en', { timeZone }).resolvedOptions().timeZone)
  } catch {
    return undefined // not a zone this engine knows
  }
}

export function guessCountry(
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  languages: readonly string[] = navigator.languages
): string | undefined {
  const fromZone = countryOfZone(timeZone)
  if (fromZone) return fromZone
  for (const tag of languages) {
    try {
      const region = new Intl.Locale(tag).region
      if (region && isValidCountry(region)) return region
    } catch {
      // a malformed language tag: try the next one
    }
  }
  return undefined
}
