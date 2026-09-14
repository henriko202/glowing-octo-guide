// convex/lib/unsubscribePage.ts
// R24 — GET confirmation page for the digest unsubscribe endpoint. Mail scanners, chat unfurlers and link
// prefetchers issue GETs, so a GET must never flip the preference: it verifies the token (in http.ts) and renders
// this script-free page, and the member's confirmed POST is what performs the unsubscribe. Pure so it can be tested
// without the HTTP router, which registers routes at module scope and cannot be imported by a test.
import { escapeHtml } from './html'

export type UnsubscribeLocale = 'en' | 'pt' | 'es'

interface UnsubscribePageCopy {
  title: string
  body: string
  button: string
  note: string
  settings: string
}

const COPY: Record<UnsubscribeLocale, UnsubscribePageCopy> = {
  en: {
    title: 'Unsubscribe from the activity digest',
    body: 'Confirm that you want to stop receiving the 3-day activity digest.',
    button: 'Confirm unsubscribe',
    note: 'If you did not request this, you can ignore this page.',
    settings: 'Manage email preferences'
  },
  pt: {
    title: 'Cancelar o resumo de atividade',
    body: 'Confirme que você quer parar de receber o resumo de atividade a cada 3 dias.',
    button: 'Confirmar cancelamento',
    note: 'Se você não pediu isso, pode ignorar esta página.',
    settings: 'Gerenciar preferências de email'
  },
  es: {
    title: 'Cancelar el resumen de actividad',
    body: 'Confirma que quieres dejar de recibir el resumen de actividad cada 3 días.',
    button: 'Confirmar baja',
    note: 'Si no solicitaste esto, puedes ignorar esta página.',
    settings: 'Gestionar preferencias de correo'
  }
}

export function pickUnsubscribeLocale(acceptLanguage: string | null): UnsubscribeLocale {
  const tag = acceptLanguage?.trim().toLowerCase() ?? ''
  if (tag.startsWith('pt')) return 'pt'
  if (tag.startsWith('es')) return 'es'
  return 'en'
}

export function unsubscribePageHtml(
  locale: UnsubscribeLocale,
  { token, appUrl }: { token: string; appUrl: string }
): string {
  const c = COPY[locale]
  // The token appears exactly once, inside the form action. escapeHtml keeps a hostile value from breaking out;
  // in practice the caller only renders after verifyUnsubscribeToken accepted it.
  const action = escapeHtml(`/unsubscribe/digest?token=${token}`)
  const settingsUrl = escapeHtml(`${appUrl}/settings`)
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(c.title)}</title>
</head>
<body style="margin:0;background:#f6f7f8;color:#1a1a1a;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
<main style="max-width:32rem;margin:10vh auto;padding:2rem;background:#ffffff;border:1px solid #e5e7eb;border-radius:0.75rem">
<h1 style="margin:0 0 0.75rem;font-size:1.25rem;line-height:1.3">${escapeHtml(c.title)}</h1>
<p style="margin:0 0 1.25rem;line-height:1.5">${escapeHtml(c.body)}</p>
<form method="POST" action="${action}">
<button type="submit" style="display:inline-block;padding:0.625rem 1rem;border:0;border-radius:0.5rem;background:#1a1a1a;color:#ffffff;font-size:1rem;cursor:pointer">${escapeHtml(c.button)}</button>
</form>
<p style="margin:1.25rem 0 0;line-height:1.5;color:#6b7280;font-size:0.875rem">${escapeHtml(c.note)}</p>
<p style="margin:0.75rem 0 0"><a href="${settingsUrl}" style="color:#1a1a1a">${escapeHtml(c.settings)}</a></p>
</main>
</body>
</html>
`
}
