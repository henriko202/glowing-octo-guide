// convex/lib/emailLayout.ts
// The shared branded shell for every transactional email: a table-based, inline-styled document
// that renders in every major client. The single <style> block covers only the mobile media query
// and the global link color — no flexbox/grid, no CSS variables, no canvas, no web fonts.
import { escapeHtml } from './html'
import { SUPPORT_EMAIL } from './support'

export type EmailLang = 'en' | 'pt' | 'es'

export interface FactRow {
  label: string
  value: string
}

export interface EmailLayoutArgs {
  lang: EmailLang
  preheader: string
  heading: string
  contentHtml: string
}

const PAGE = '#f2eee6'
const CARD = '#ffffff'
const INK = '#1c1813'
const MUTED = '#6e6757'
const BORDER = '#e4dccd'
const GOLD = '#c9963e'
const GOLD_TEXT = '#8a6418'
const WASH = '#faf7f0'
const DARK = '#0e1320'

const BODY_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const DISPLAY_FONT = "Georgia, 'Times New Roman', serif"

// Four invisible entities keep a client from pulling body copy into the preheader preview.
const PREHEADER_PAD = '&#8203;&#847;&zwnj;&nbsp;'.repeat(4)

const FOOTER: Record<EmailLang, [intro: string, support: string]> = {
  en: [
    'You are receiving this email because you have an account on Link Into The SSI.',
    `Questions? Write to ${SUPPORT_EMAIL}.`
  ],
  pt: [
    'Você está recebendo este e-mail porque tem uma conta no Link Into The SSI.',
    `Dúvidas? Escreva para ${SUPPORT_EMAIL}.`
  ],
  es: ['Recibes este correo porque tienes una cuenta en Link Into The SSI.', `¿Preguntas? Escribe a ${SUPPORT_EMAIL}.`]
}

// The header logo is decorative — the wordmark beside it already names the brand — so its alt is
// deliberately empty to spare screen readers a duplicate announcement.
export function renderEmailLayout({ lang, preheader, heading, contentHtml }: EmailLayoutArgs): string {
  const [footerIntro, footerSupport] = FOOTER[lang]
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(heading)}</title>
<style>
a { color: ${GOLD_TEXT}; }
@media only screen and (max-width: 620px) {
  .email-card-pad { padding-left: 24px !important; padding-right: 24px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background-color:${PAGE};">
<div style="display:none;font-size:1px;color:${PAGE};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}${PREHEADER_PAD}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE};">
<tr>
<td align="center" style="padding:32px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr>
<td class="email-card-pad" style="background-color:${DARK};border-radius:14px 14px 0 0;padding:22px 40px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="vertical-align:middle;"><img src="https://www.linkintothessi.com/logo.png" width="40" height="40" alt="" border="0" style="display:block;width:40px;height:40px;border-radius:10px;"></td>
<td style="vertical-align:middle;padding-left:12px;font-family:${DISPLAY_FONT};font-size:17px;font-weight:600;color:${PAGE};" translate="no">Link Into The SSI</td>
</tr>
</table>
</td>
</tr>
<tr>
<td class="email-card-pad" style="background-color:${CARD};border:1px solid ${BORDER};border-top:0;border-radius:0 0 14px 14px;padding:34px 40px 38px;">
<div style="width:36px;height:3px;background-color:${GOLD};border-radius:2px;margin:0 0 20px;"></div>
<h1 style="margin:0 0 18px;font-family:${DISPLAY_FONT};font-size:24px;line-height:1.3;font-weight:600;color:${INK};">${escapeHtml(heading)}</h1>
${contentHtml}
</td>
</tr>
<tr>
<td style="padding:18px 8px 0;font-family:${BODY_FONT};font-size:12px;line-height:1.6;color:${MUTED};">
<p style="margin:0 0 6px;">${footerIntro}</p>
<p style="margin:0;">${footerSupport}</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`
}

export function emailParagraph(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${BODY_FONT};font-size:16px;line-height:1.65;color:${INK};">${html}</p>`
}

export function emailLabel(html: string): string {
  return `<p style="margin:0 0 8px;font-family:${BODY_FONT};font-size:13px;font-weight:600;color:${MUTED};">${html}</p>`
}

export function emailQuote(text: string): string {
  return `<blockquote style="margin:0 0 18px;padding:2px 0 2px 16px;border-left:3px solid ${GOLD};font-family:${BODY_FONT};font-size:15px;line-height:1.6;color:${MUTED};"><p style="margin:0;">${escapeHtml(text)}</p></blockquote>`
}

export function emailFacts(rows: FactRow[]): string {
  if (rows.length === 0) return ''
  const separator = `<tr><td colspan="2" height="1" style="border-top:1px solid ${BORDER};font-size:1px;line-height:1px;">&nbsp;</td></tr>`
  const cells = rows
    .map(
      row =>
        `<tr><td style="padding:11px 0 10px;font-size:13px;color:${MUTED};">${escapeHtml(row.label)}</td>` +
        `<td align="right" style="padding:11px 0 10px;font-size:15px;font-weight:600;color:${INK};">${escapeHtml(row.value)}</td></tr>`
    )
    .join(separator)
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;border-spacing:0;background-color:${WASH};border:1px solid ${BORDER};border-radius:12px;margin:0 0 20px;"><tr><td style="padding:4px 20px;font-family:${BODY_FONT};"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${cells}</table></td></tr></table>`
}

export function emailNote(html: string): string {
  return `<p style="margin:20px 0 16px;padding:12px 16px;background-color:${WASH};border:1px solid ${BORDER};border-radius:10px;font-family:${BODY_FONT};font-size:15px;line-height:1.6;color:${INK};">${html}</p>`
}

export function emailFinePrint(html: string): string {
  return `<br><span style="display:inline-block;margin-top:6px;font-family:${BODY_FONT};font-size:12px;line-height:1.5;color:${MUTED};text-decoration:none;">${html}</span>`
}

// href is emitted verbatim: callers pass trusted URLs whose query strings contain '&', and
// entity-escaping them here would alter the URL the builder promised to link.
export function emailButton({ href, label }: { href: string; label: string }): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 0;"><tr><td align="center" bgcolor="${GOLD}" style="background-color:${GOLD};border-radius:10px;"><a href="${href}" style="display:inline-block;padding:15px 24px;font-family:${BODY_FONT};font-size:15px;font-weight:600;line-height:1;color:${INK};text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a></td></tr></table>`
}

// Side-by-side buttons: one flat table, one row, one cell per button, so two CTAs sit next to each
// other instead of stacking. Cells separate with right padding; anchors carry the button look.
export function emailButtonRow(buttons: Array<{ href: string; label: string }>): string {
  const cells = buttons
    .map(
      (button, index) =>
        `<td style="${index < buttons.length - 1 ? 'padding-right:8px;' : ''}"><a href="${button.href}" style="display:inline-block;padding:15px 24px;background-color:${GOLD};border-radius:10px;font-family:${BODY_FONT};font-size:15px;font-weight:600;line-height:1;color:${INK};text-decoration:none;">${escapeHtml(button.label)}</a></td>`
    )
    .join('')
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 0;"><tr>${cells}</tr></table>`
}
