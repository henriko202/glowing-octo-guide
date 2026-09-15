// convex/lib/digestEmails.ts
// R24 — pure 3-day activity-digest builder for en / pt / es, called by the daily sweep in jobs/digest.ts. No
// I/O: every number and name is resolved by the caller. Section order follows design spec §8 — personal
// numbers, top received, top made, site tops for the stated 7-day board window, position and movement, CTAs,
// then the unsubscribe/settings/support footer. Copy is an activity summary, never a promotion: sentence
// case, precise numbers, no urgency and no exclamation marks.
import type { EmailContent } from './email'
import type { EmailLang } from './emailLayout'
import { emailButton, emailFacts, emailLabel, emailNote, emailParagraph, renderEmailLayout } from './emailLayout'
import { escapeHtml } from './html'
import { INTL_TAG } from './billingEmails'

interface DigestEntry {
  name: string
  count: number
}

export interface DigestInput {
  name: string
  since: number
  receivedReactions: number
  receivedComments: number
  madeReactions: number
  madeComments: number
  topReceived: DigestEntry[]
  topMade: DigestEntry[]
  siteTopPosters: DigestEntry[]
  siteTopInteractors: DigestEntry[]
  siteTotalInteractions: number
  siteActiveMembers: number
  myPosition: number | null
  movement: number | null
  featureNote?: string
  peopleUrl: string
  rankingsUrl: string
  unsubscribeUrl: string
  settingsUrl: string
  supportEmail: string
  includePostalAddress: boolean
}

// Spec §11 item 1 is resolved: this is the controller's fiscal postal address, published in the compliance docs,
// and jobs/digest.ts now passes includePostalAddress: true.
const POSTAL_ADDRESS = 'AV SETE DE SETEMBRO, 2775, REBOUÇAS - 80230-010 - Curitiba, Paraná - Brazil'

const TOP_LIMIT = 3

interface DigestCopy {
  subject: string
  subjectEmpty: string
  heading: string
  greeting: string
  personalLabel: string
  receivedReactions: string
  receivedComments: string
  madeReactions: string
  madeComments: string
  topReceivedLabel: string
  topMadeLabel: string
  siteLabel: string
  siteSummary: string
  topPostersLabel: string
  topInteractorsLabel: string
  position: string
  notRanked: string
  movementUp: string
  movementDown: string
  movementSame: string
  positionWords: [one: string, many: string]
  peopleCta: string
  rankingsCta: string
  unsubscribe: string
  settings: string
  support: string
  postal: string
  reactionWords: [one: string, many: string]
  commentWords: [one: string, many: string]
}

const COPY: Record<EmailLang, DigestCopy> = {
  en: {
    subject: '{reactions} {reactionWord} and {comments} {commentWord} on your posts',
    subjectEmpty: 'Activity summary',
    heading: 'Your activity digest',
    greeting: 'Hi {name},',
    personalLabel: 'Your numbers since {date}',
    receivedReactions: 'Reactions received',
    receivedComments: 'Comments received',
    madeReactions: 'Reactions made',
    madeComments: 'Comments made',
    topReceivedLabel: 'People who interacted most with your posts',
    topMadeLabel: 'People you interacted with most',
    siteLabel: 'Site highlights · last 7 days',
    siteSummary: '{total} interactions between {members} members in the last 7 days.',
    topPostersLabel: 'Top posters',
    topInteractorsLabel: 'Top interactors',
    position: 'You are #{n} in the site ranking.',
    notRanked: 'You are not ranked in the site board.',
    movementUp: 'You are up {n} {word} since your last digest.',
    movementDown: 'You are down {n} {word} since your last digest.',
    movementSame: 'You are in the same position since your last digest.',
    positionWords: ['position', 'positions'],
    peopleCta: 'See people',
    rankingsCta: 'See rankings',
    unsubscribe: 'Unsubscribe from digests',
    settings: 'Email settings',
    support: 'Write to {email}.',
    postal: 'Postal address:',
    reactionWords: ['reaction', 'reactions'],
    commentWords: ['comment', 'comments']
  },
  pt: {
    subject: '{reactions} {reactionWord} e {comments} {commentWord} nas suas publicações',
    subjectEmpty: 'Resumo de atividades',
    heading: 'Seu resumo de atividade',
    greeting: 'Olá, {name},',
    personalLabel: 'Seus números desde {date}',
    receivedReactions: 'Reações recebidas',
    receivedComments: 'Comentários recebidos',
    madeReactions: 'Reações feitas',
    madeComments: 'Comentários feitos',
    topReceivedLabel: 'Quem mais interagiu com suas publicações',
    topMadeLabel: 'Com quem você mais interagiu',
    siteLabel: 'Destaques do site · últimos 7 dias',
    siteSummary: '{total} interações entre {members} membros nos últimos 7 dias.',
    topPostersLabel: 'Mais publicações',
    topInteractorsLabel: 'Mais interações',
    position: 'Você está em #{n} no ranking do site.',
    notRanked: 'Você não está no ranking do site.',
    movementUp: 'Você subiu {n} {word} desde o seu último resumo.',
    movementDown: 'Você desceu {n} {word} desde o seu último resumo.',
    movementSame: 'Você está na mesma posição desde o seu último resumo.',
    positionWords: ['posição', 'posições'],
    peopleCta: 'Ver pessoas',
    rankingsCta: 'Ver rankings',
    unsubscribe: 'Cancelar o resumo por e-mail',
    settings: 'Configurações de e-mail',
    support: 'Escreva para {email}.',
    postal: 'Endereço postal:',
    reactionWords: ['reação', 'reações'],
    commentWords: ['comentário', 'comentários']
  },
  es: {
    subject: '{reactions} {reactionWord} y {comments} {commentWord} en tus publicaciones',
    subjectEmpty: 'Resumen de actividades',
    heading: 'Tu resumen de actividad',
    greeting: 'Hola, {name},',
    personalLabel: 'Tus números desde {date}',
    receivedReactions: 'Reacciones recibidas',
    receivedComments: 'Comentarios recibidos',
    madeReactions: 'Reacciones hechas',
    madeComments: 'Comentarios hechos',
    topReceivedLabel: 'Quienes más interactuaron con tus publicaciones',
    topMadeLabel: 'Con quienes más interactuaste',
    siteLabel: 'Destacados del sitio · últimos 7 días',
    siteSummary: '{total} interacciones entre {members} miembros en los últimos 7 días.',
    topPostersLabel: 'Más publicaciones',
    topInteractorsLabel: 'Más interacciones',
    position: 'Estás en el puesto #{n} del ranking del sitio.',
    notRanked: 'No estás en el ranking del sitio.',
    movementUp: 'Subiste {n} {word} desde tu último resumen.',
    movementDown: 'Bajaste {n} {word} desde tu último resumen.',
    movementSame: 'Estás en la misma posición desde tu último resumen.',
    positionWords: ['puesto', 'puestos'],
    peopleCta: 'Ver personas',
    rankingsCta: 'Ver rankings',
    unsubscribe: 'Cancelar el resumen por correo',
    settings: 'Configuración de correo',
    support: 'Escribe a {email}.',
    postal: 'Dirección postal:',
    reactionWords: ['reacción', 'reacciones'],
    commentWords: ['comentario', 'comentarios']
  }
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (token, key: string) => values[key] ?? token)
}

// RCD — temporary announcement line. The gate date is part of the copy contract: the job passes
// `digestFeatureNote(now, locale)`, and after this instant the builder receives undefined.
export const DIGEST_FEATURE_NOTE_UNTIL = Date.UTC(2026, 9, 28)

const FEATURE_NOTES: Record<EmailLang, string> = {
  en: 'New: see who reacted to each of your posts at linkintothessi.com/people',
  pt: 'Novo: veja quem reagiu a cada uma das suas publicações em linkintothessi.com/people',
  es: 'Nuevo: mira quién reaccionó a cada una de tus publicaciones en linkintothessi.com/people'
}

export function digestFeatureNote(now: number, locale: EmailLang): string | undefined {
  return now < DIGEST_FEATURE_NOTE_UNTIL ? FEATURE_NOTES[locale] : undefined
}

function plural(n: number, [one, many]: [string, string]): string {
  return n === 1 ? one : many
}

function movementLine(c: DigestCopy, n: number): string {
  if (n === 0) return c.movementSame
  return fill(n > 0 ? c.movementUp : c.movementDown, {
    n: String(Math.abs(n)),
    word: plural(Math.abs(n), c.positionWords)
  })
}

function formatSince(locale: EmailLang, since: number): string {
  return new Intl.DateTimeFormat(INTL_TAG[locale], { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(since))
}

export function digestEmail(locale: EmailLang, input: DigestInput): EmailContent {
  const c = COPY[locale]
  const sinceLabel = formatSince(locale, input.since)
  const hasReceivedActivity = input.receivedReactions + input.receivedComments > 0
  const subject = hasReceivedActivity
    ? fill(c.subject, {
        reactions: String(input.receivedReactions),
        reactionWord: plural(input.receivedReactions, c.reactionWords),
        comments: String(input.receivedComments),
        commentWord: plural(input.receivedComments, c.commentWords)
      })
    : c.subjectEmpty
  const position = input.myPosition === null ? c.notRanked : fill(c.position, { n: String(input.myPosition) })
  const movement = input.myPosition !== null && input.movement !== null ? movementLine(c, input.movement) : ''

  const linesHtml = (entries: DigestEntry[]) =>
    entries
      .slice(0, TOP_LIMIT)
      .map(e => `${escapeHtml(e.name)} · ${e.count}`)
      .join('<br>')
  const listHtml = (entries: DigestEntry[]) => emailParagraph(linesHtml(entries))

  const receivedBlock = input.topReceived.length
    ? emailLabel(escapeHtml(c.topReceivedLabel)) + listHtml(input.topReceived)
    : ''
  const madeBlock = input.topMade.length ? emailLabel(escapeHtml(c.topMadeLabel)) + listHtml(input.topMade) : ''
  const siteSummary =
    input.siteActiveMembers >= 3
      ? emailParagraph(
          escapeHtml(
            fill(c.siteSummary, {
              total: String(input.siteTotalInteractions),
              members: String(input.siteActiveMembers)
            })
          )
        )
      : ''
  const siteLists =
    input.siteTopPosters.length || input.siteTopInteractors.length
      ? emailLabel(escapeHtml(c.siteLabel)) +
        (input.siteTopPosters.length
          ? emailLabel(escapeHtml(c.topPostersLabel)) + listHtml(input.siteTopPosters)
          : '') +
        (input.siteTopInteractors.length
          ? emailLabel(escapeHtml(c.topInteractorsLabel)) + listHtml(input.siteTopInteractors)
          : '')
      : ''
  const siteBlock = siteSummary + siteLists
  const standing = emailParagraph(escapeHtml(position)) + (movement ? emailParagraph(escapeHtml(movement)) : '')
  const ctas =
    emailButton({ href: input.peopleUrl, label: c.peopleCta }) +
    emailButton({ href: input.rankingsUrl, label: c.rankingsCta })
  // Trusted URLs are emitted verbatim, matching emailButton's contract: entity-escaping a query string's '&'
  // would change the link.
  const footer =
    (input.featureNote ? `${escapeHtml(input.featureNote)}<br>` : '') +
    `<a href="${input.unsubscribeUrl}">${escapeHtml(c.unsubscribe)}</a> · ` +
    `<a href="${input.settingsUrl}">${escapeHtml(c.settings)}</a><br>` +
    escapeHtml(fill(c.support, { email: input.supportEmail })) +
    (input.includePostalAddress ? `<br>${escapeHtml(c.postal)} ${escapeHtml(POSTAL_ADDRESS)}` : '')

  const contentHtml =
    emailParagraph(escapeHtml(fill(c.greeting, { name: input.name }))) +
    emailLabel(escapeHtml(fill(c.personalLabel, { date: sinceLabel }))) +
    emailFacts([
      { label: c.receivedReactions, value: String(input.receivedReactions) },
      { label: c.receivedComments, value: String(input.receivedComments) },
      { label: c.madeReactions, value: String(input.madeReactions) },
      { label: c.madeComments, value: String(input.madeComments) }
    ]) +
    receivedBlock +
    madeBlock +
    siteBlock +
    standing +
    ctas +
    emailNote(footer)

  const text: string[] = [
    fill(c.greeting, { name: input.name }),
    '',
    fill(c.personalLabel, { date: sinceLabel }),
    `${c.receivedReactions}: ${input.receivedReactions}`,
    `${c.receivedComments}: ${input.receivedComments}`,
    `${c.madeReactions}: ${input.madeReactions}`,
    `${c.madeComments}: ${input.madeComments}`
  ]
  if (input.topReceived.length) {
    text.push('', c.topReceivedLabel)
    for (const e of input.topReceived.slice(0, TOP_LIMIT)) text.push(`${e.name} · ${e.count}`)
  }
  if (input.topMade.length) {
    text.push('', c.topMadeLabel)
    for (const e of input.topMade.slice(0, TOP_LIMIT)) text.push(`${e.name} · ${e.count}`)
  }
  if (input.siteActiveMembers >= 3) {
    text.push(
      '',
      fill(c.siteSummary, {
        total: String(input.siteTotalInteractions),
        members: String(input.siteActiveMembers)
      })
    )
  }
  if (input.siteTopPosters.length || input.siteTopInteractors.length) {
    text.push('', c.siteLabel)
    if (input.siteTopPosters.length) {
      text.push(c.topPostersLabel)
      for (const e of input.siteTopPosters.slice(0, TOP_LIMIT)) text.push(`${e.name} · ${e.count}`)
    }
    if (input.siteTopInteractors.length) {
      text.push(c.topInteractorsLabel)
      for (const e of input.siteTopInteractors.slice(0, TOP_LIMIT)) text.push(`${e.name} · ${e.count}`)
    }
  }
  text.push('', position)
  if (movement) text.push(movement)
  text.push('', `${c.peopleCta}: ${input.peopleUrl}`, `${c.rankingsCta}: ${input.rankingsUrl}`)
  if (input.featureNote) text.push('', input.featureNote)
  text.push('', `${c.unsubscribe}: ${input.unsubscribeUrl}`, `${c.settings}: ${input.settingsUrl}`)
  text.push(fill(c.support, { email: input.supportEmail }))
  if (input.includePostalAddress) text.push(`${c.postal} ${POSTAL_ADDRESS}`)

  return {
    subject,
    html: renderEmailLayout({ lang: locale, preheader: subject, heading: c.heading, contentHtml }),
    text: text.join('\n')
  }
}
