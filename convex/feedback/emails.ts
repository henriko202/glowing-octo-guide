// convex/feedback/emails.ts
// Pure transactional-email builder for admin replies to user feedback. No I/O — returns
// { subject, html, text } for convex/lib/email.ts:sendEmail to deliver. One copy record per
// language (the caller resolves the locale from the submitter's doc). User/admin text is
// HTML-escaped because it is interpolated into the HTML body, rendered through the shared
// branded shell in convex/lib/emailLayout.ts.
import type { EmailContent } from '../lib/email'
import type { EmailLang } from '../lib/emailLayout'
import { emailLabel, emailParagraph, emailQuote, renderEmailLayout } from '../lib/emailLayout'
import { escapeHtml } from '../lib/html'

const APP = 'Link Into The SSI'

export function feedbackReplyEmail({
  locale,
  replyText,
  originalMessage
}: {
  locale: EmailLang
  replyText: string
  originalMessage: string
}): EmailContent {
  const copy: Record<
    EmailLang,
    { subject: string; heading: string; thanks: string; wrote: string; response: string; closing: string }
  > = {
    en: {
      subject: `Re: your ${APP} feedback`,
      heading: 'We replied to your feedback',
      thanks: 'Thanks for your feedback.',
      wrote: 'You wrote:',
      response: 'Our response:',
      closing: `— The ${APP} team`
    },
    pt: {
      subject: `Re: seu feedback do ${APP}`,
      heading: 'Respondemos ao seu feedback',
      thanks: 'Obrigado pelo seu feedback.',
      wrote: 'Você escreveu:',
      response: 'Nossa resposta:',
      closing: `— Equipe do ${APP}`
    },
    es: {
      subject: `Re: tus comentarios sobre ${APP}`,
      heading: 'Respondimos a tus comentarios',
      thanks: 'Gracias por tus comentarios.',
      wrote: 'Escribiste:',
      response: 'Nuestra respuesta:',
      closing: `— El equipo de ${APP}`
    }
  }
  const c = copy[locale]
  const text = `${c.thanks} ${c.wrote}\n\n"${originalMessage}"\n\n${c.response}\n\n${replyText}\n\n${c.closing}`
  const preheader = replyText
    .replace(/\s*[\r\n]+\s*/g, ' ')
    .trim()
    .slice(0, 140)
  const content =
    emailLabel(c.wrote) +
    emailQuote(originalMessage) +
    emailLabel(c.response) +
    emailParagraph(escapeHtml(replyText).replace(/\n/g, '<br>')) +
    emailParagraph(c.closing)
  const html = renderEmailLayout({ lang: locale, preheader, heading: c.heading, contentHtml: content })
  return { subject: c.subject, html, text }
}
