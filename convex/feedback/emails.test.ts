import { describe, it, expect } from 'vitest'
import { feedbackReplyEmail } from './emails'
import type { EmailLang } from '../lib/emailLayout'

const LOCALES: EmailLang[] = ['en', 'pt', 'es']

describe('feedbackReplyEmail', () => {
  it('includes the reply, quotes the original, and names the app', () => {
    const m = feedbackReplyEmail({
      locale: 'en',
      replyText: 'Thanks, fixed it!',
      originalMessage: 'The button is broken'
    })
    expect(m.subject).toMatch(/feedback/i)
    expect(m.html).toContain('Link Into The SSI')
    expect(m.html).toContain('Thanks, fixed it!')
    expect(m.html).toContain('The button is broken')
    expect(m.text).toContain('Thanks, fixed it!')
    expect(m.text).toContain('The button is broken')
  })

  it('HTML-escapes user-provided content to prevent injection', () => {
    const m = feedbackReplyEmail({ locale: 'en', replyText: '<script>x</script>', originalMessage: 'a & b <img>' })
    expect(m.html).not.toContain('<script>')
    expect(m.html).toContain('&lt;script&gt;')
    expect(m.html).toContain('a &amp; b &lt;img&gt;')
  })

  it('keeps the line breaks of a multi-line reply', () => {
    const m = feedbackReplyEmail({ locale: 'en', replyText: 'First line\nSecond line', originalMessage: 'bug' })
    expect(m.html).toContain('First line<br>Second line')
    expect(m.text).toContain('First line\nSecond line')
  })

  it('renders the localized subject, heading and labels in every language', () => {
    const COPY: Record<
      EmailLang,
      { subject: string; heading: string; wrote: string; response: string; closing: string }
    > = {
      en: {
        subject: 'Re: your Link Into The SSI feedback',
        heading: 'We replied to your feedback',
        wrote: 'You wrote:',
        response: 'Our response:',
        closing: '— The Link Into The SSI team'
      },
      pt: {
        subject: 'Re: seu feedback do Link Into The SSI',
        heading: 'Respondemos ao seu feedback',
        wrote: 'Você escreveu:',
        response: 'Nossa resposta:',
        closing: '— Equipe do Link Into The SSI'
      },
      es: {
        subject: 'Re: tus comentarios sobre Link Into The SSI',
        heading: 'Respondimos a tus comentarios',
        wrote: 'Escribiste:',
        response: 'Nuestra respuesta:',
        closing: '— El equipo de Link Into The SSI'
      }
    }
    for (const locale of LOCALES) {
      const c = COPY[locale]
      const m = feedbackReplyEmail({ locale, replyText: 'ok', originalMessage: 'hi' })
      expect(m.subject).toBe(c.subject)
      expect(m.html).toContain(c.heading)
      expect(m.html).toContain(c.wrote)
      expect(m.html).toContain(c.response)
      expect(m.html).toContain(c.closing)
      expect(m.text).toContain(c.closing)
    }
  })
})
