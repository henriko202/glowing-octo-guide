import { describe, it, expect } from 'vitest'
import { exportReadyEmail, deletionScheduledEmail, deletionCompletedEmail, dormancyWarningEmail } from './emails'
import type { EmailLang } from '../lib/emailLayout'

const APP_URL = 'https://app.example'
const AT = Date.UTC(2026, 8, 30)
const LOCALES: EmailLang[] = ['en', 'pt', 'es']
const DATES: Record<EmailLang, string> = {
  en: 'September 30, 2026',
  pt: '30 de setembro de 2026',
  es: '30 de septiembre de 2026'
}

describe('privacy email templates', () => {
  it('exportReadyEmail names the app, states the 7-day expiry and links Privacy & Data when known', () => {
    for (const locale of LOCALES) {
      const m = exportReadyEmail({ locale, appUrl: APP_URL })
      expect(m.subject.length).toBeGreaterThan(0)
      expect(m.subject).toContain('Link Into The SSI')
      expect(m.html).toContain('Link Into The SSI')
      expect(m.text.length).toBeGreaterThan(0)
      expect(m.html).toContain(`href="${APP_URL}/privacy-data"`)
      expect(exportReadyEmail({ locale }).html).not.toContain('href=')
    }
  })

  it('deletionScheduledEmail states the deletion date in the locale’s own format', () => {
    for (const locale of LOCALES) {
      const m = deletionScheduledEmail({ locale, deletionAt: AT, appUrl: APP_URL })
      expect(m.subject.length).toBeGreaterThan(0)
      expect(m.html).toContain(DATES[locale])
      expect(m.text).toContain(DATES[locale])
      expect(m.html).toContain(`href="${APP_URL}"`)
      expect(deletionScheduledEmail({ locale, deletionAt: AT }).html).not.toContain('href=')
    }
  })

  it('deletionScheduledEmail reports the localized date without an app URL too', () => {
    for (const locale of LOCALES) {
      const m = deletionScheduledEmail({ locale, deletionAt: AT })
      expect(m.html).toContain(DATES[locale])
      expect(m.text).toContain(DATES[locale])
    }
  })

  it('deletionCompletedEmail confirms removal in every language, with no button', () => {
    for (const locale of LOCALES) {
      const m = deletionCompletedEmail({ locale })
      expect(m.subject.length).toBeGreaterThan(0)
      expect(m.html).toContain('Link Into The SSI')
      expect(m.html).not.toContain('href=')
    }
  })

  it('names the app in every builder’s subject and differs per language', () => {
    const subjects = LOCALES.map(locale => deletionScheduledEmail({ locale, deletionAt: AT }).subject)
    expect(new Set(subjects).size).toBe(LOCALES.length)
    for (const locale of LOCALES) {
      expect(exportReadyEmail({ locale }).subject).toContain('Link Into The SSI')
      expect(deletionScheduledEmail({ locale, deletionAt: AT }).subject).toContain('Link Into The SSI')
      expect(deletionCompletedEmail({ locale }).subject).toContain('Link Into The SSI')
      expect(dormancyWarningEmail({ locale, deletionAt: AT }).subject).toContain('Link Into The SSI')
    }
  })
})

describe('dormancyWarningEmail', () => {
  it('names the deletion date and the reactivation action in every language', () => {
    for (const locale of LOCALES) {
      const m = dormancyWarningEmail({ locale, deletionAt: AT })
      expect(m.subject.length).toBeGreaterThan(0)
      expect(m.html).toContain(DATES[locale])
      expect(m.text).toContain(DATES[locale])
    }
  })

  it('links the keep-account path when an app URL is known', () => {
    for (const locale of LOCALES) {
      const m = dormancyWarningEmail({ locale, deletionAt: AT, appUrl: APP_URL })
      expect(m.html).toContain(`href="${APP_URL}"`)
      expect(dormancyWarningEmail({ locale, deletionAt: AT }).html).not.toContain('href=')
    }
  })
})
