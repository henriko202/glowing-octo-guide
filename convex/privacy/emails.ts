// convex/privacy/emails.ts
// Pure transactional-email template builders for privacy/DSR flows. No I/O — return
// { subject, html, text } for convex/lib/email.ts:sendEmail to deliver. Keep copy plain;
// these are legal/operational notices, not marketing.
export interface EmailContent {
  subject: string
  html: string
  text: string
}

const APP = 'Link Into The SSI'

export function exportReadyEmail(): EmailContent {
  const subject = `Your ${APP} data export is ready`
  const text = `Your data export is ready. Sign in to ${APP} and open Settings → Privacy & Data to download it. The download link expires in 7 days.`
  const html = `<p>Your data export is ready.</p><p>Sign in to <strong>${APP}</strong> and open <strong>Settings → Privacy &amp; Data</strong> to download it.</p><p>The download link expires in 7 days.</p>`
  return { subject, html, text }
}

export function deletionScheduledEmail(deletionDate: string): EmailContent {
  const subject = `Your ${APP} account is scheduled for deletion`
  const text = `We received a request to delete your ${APP} account. Your data will be permanently deleted on ${deletionDate}. If this was a mistake, sign in again before then to cancel. Required billing records are retained in anonymized form as the law requires.`
  const html = `<p>We received a request to delete your <strong>${APP}</strong> account.</p><p>Your data will be permanently deleted on <strong>${deletionDate}</strong>. If this was a mistake, sign in again before then to cancel.</p><p>Required billing records are retained in anonymized form as the law requires.</p>`
  return { subject, html, text }
}

export function deletionCompletedEmail(): EmailContent {
  const subject = `Your ${APP} account has been deleted`
  const text = `Your ${APP} account and personal data have been permanently deleted. Required billing records are retained in anonymized form as the law requires. Thank you for using ${APP}.`
  const html = `<p>Your <strong>${APP}</strong> account and personal data have been permanently deleted.</p><p>Required billing records are retained in anonymized form as the law requires.</p><p>Thank you for using ${APP}.</p>`
  return { subject, html, text }
}

export function dormancyWarningEmail(deletionDate: string): EmailContent {
  const subject = `Your ${APP} account is inactive — action needed`
  const text = `Your ${APP} account has been inactive for a long time. To comply with data-minimization rules, it is scheduled for deletion on ${deletionDate}. Simply sign in before then to keep your account and cancel the deletion.`
  const html = `<p>Your <strong>${APP}</strong> account has been inactive for a long time.</p><p>To comply with data-minimization rules, it is scheduled for deletion on <strong>${deletionDate}</strong>. Simply sign in before then to keep your account and cancel the deletion.</p>`
  return { subject, html, text }
}
