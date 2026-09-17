// Canonical production origin for the landing site. Used for absolute canonical URLs,
// OpenGraph/Twitter images, hreflang alternates, the sitemap, and JSON-LD. Overridable so
// preview deployments can emit their own origin without editing code. `||` (not `??`) so an
// empty build variable falls back instead of producing `new URL('')`.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://www.linkintothessi.com').replace(
  /\/+$/,
  ''
)

export const SITE_NAME = 'Link Into The SSI'
export const CONTACT_EMAIL = 'contact@linkintothessi.com'
export const FOUNDER_LINKEDIN_URL = 'https://www.linkedin.com/in/henriko202/'
export const LOGO_PATH = '/logo.png'

// OpenGraph locale uses language_TERRITORY; hreflang keeps the bare language codes.
// `es` is neutral Latin-American Spanish (see PLATFORM.md §15), so it must not claim `es_ES`.
export const OG_LOCALE: Record<string, string> = {
  en: 'en_US',
  pt: 'pt_BR',
  es: 'es_LA'
}
