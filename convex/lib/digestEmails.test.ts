import { describe, expect, it } from 'vitest'
import { digestEmail, digestFeatureNote, DIGEST_FEATURE_NOTE_UNTIL, type DigestInput } from './digestEmails'
import type { EmailLang } from './emailLayout'

const LOCALES: EmailLang[] = ['en', 'pt', 'es']

const input: DigestInput = {
  name: 'Ana',
  since: 1_700_000_000_000,
  receivedReactions: 3,
  receivedComments: 1,
  madeReactions: 5,
  madeComments: 2,
  topReceived: [{ name: 'Bruno', count: 4 }],
  topMade: [{ name: 'Carla', count: 6 }],
  siteTopPosters: [{ name: 'Diego', count: 9 }],
  siteTopInteractors: [{ name: 'Elis', count: 12 }],
  siteTotalInteractions: 112,
  siteActiveMembers: 14,
  myPosition: 8,
  movement: 3,
  peopleUrl: 'https://app.example/people',
  rankingsUrl: 'https://app.example/rankings',
  unsubscribeUrl: 'https://app.example/unsubscribe?token=t',
  settingsUrl: 'https://app.example/settings',
  supportEmail: 'support@example.com',
  includePostalAddress: false
}

describe('digestEmail', () => {
  it('carries the received reaction count in the subject, in every locale', () => {
    for (const l of LOCALES) {
      const subject = digestEmail(l, input).subject
      expect(subject).toContain('3')
      expect(subject).toContain('1')
    }
  })

  it('falls back to the plain summary subject when nothing was received', () => {
    const expected = { en: 'Activity summary', pt: 'Resumo de atividades', es: 'Resumen de actividades' } as const
    for (const l of LOCALES) {
      const m = digestEmail(l, { ...input, receivedReactions: 0, receivedComments: 0 })
      expect(m.subject).toBe(expected[l])
    }
  })

  it('links the unsubscribe and settings URLs in the html and text, in every locale', () => {
    for (const l of LOCALES) {
      const m = digestEmail(l, input)
      expect(m.html).toContain(input.unsubscribeUrl)
      expect(m.html).toContain(input.settingsUrl)
      expect(m.text).toContain(input.unsubscribeUrl)
      expect(m.text).toContain(input.settingsUrl)
      expect(m.text.trim().length).toBeGreaterThan(0)
    }
  })

  it('renders the two CTAs side by side inside a single table', () => {
    const m = digestEmail('en', input)
    expect(m.html).toContain('See people')
    expect(m.html).toContain('See rankings')
    expect(m.html).toMatch(
      /<table[^>]*>(?:(?!<\/table>).)*See people(?:(?!<\/table>).)*See rankings(?:(?!<\/table>).)*<\/table>/s
    )
  })

  it('stays transactional: no exclamation mark and no urgency verbs, in every locale', () => {
    for (const l of LOCALES) {
      const m = digestEmail(l, input)
      const copy = `${m.subject}\n${m.text}`.toLowerCase()
      for (const banned of ['!', 'urgent', 'hurry', 'now!']) {
        expect(copy).not.toContain(banned)
      }
    }
  })

  it('prints the personal numbers, both direction tops, the site tops and the 7-day window', () => {
    const m = digestEmail('en', input)
    expect(m.text).toContain('3')
    expect(m.text).toContain('1')
    expect(m.text).toContain('5')
    expect(m.text).toContain('2')
    expect(m.text).toContain('Bruno · 4')
    expect(m.text).toContain('Carla · 6')
    expect(m.text).toContain('Diego · 9')
    expect(m.text).toContain('Elis · 12')
    expect(m.text).toContain('last 7 days')
    expect(m.html).toContain('Bruno')
    expect(m.html).toContain(input.peopleUrl)
    expect(m.html).toContain(input.rankingsUrl)
  })

  it('omits a top section entirely when its list is empty, never printing a zero', () => {
    const m = digestEmail('en', { ...input, topReceived: [], topMade: [], siteTopPosters: [], siteTopInteractors: [] })
    for (const label of ['People who interacted most', 'People you interacted with most', 'Site highlights']) {
      expect(m.text).not.toContain(label)
      expect(m.html).not.toContain(label)
    }
    expect(m.text).not.toContain('· 0')
    expect(m.html).not.toContain('· 0')
  })

  it('maps movement to up, down and same position', () => {
    expect(digestEmail('en', { ...input, movement: 3 }).text).toContain('up 3 positions')
    expect(digestEmail('en', { ...input, movement: -2 }).text).toContain('down 2 positions')
    expect(digestEmail('en', { ...input, movement: 0 }).text).toContain('same position')
  })

  it('singularizes a one-place move in every locale', () => {
    expect(digestEmail('en', { ...input, movement: 1 }).text).toContain('up 1 position since')
    expect(digestEmail('pt', { ...input, movement: 1 }).text).toContain('subiu 1 posição desde')
    expect(digestEmail('es', { ...input, movement: 1 }).text).toContain('Subiste 1 puesto desde')
  })

  it('omits the movement line when movement is null', () => {
    const m = digestEmail('en', { ...input, movement: null })
    expect(m.text).not.toContain('positions')
    expect(m.text).not.toContain('same position')
  })

  it('prints the not-ranked line when the position is null and omits movement', () => {
    const m = digestEmail('en', { ...input, myPosition: null, movement: 3 })
    expect(m.text).not.toContain('#')
    expect(m.text.toLowerCase()).toContain('not ranked')
    expect(m.text).not.toContain('positions')
  })

  it('includes the fiscal postal address in html and text only when asked', () => {
    const address = 'AV SETE DE SETEMBRO, 2775, REBOUÇAS - 80230-010 - Curitiba, Paraná - Brazil'
    const off = digestEmail('en', input)
    expect(off.text).not.toContain('Postal address:')
    expect(off.html).not.toContain(address)
    const on = digestEmail('en', { ...input, includePostalAddress: true })
    expect(on.text).toContain(`Postal address: ${address}`)
    expect(on.html).toContain(address)
    expect(on.html).toMatch(
      new RegExp(
        `<span style="[^"]*font-size:12px;[^"]*color:#6e6757;[^"]*text-decoration:none;">Postal address: ${address}</span>`
      )
    )
  })

  it('escapes member names in the html', () => {
    const m = digestEmail('en', { ...input, topReceived: [{ name: '<b>Eve</b> & Co', count: 4 }] })
    expect(m.html).toContain('&lt;b&gt;Eve&lt;/b&gt; &amp; Co')
    expect(m.html).not.toContain('<b>Eve</b>')
  })

  it('states the site-wide totals above the site tops when at least 3 members are active', () => {
    const m = {
      en: digestEmail('en', input),
      pt: digestEmail('pt', input),
      es: digestEmail('es', input)
    }
    expect(m.en.text).toContain('112 interactions between 14 members in the last 7 days.')
    expect(m.pt.text).toContain('112 interações entre 14 membros nos últimos 7 dias.')
    expect(m.es.text).toContain('112 interacciones entre 14 miembros en los últimos 7 días.')
    // Above the site tops, not just anywhere: the sentence precedes the label in both bodies.
    for (const locale of LOCALES) {
      const text = digestEmail(locale, input).text
      expect(text.indexOf(locale === 'en' ? 'between 14 members' : 'entre 14')).toBeLessThan(
        text.indexOf(
          locale === 'en' ? 'Site highlights' : locale === 'pt' ? 'Destaques do site' : 'Destacados del sitio'
        )
      )
    }
  })

  it('suppresses the site-wide sentence below 3 active members', () => {
    for (const l of LOCALES) {
      const m = digestEmail(l, { ...input, siteActiveMembers: 2 })
      expect(m.text).not.toContain('112')
      expect(m.html).not.toContain('112')
    }
  })

  it('renders the feature note in the footer above the unsubscribe link when present', () => {
    const note = digestFeatureNote(DIGEST_FEATURE_NOTE_UNTIL - 1, 'en')!
    const m = digestEmail('en', { ...input, featureNote: note })
    expect(m.text).toContain(note)
    expect(m.html).toContain(note)
    expect(m.text.indexOf(note)).toBeLessThan(m.text.indexOf(input.unsubscribeUrl))
    expect(m.html.indexOf(note)).toBeLessThan(m.html.indexOf(input.unsubscribeUrl))
  })

  it('omits the feature note when absent', () => {
    const m = digestEmail('en', input)
    expect(m.text).not.toContain('linkintothessi.com/people')
    expect(m.html).not.toContain('linkintothessi.com/people')
  })
})

describe('digestFeatureNote', () => {
  it('returns the localized note before the gate instant and nothing at or after it', () => {
    expect(digestFeatureNote(DIGEST_FEATURE_NOTE_UNTIL - 1, 'en')).toContain('linkintothessi.com/people')
    expect(digestFeatureNote(DIGEST_FEATURE_NOTE_UNTIL - 1, 'pt')).toContain('linkintothessi.com/people')
    expect(digestFeatureNote(DIGEST_FEATURE_NOTE_UNTIL - 1, 'es')).toContain('linkintothessi.com/people')
    expect(digestFeatureNote(DIGEST_FEATURE_NOTE_UNTIL, 'en')).toBeUndefined()
    expect(digestFeatureNote(DIGEST_FEATURE_NOTE_UNTIL + 1, 'en')).toBeUndefined()
  })

  it('keeps the announcement factual: no exclamation and no CTA button copy', () => {
    for (const l of LOCALES) {
      const note = digestFeatureNote(0, l)!
      expect(note).not.toContain('!')
      expect(note.toLowerCase()).not.toContain('click here')
      expect(note.toLowerCase()).not.toContain('sign up')
    }
  })
})
