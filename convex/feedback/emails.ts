// convex/feedback/emails.ts
// Pure transactional-email builder for admin replies to user feedback. No I/O — returns
// { subject, html, text } for convex/lib/email.ts:sendEmail to deliver. User/admin text is
// HTML-escaped because it is interpolated into the HTML body.
export interface EmailContent {
  subject: string
  html: string
  text: string
}

const APP = 'Link Into The SSI'

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function feedbackReplyEmail({
  replyText,
  originalMessage
}: {
  replyText: string
  originalMessage: string
}): EmailContent {
  const subject = `Re: your ${APP} feedback`
  const text =
    `Thanks for your feedback. You wrote:\n\n"${originalMessage}"\n\n` +
    `Our response:\n\n${replyText}\n\n— The ${APP} team`
  const html =
    `<p>Thanks for your feedback. You wrote:</p>` +
    `<blockquote>${escapeHtml(originalMessage)}</blockquote>` +
    `<p>Our response:</p>` +
    `<p>${escapeHtml(replyText)}</p>` +
    `<p>— The ${APP} team</p>`
  return { subject, html, text }
}
