import { describe, expect, it } from 'vitest'
import { digestEmail, type DigestInput } from './digestEmails'
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
  myPosition: 8,
  movement: 3,
  peopleUrl: 'https://app.example/people',
  rankingsUrl: 'https://app.example/rankings',
  unsubscribeUrl: 'https://site.convex.site/unsubscribe/digest?token=t',
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
  })

  it('escapes member names in the html', () => {
    const m = digestEmail('en', { ...input, topReceived: [{ name: '<b>Eve</b> & Co', count: 4 }] })
    expect(m.html).toContain('&lt;b&gt;Eve&lt;/b&gt; &amp; Co')
    expect(m.html).not.toContain('<b>Eve</b>')
  })
})
