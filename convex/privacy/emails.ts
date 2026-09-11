// convex/privacy/emails.ts
// Pure transactional-email template builders for privacy/DSR flows. No I/O — return
// { subject, html, text } for convex/lib/email.ts:sendEmail to deliver. Keep copy plain;
// these are legal/operational notices, not marketing. Each builder holds one copy record per
// language (the caller resolves the locale from the member's doc), and the builders format their
// own deletion dates so no ISO string leaks into a translated sentence. HTML renders through the
// shared branded shell in convex/lib/emailLayout.ts.
import type { EmailContent } from '../lib/email'
import type { EmailLang } from '../lib/emailLayout'
import { emailButton, emailFacts, emailNote, emailParagraph, renderEmailLayout } from '../lib/emailLayout'
import { escapeHtml } from '../lib/html'

const APP = 'Link Into The SSI'

// Our locale codes are not always Intl's: pt means pt-BR here, never European Portuguese.
const INTL_TAG: Record<EmailLang, string> = { en: 'en', pt: 'pt-BR', es: 'es' }

function formatDeletionDate(locale: EmailLang, ms: number): string {
  return new Intl.DateTimeFormat(INTL_TAG[locale], { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(ms))
}

export function exportReadyEmail(args: { locale: EmailLang; appUrl?: string }): EmailContent {
  const { locale, appUrl } = args
  const copy: Record<
    EmailLang,
    { subject: string; heading: string; note: string; paragraph: string; button: string; text: string }
  > = {
    en: {
      subject: `Your ${APP} data export is ready`,
      heading: 'Your data export is ready',
      note: 'The download link expires in 7 days.',
      paragraph: `Sign in to <strong>${APP}</strong> and open <strong>Settings → Privacy &amp; Data</strong> to download it.`,
      button: 'Open Privacy & Data',
      text: `Your data export is ready. Sign in to ${APP} and open Settings → Privacy & Data to download it. The download link expires in 7 days.`
    },
    pt: {
      subject: `Sua exportação de dados do ${APP} está pronta`,
      heading: 'Sua exportação de dados está pronta',
      note: 'O link de download expira em 7 dias.',
      paragraph: `Entre no <strong>${APP}</strong> e abra <strong>Configurações → Privacidade e dados</strong> para baixá-la.`,
      button: 'Abrir Privacidade e dados',
      text: `Sua exportação de dados está pronta. Entre no ${APP} e abra Configurações → Privacidade e dados para baixá-la. O link de download expira em 7 dias.`
    },
    es: {
      subject: `Tu exportación de datos de ${APP} está lista`,
      heading: 'Tu exportación de datos está lista',
      note: 'El enlace de descarga vence en 7 días.',
      paragraph: `Inicia sesión en <strong>${APP}</strong> y abre <strong>Configuración → Privacidad y datos</strong> para descargarla.`,
      button: 'Abrir Privacidad y datos',
      text: `Tu exportación de datos está lista. Inicia sesión en ${APP} y abre Configuración → Privacidad y datos para descargarla. El enlace de descarga vence en 7 días.`
    }
  }
  const c = copy[locale]
  const content =
    emailParagraph(c.paragraph) +
    emailNote(c.note) +
    (appUrl ? emailButton({ href: `${appUrl}/privacy-data`, label: c.button }) : '')
  const html = renderEmailLayout({ lang: locale, preheader: c.note, heading: c.heading, contentHtml: content })
  return { subject: c.subject, html, text: c.text }
}

export function deletionScheduledEmail(args: { locale: EmailLang; deletionAt: number; appUrl?: string }): EmailContent {
  const { locale, deletionAt, appUrl } = args
  const date = formatDeletionDate(locale, deletionAt)
  const copy: Record<
    EmailLang,
    {
      subject: string
      heading: string
      preheader: string
      label: string
      p1: string
      p2: string
      p3: string
      button: string
      text: string
    }
  > = {
    en: {
      subject: `Your ${APP} account is scheduled for deletion`,
      heading: 'Your account is scheduled for deletion',
      preheader: 'Your data will be permanently deleted on {date}.',
      label: 'Deletion date',
      p1: `We received a request to delete your <strong>${APP}</strong> account.`,
      p2: 'Your data will be permanently deleted on <strong>{date}</strong>. If this was a mistake, sign in again before then to cancel.',
      p3: 'Required billing records are retained in anonymized form as the law requires.',
      button: 'Sign in to cancel deletion',
      text: `We received a request to delete your ${APP} account. Your data will be permanently deleted on {date}. If this was a mistake, sign in again before then to cancel. Required billing records are retained in anonymized form as the law requires.`
    },
    pt: {
      subject: `Sua conta do ${APP} está agendada para exclusão`,
      heading: 'Sua conta está agendada para exclusão',
      preheader: 'Sua conta será excluída permanentemente em {date}.',
      label: 'Data da exclusão',
      p1: `Recebemos um pedido para excluir sua conta do <strong>${APP}</strong>.`,
      p2: 'Sua conta e seus dados pessoais serão excluídos permanentemente em <strong>{date}</strong>. Se foi um engano, entre novamente antes dessa data para cancelar.',
      p3: 'Registros de cobrança exigidos por lei são mantidos de forma anonimizada, conforme a lei exige.',
      button: 'Entrar para cancelar a exclusão',
      text: `Recebemos um pedido para excluir sua conta do ${APP}. Seus dados serão excluídos permanentemente em {date}. Se foi um engano, entre novamente antes dessa data para cancelar. Registros de cobrança exigidos por lei são mantidos de forma anonimizada, conforme a lei exige.`
    },
    es: {
      subject: `Tu cuenta de ${APP} está programada para eliminación`,
      heading: 'Tu cuenta está programada para eliminación',
      preheader: 'Tu cuenta se eliminará permanentemente el {date}.',
      label: 'Fecha de eliminación',
      p1: `Recibimos una solicitud para eliminar tu cuenta de <strong>${APP}</strong>.`,
      p2: 'Tu cuenta y tus datos personales se eliminarán permanentemente el <strong>{date}</strong>. Si fue un error, vuelve a iniciar sesión antes de esa fecha para cancelar.',
      p3: 'Los registros de facturación exigidos por ley se conservan de forma anonimizada, según lo exige la ley.',
      button: 'Iniciar sesión para cancelar la eliminación',
      text: `Recibimos una solicitud para eliminar tu cuenta de ${APP}. Tus datos se eliminarán permanentemente el {date}. Si fue un error, vuelve a iniciar sesión antes de esa fecha para cancelar. Los registros de facturación exigidos por ley se conservan de forma anonimizada, según lo exige la ley.`
    }
  }
  const c = copy[locale]
  const content =
    emailFacts([{ label: c.label, value: date }]) +
    emailParagraph(c.p1) +
    emailParagraph(c.p2.replace('{date}', escapeHtml(date))) +
    emailParagraph(c.p3) +
    (appUrl ? emailButton({ href: appUrl, label: c.button }) : '')
  const html = renderEmailLayout({
    lang: locale,
    preheader: c.preheader.replace('{date}', date),
    heading: c.heading,
    contentHtml: content
  })
  return { subject: c.subject, html, text: c.text.replace('{date}', date) }
}

export function deletionCompletedEmail(args: { locale: EmailLang }): EmailContent {
  const { locale } = args
  const copy: Record<
    EmailLang,
    { subject: string; heading: string; preheader: string; p1: string; p2: string; p3: string; text: string }
  > = {
    en: {
      subject: `Your ${APP} account has been deleted`,
      heading: 'Your account has been deleted',
      preheader: 'Your account and personal data have been permanently deleted.',
      p1: `Your <strong>${APP}</strong> account and personal data have been permanently deleted.`,
      p2: 'Required billing records are retained in anonymized form as the law requires.',
      p3: `Thank you for using ${APP}.`,
      text: `Your ${APP} account and personal data have been permanently deleted. Required billing records are retained in anonymized form as the law requires. Thank you for using ${APP}.`
    },
    pt: {
      subject: `Sua conta do ${APP} foi excluída`,
      heading: 'Sua conta foi excluída',
      preheader: 'Sua conta e seus dados pessoais foram excluídos permanentemente.',
      p1: `Sua conta do <strong>${APP}</strong> e seus dados pessoais foram excluídos permanentemente.`,
      p2: 'Registros de cobrança exigidos por lei são mantidos de forma anonimizada, conforme a lei exige.',
      p3: `Obrigado por usar o ${APP}.`,
      text: `Sua conta do ${APP} e seus dados pessoais foram excluídos permanentemente. Registros de cobrança exigidos por lei são mantidos de forma anonimizada, conforme a lei exige. Obrigado por usar o ${APP}.`
    },
    es: {
      subject: `Tu cuenta de ${APP} ha sido eliminada`,
      heading: 'Tu cuenta ha sido eliminada',
      preheader: 'Tu cuenta y tus datos personales se eliminaron permanentemente.',
      p1: `Tu cuenta de <strong>${APP}</strong> y tus datos personales se eliminaron permanentemente.`,
      p2: 'Los registros de facturación exigidos por ley se conservan de forma anonimizada, según lo exige la ley.',
      p3: `Gracias por usar ${APP}.`,
      text: `Tu cuenta de ${APP} y tus datos personales se eliminaron permanentemente. Los registros de facturación exigidos por ley se conservan de forma anonimizada, según lo exige la ley. Gracias por usar ${APP}.`
    }
  }
  const c = copy[locale]
  const content = emailParagraph(c.p1) + emailParagraph(c.p2) + emailParagraph(c.p3)
  const html = renderEmailLayout({ lang: locale, preheader: c.preheader, heading: c.heading, contentHtml: content })
  return { subject: c.subject, html, text: c.text }
}

export function dormancyWarningEmail(args: { locale: EmailLang; deletionAt: number; appUrl?: string }): EmailContent {
  const { locale, deletionAt, appUrl } = args
  const date = formatDeletionDate(locale, deletionAt)
  const copy: Record<
    EmailLang,
    {
      subject: string
      heading: string
      preheader: string
      label: string
      p1: string
      p2: string
      button: string
      text: string
    }
  > = {
    en: {
      subject: `Your ${APP} account is inactive — action needed`,
      heading: 'Your account is inactive',
      preheader: 'It is scheduled for deletion on {date}.',
      label: 'Deletion date',
      p1: `Your <strong>${APP}</strong> account has been inactive for a long time.`,
      p2: 'To comply with data-minimization rules, it is scheduled for deletion on <strong>{date}</strong>. Simply sign in before then to keep your account and cancel the deletion.',
      button: 'Sign in to keep your account',
      text: `Your ${APP} account has been inactive for a long time. To comply with data-minimization rules, it is scheduled for deletion on {date}. Simply sign in before then to keep your account and cancel the deletion.`
    },
    pt: {
      subject: `Sua conta do ${APP} está inativa — ação necessária`,
      heading: 'Sua conta está inativa',
      preheader: 'Ela está agendada para exclusão em {date}.',
      label: 'Data da exclusão',
      p1: `Sua conta do <strong>${APP}</strong> está inativa há muito tempo.`,
      p2: 'Para cumprir as regras de minimização de dados, ela está agendada para exclusão em <strong>{date}</strong>. Basta entrar antes dessa data para manter sua conta e cancelar a exclusão.',
      button: 'Entrar para manter sua conta',
      text: `Sua conta do ${APP} está inativa há muito tempo. Para cumprir as regras de minimização de dados, ela está agendada para exclusão em {date}. Basta entrar antes dessa data para manter sua conta e cancelar a exclusão.`
    },
    es: {
      subject: `Tu cuenta de ${APP} está inactiva — se requiere una acción`,
      heading: 'Tu cuenta está inactiva',
      preheader: 'Está programada para eliminación el {date}.',
      label: 'Fecha de eliminación',
      p1: `Tu cuenta de <strong>${APP}</strong> lleva mucho tiempo inactiva.`,
      p2: 'Para cumplir con las reglas de minimización de datos, está programada para eliminación el <strong>{date}</strong>. Solo tienes que iniciar sesión antes de esa fecha para conservar tu cuenta y cancelar la eliminación.',
      button: 'Iniciar sesión para conservar tu cuenta',
      text: `Tu cuenta de ${APP} lleva mucho tiempo inactiva. Para cumplir con las reglas de minimización de datos, está programada para eliminación el {date}. Solo tienes que iniciar sesión antes de esa fecha para conservar tu cuenta y cancelar la eliminación.`
    }
  }
  const c = copy[locale]
  const content =
    emailFacts([{ label: c.label, value: date }]) +
    emailParagraph(c.p1) +
    emailParagraph(c.p2.replace('{date}', escapeHtml(date))) +
    (appUrl ? emailButton({ href: appUrl, label: c.button }) : '')
  const html = renderEmailLayout({
    lang: locale,
    preheader: c.preheader.replace('{date}', date),
    heading: c.heading,
    contentHtml: content
  })
  return { subject: c.subject, html, text: c.text.replace('{date}', date) }
}
