// convex/lib/email.ts
// Provider-agnostic transactional email. Backed by Resend. When RESEND_API_KEY or
// EMAIL_FROM is unset (local dev / tests / unconfigured prod), it no-ops so privacy
// flows never fail merely because email isn't configured — the caller decides whether
// a skipped send matters. The real upstream error is logged server-side; callers get
// a generic error.
import { scrubError } from './scrubError'
import { fetchWithTimeout } from './fetchWithTimeout'

export interface SendEmailArgs {
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string
}

export interface SendEmailResult {
  sent: boolean
  skipped?: boolean
}

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    console.warn('[email] RESEND_API_KEY/EMAIL_FROM unset — skipping send to', args.to)
    return { sent: false, skipped: true }
  }

  const res = await fetchWithTimeout('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      ...(args.replyTo ? { reply_to: args.replyTo } : {})
    })
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`[email] Resend send failed: ${res.status}`, scrubError(body))
    throw new Error('Failed to send email')
  }
  return { sent: true }
}
