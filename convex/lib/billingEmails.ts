// convex/lib/billingEmails.ts
// Pure transactional-email builders for billing notices, mirroring convex/privacy/emails.ts.
// No I/O — each returns { subject, html, text } for convex/lib/email.ts:sendEmail to deliver.
//
// These are contract notices (card-network trial rules require a pre-charge reminder stating the
// amount, the date and how to cancel), never marketing: no promotional copy, no countdown, no
// urgency. Each one leads with what the member DID, then the term, then one link to cancel.
// HTML renders through the shared branded shell in convex/lib/emailLayout.ts.
import type { BillingLocale } from './checkoutCopy'
import type { CapNoticeMode } from './postCapNotice'
import { escapeHtml } from './html'
import type { EmailContent } from './email'
import { emailButton, emailFacts, emailNote, emailParagraph, emailQuote, renderEmailLayout } from './emailLayout'
import { TRIAL_INTERACTION_THRESHOLD } from './trialMilestone'

const APP = 'Link Into The SSI'

// Our locale codes are not always Intl's: pt means pt-BR here, never European Portuguese.
export const INTL_TAG: Record<BillingLocale, string> = { en: 'en', pt: 'pt-BR', es: 'es' }

// Display names for the tier ids, in the member's own language — a raw tier id ('contact') must
// never reach a member, and neither must an English name inside a Portuguese email. Mirrors
// `billing.plans.*.name` in app/src/i18n/locales; only the enterprise tier differs by locale.
const PLAN_NAMES: Record<BillingLocale, Record<string, string>> = {
  en: { starter: 'Starter', growth: 'Growth', pro: 'Pro', contact: 'Enterprise' },
  pt: { starter: 'Starter', growth: 'Growth', pro: 'Pro', contact: 'Empresa' },
  es: { starter: 'Starter', growth: 'Growth', pro: 'Pro', contact: 'Empresa' }
}

/** The localized plan name for a tier id, falling back to Growth for an unknown tier. */
export function planName(locale: BillingLocale, tier: string): string {
  return PLAN_NAMES[locale][tier] ?? PLAN_NAMES[locale].growth
}

const PERIOD: Record<BillingLocale, Record<string, string>> = {
  en: { month: 'month', year: 'year' },
  pt: { month: 'mês', year: 'ano' },
  es: { month: 'mes', year: 'año' }
}

/** Stripe sends minor units + an ISO currency; render it once, exactly, never rounded. */
export function formatPriceLabel(
  locale: BillingLocale,
  price: { amount?: number; currency?: string; interval?: string }
): string {
  if (typeof price.amount !== 'number' || !price.currency) return ''
  const currency = price.currency.toUpperCase()
  const digits = price.amount % 100 === 0 ? 0 : 2
  const value = price.amount / 100
  const amount =
    currency === 'USD' && locale !== 'en'
      ? `U$${new Intl.NumberFormat(INTL_TAG[locale], {
          minimumFractionDigits: digits,
          maximumFractionDigits: 2
        }).format(value)}`
      : new Intl.NumberFormat(INTL_TAG[locale], {
          style: 'currency',
          currency,
          minimumFractionDigits: digits
        }).format(value)
  const unit = price.interval ? PERIOD[locale][price.interval] : undefined
  return unit ? `${amount} / ${unit}` : amount
}

/**
 * The plan name with its price label in parentheses, or just the plan name when there is no price
 * snapshot to show (rows created before Stripe sent one, or by dev tooling): never "Pro ()".
 */
export function planWithPrice(planName: string, priceLabel: string): string {
  return priceLabel.trim() ? `${planName} (${priceLabel})` : planName
}

interface NearEndArgs {
  made: number
  received: number
  remaining: number
  planName: string
  priceLabel: string
  billingUrl: string
  peopleMade?: number
  peopleReceived?: number
  receivedReactions?: number
  receivedComments?: number
  position?: number | null
  gapToNext?: number | null
}

interface GraphCopy {
  madeWith: string
  reactions: string
  comments: string
  position: string
  gap: string
  conjunction: string
  interactionWords: [one: string, many: string]
  peopleWords: [one: string, many: string]
  reactionWords: [one: string, many: string]
  commentWords: [one: string, many: string]
}

const NEAR_END_GRAPH: Record<BillingLocale, GraphCopy> = {
  en: {
    madeWith: '{n} {word} with {people} {peopleWord}',
    reactions: '{n} {word} on your posts',
    comments: '{n} {word} on your posts',
    position: 'You are #{n} on the weekly board.',
    gap: '{n} {word} from #{position}.',
    conjunction: ' and ',
    interactionWords: ['interaction', 'interactions'],
    peopleWords: ['person', 'people'],
    reactionWords: ['reaction', 'reactions'],
    commentWords: ['comment', 'comments']
  },
  pt: {
    madeWith: '{n} {word} com {people} {peopleWord}',
    reactions: '{n} {word} nas suas publicações',
    comments: '{n} {word} nas suas publicações',
    position: 'Você está em #{n} no ranking semanal.',
    gap: 'A {n} {word} do #{position}.',
    conjunction: ' e ',
    interactionWords: ['interação', 'interações'],
    peopleWords: ['pessoa', 'pessoas'],
    reactionWords: ['reação', 'reações'],
    commentWords: ['comentário', 'comentários']
  },
  es: {
    madeWith: '{n} {word} con {people} {peopleWord}',
    reactions: '{n} {word} en tus publicaciones',
    comments: '{n} {word} en tus publicaciones',
    position: 'Estás en el puesto #{n} del ranking semanal.',
    gap: 'A {n} {word} del #{position}.',
    conjunction: ' y ',
    interactionWords: ['interacción', 'interacciones'],
    peopleWords: ['persona', 'personas'],
    reactionWords: ['reacción', 'reacciones'],
    commentWords: ['comentario', 'comentarios']
  }
}

function nearEndWord(n: number, [one, many]: [string, string]): string {
  return n === 1 ? one : many
}

function nearEndGraph(locale: BillingLocale, a: NearEndArgs): string {
  const copy = NEAR_END_GRAPH[locale]
  const parts: string[] = []
  if (a.made !== undefined && a.made > 0 && a.peopleMade !== undefined && a.peopleMade > 0) {
    parts.push(
      copy.madeWith
        .replace('{n}', String(a.made))
        .replace('{word}', nearEndWord(a.made, copy.interactionWords))
        .replace('{people}', String(a.peopleMade))
        .replace('{peopleWord}', nearEndWord(a.peopleMade, copy.peopleWords))
    )
  }
  const reactions = a.receivedReactions ?? 0
  const comments = a.receivedComments ?? 0
  if (reactions > 0 || comments > 0) {
    const received: string[] = []
    if (reactions > 0) {
      received.push(
        copy.reactions.replace('{n}', String(reactions)).replace('{word}', nearEndWord(reactions, copy.reactionWords))
      )
    }
    if (comments > 0) {
      received.push(
        copy.comments.replace('{n}', String(comments)).replace('{word}', nearEndWord(comments, copy.commentWords))
      )
    }
    parts.push(received.join(copy.conjunction))
  }
  const sentences: string[] = []
  if (parts.length) sentences.push(`${parts.join(', ')}.`)
  const position = a.position ?? null
  if (position !== null) sentences.push(copy.position.replace('{n}', String(position)))
  if (a.gapToNext !== undefined && a.gapToNext !== null && position !== null) {
    sentences.push(
      copy.gap
        .replace('{n}', String(a.gapToNext))
        .replace('{word}', nearEndWord(a.gapToNext, copy.interactionWords))
        .replace('{position}', String(position - 1))
    )
  }
  return sentences.join(' ')
}

export function trialNearEndEmail(locale: BillingLocale, a: NearEndArgs): EmailContent {
  const total = a.made + a.received
  const interactionWord = total === 1 ? 'interaction' : 'interactions'
  const copy: Record<
    BillingLocale,
    {
      subject: string
      heading: string
      lead: string
      term: string
      cancel: string
      planLabel: string
      priceLabel: string
      cta: string
    }
  > = {
    en: {
      subject: `${total} ${interactionWord} so far on ${APP}`,
      heading: `${total} ${interactionWord} so far`,
      lead: `You have ${a.made} ${a.made === 1 ? 'interaction' : 'interactions'} made and ${a.received} received — ${total} in total.`,
      term: `Your ${planWithPrice(`${a.planName} plan`, a.priceLabel)} starts after ${a.remaining} more ${a.remaining === 1 ? 'interaction' : 'interactions'}, or on the last day of your trial, whichever comes first.`,
      cancel: `Cancel before then and you pay nothing:`,
      planLabel: 'Plan',
      priceLabel: 'Price',
      cta: 'Manage billing'
    },
    pt: {
      subject: `${total} ${total === 1 ? 'interação' : 'interações'} até agora no ${APP}`,
      heading: `${total} ${total === 1 ? 'interação' : 'interações'} até agora`,
      lead: `Você tem ${a.made} ${a.made === 1 ? 'interação feita' : 'interações feitas'} e ${a.received} ${a.received === 1 ? 'recebida' : 'recebidas'} — ${total} no total.`,
      term: `Seu plano ${planWithPrice(a.planName, a.priceLabel)} começa depois de mais ${a.remaining} ${a.remaining === 1 ? 'interação' : 'interações'}, ou no último dia do seu teste, o que vier primeiro.`,
      cancel: `Cancele antes disso e você não paga nada:`,
      planLabel: 'Plano',
      priceLabel: 'Preço',
      cta: 'Gerenciar assinatura'
    },
    es: {
      subject: `${total} ${total === 1 ? 'interacción' : 'interacciones'} hasta ahora en ${APP}`,
      heading: `${total} ${total === 1 ? 'interacción' : 'interacciones'} hasta ahora`,
      lead: `Tienes ${a.made} ${a.made === 1 ? 'interacción hecha' : 'interacciones hechas'} y ${a.received} ${a.received === 1 ? 'recibida' : 'recibidas'}: ${total} en total.`,
      term: `Tu plan ${planWithPrice(a.planName, a.priceLabel)} comienza después de ${a.remaining} ${a.remaining === 1 ? 'interacción' : 'interacciones'} más, o el último día de tu prueba, lo que ocurra primero.`,
      cancel: `Cancela antes y no pagas nada:`,
      planLabel: 'Plan',
      priceLabel: 'Precio',
      cta: 'Gestionar suscripción'
    }
  }
  const c = copy[locale]
  const graph = nearEndGraph(locale, a)
  return {
    subject: c.subject,
    text: [c.lead, graph, c.term, `${c.cancel} ${a.billingUrl}`].filter(Boolean).join('\n\n'),
    html: renderEmailLayout({
      lang: locale,
      preheader: c.lead,
      heading: c.heading,
      contentHtml:
        emailFacts([
          { label: c.planLabel, value: a.planName },
          ...(a.priceLabel ? [{ label: c.priceLabel, value: a.priceLabel }] : [])
        ]) +
        emailParagraph(c.lead) +
        (graph ? emailParagraph(escapeHtml(graph)) : '') +
        emailParagraph(c.term) +
        emailParagraph(c.cancel) +
        emailButton({ href: a.billingUrl, label: c.cta })
    })
  }
}

interface EndingArgs {
  endsOn: string
  planName: string
  priceLabel: string
  billingUrl: string
}

export function trialEndingEmail(locale: BillingLocale, a: EndingArgs): EmailContent {
  const copy: Record<
    BillingLocale,
    {
      subject: string
      heading: string
      term: string
      cancel: string
      planLabel: string
      priceLabel: string
      trialEndsLabel: string
      cta: string
    }
  > = {
    en: {
      subject: `Your ${APP} trial ends on ${a.endsOn}`,
      heading: `Your trial ends on ${a.endsOn}`,
      term: `Your free trial ends on ${a.endsOn}, or as soon as you reach ${TRIAL_INTERACTION_THRESHOLD} interactions, whichever comes first. Your ${planWithPrice(`${a.planName} plan`, a.priceLabel)} starts then.`,
      cancel: `Cancel before then and you pay nothing:`,
      planLabel: 'Plan',
      priceLabel: 'Price',
      trialEndsLabel: 'Trial ends',
      cta: 'Manage billing'
    },
    pt: {
      subject: `Seu teste do ${APP} termina em ${a.endsOn}`,
      heading: `Seu teste termina em ${a.endsOn}`,
      term: `Seu teste grátis termina em ${a.endsOn} ou assim que você chegar a ${TRIAL_INTERACTION_THRESHOLD} interações, o que ocorrer primeiro. Seu plano ${planWithPrice(a.planName, a.priceLabel)} começa nesse momento.`,
      cancel: `Cancele antes disso e você não paga nada:`,
      planLabel: 'Plano',
      priceLabel: 'Preço',
      trialEndsLabel: 'Teste termina',
      cta: 'Gerenciar assinatura'
    },
    es: {
      subject: `Tu prueba de ${APP} termina el ${a.endsOn}`,
      heading: `Tu prueba termina el ${a.endsOn}`,
      term: `Tu prueba gratuita termina el ${a.endsOn} o en cuanto llegues a ${TRIAL_INTERACTION_THRESHOLD} interacciones, lo que ocurra primero. Tu plan ${planWithPrice(a.planName, a.priceLabel)} comienza en ese momento.`,
      cancel: `Cancela antes y no pagas nada:`,
      planLabel: 'Plan',
      priceLabel: 'Precio',
      trialEndsLabel: 'La prueba termina',
      cta: 'Gestionar suscripción'
    }
  }
  const c = copy[locale]
  return {
    subject: c.subject,
    text: `${c.term}\n\n${c.cancel} ${a.billingUrl}`,
    html: renderEmailLayout({
      lang: locale,
      preheader: c.term,
      heading: c.heading,
      contentHtml:
        emailFacts([
          { label: c.planLabel, value: a.planName },
          ...(a.priceLabel ? [{ label: c.priceLabel, value: a.priceLabel }] : []),
          { label: c.trialEndsLabel, value: a.endsOn }
        ]) +
        emailParagraph(c.term) +
        emailParagraph(c.cancel) +
        emailButton({ href: a.billingUrl, label: c.cta })
    })
  }
}

export function duplicateSubscriptionCanceledEmail(
  locale: BillingLocale,
  a: { planName: string; billingUrl: string }
): EmailContent {
  const copy: Record<
    BillingLocale,
    { subject: string; heading: string; body: string; link: string; planLabel: string; cta: string }
  > = {
    en: {
      subject: `We removed a duplicate subscription on ${APP}`,
      heading: 'We removed a duplicate subscription',
      body: `A second subscription was created on your account by mistake, so we cancelled it right away. If it was charged, we refunded the full amount. Your ${a.planName} plan is unchanged.`,
      link: `See your subscription:`,
      planLabel: 'Plan',
      cta: 'Manage billing'
    },
    pt: {
      subject: `Removemos uma assinatura duplicada no ${APP}`,
      heading: 'Removemos uma assinatura duplicada',
      body: `Uma segunda assinatura foi criada na sua conta por engano, então cancelamos na hora. Se ela foi cobrada, devolvemos o valor total. Seu plano ${a.planName} continua igual.`,
      link: `Veja sua assinatura:`,
      planLabel: 'Plano',
      cta: 'Gerenciar assinatura'
    },
    es: {
      subject: `Eliminamos una suscripción duplicada en ${APP}`,
      heading: 'Eliminamos una suscripción duplicada',
      body: `Se creó una segunda suscripción en tu cuenta por error, así que la cancelamos de inmediato. Si se cobró, te devolvimos el importe total. Tu plan ${a.planName} sigue igual.`,
      link: `Consulta tu suscripción:`,
      planLabel: 'Plan',
      cta: 'Gestionar suscripción'
    }
  }
  const c = copy[locale]
  return {
    subject: c.subject,
    text: `${c.body}\n\n${c.link} ${a.billingUrl}`,
    html: renderEmailLayout({
      lang: locale,
      preheader: c.body,
      heading: c.heading,
      contentHtml:
        emailFacts([{ label: c.planLabel, value: a.planName }]) +
        emailParagraph(c.body) +
        emailParagraph(c.link) +
        emailButton({ href: a.billingUrl, label: c.cta })
    })
  }
}

export interface ConvertedArgs {
  made: number
  received: number
  planName: string
  priceLabel: string
  recapUrl: string
}

/** Day-7 conversion notice (backlog/R14): the charge and the recorded counts, one link. Not sent at 0+0. */
export function trialConvertedEmail(locale: BillingLocale, a: ConvertedArgs): EmailContent {
  const copy: Record<
    BillingLocale,
    { subject: string; lead: string; term: string; link: string; planLabel: string; priceLabel: string; cta: string }
  > = {
    en: {
      subject: `Your ${a.planName} plan started today`,
      lead: `During your trial you made ${a.made} ${a.made === 1 ? 'interaction' : 'interactions'} and your posts received ${a.received}.`,
      term: `Your ${planWithPrice(`${a.planName} plan`, a.priceLabel)} is now active.`,
      link: 'See your recap:',
      planLabel: 'Plan',
      priceLabel: 'Price',
      cta: 'See your recap'
    },
    pt: {
      subject: `Seu plano ${a.planName} começou hoje`,
      lead: `Durante o seu teste você fez ${a.made} ${a.made === 1 ? 'interação' : 'interações'} e suas publicações receberam ${a.received} ${a.received === 1 ? 'interação' : 'interações'}.`,
      term: `Seu plano ${planWithPrice(a.planName, a.priceLabel)} está ativo.`,
      link: 'Veja seu resumo:',
      planLabel: 'Plano',
      priceLabel: 'Preço',
      cta: 'Veja seu resumo'
    },
    es: {
      subject: `Tu plan ${a.planName} comenzó hoy`,
      lead: `Durante tu prueba hiciste ${a.made} ${a.made === 1 ? 'interacción' : 'interacciones'} y tus publicaciones recibieron ${a.received}.`,
      term: `Tu plan ${planWithPrice(a.planName, a.priceLabel)} ya está activo.`,
      link: 'Mira tu resumen:',
      planLabel: 'Plan',
      priceLabel: 'Precio',
      cta: 'Mira tu resumen'
    }
  }
  const c = copy[locale]
  return {
    subject: c.subject,
    text: `${c.lead}\n\n${c.term}\n\n${c.link} ${a.recapUrl}`,
    html: renderEmailLayout({
      lang: locale,
      preheader: c.lead,
      heading: c.subject,
      contentHtml:
        emailFacts([
          { label: c.planLabel, value: a.planName },
          ...(a.priceLabel ? [{ label: c.priceLabel, value: a.priceLabel }] : [])
        ]) +
        emailParagraph(c.lead) +
        emailParagraph(c.term) +
        emailParagraph(c.link) +
        emailButton({ href: a.recapUrl, label: c.cta })
    })
  }
}

export interface CapReachedArgs {
  /** The post's first characters (lib/recap `excerpt`), quoted so the author knows which post. */
  excerpt: string
  /**
   * What the post actually collected (likeCount + commentCount). Never the same sentence as `cap`:
   * after a downgrade a post sitting at 41 flips against a cap of 25, and the subject must report
   * the post's own number. At the flip the total is always >= the cap, so they usually agree.
   */
  total: number
  cap: number
  mode: CapNoticeMode
  nextPlanName?: string
  nextCap?: number
  upgradeUrl?: string
  myPostsUrl: string
  supportEmail: string
  /** The author's live 7d board position and reach to the next place, from rankings.getGraphSummary (RCD follow-up). */
  position?: number | null
  gapToNext?: number | null
}

/**
 * Sent once per post when it reaches the plan's interaction cap and leaves the feed (backlog/R20).
 * The event first, then where the post still lives, then the one line the tier can act on. No
 * urgency and no second link — the transactional guard test enforces the words.
 */
export function postCapReachedEmail(locale: BillingLocale, a: CapReachedArgs): EmailContent {
  const copy: Record<
    BillingLocale,
    {
      subject: string
      body: string
      stays: string
      upgrade: string
      proContact: string
      contactCustom: string
      seePlans: string
      openMyPosts: string
      board: string
      boardGap: string
    }
  > = {
    en: {
      subject: `Your post reached ${a.total} interactions and left the feed`,
      body: `It reached its cap of ${a.cap} interactions and left the feed so members see the rest.`,
      stays: 'It stays on My Posts:',
      // Future tense on purpose: an upgrade alone never un-flips `interactionLimitReached` — only
      // a featured-post purchase does (lib/featuredPurchase.purchasedFeaturePatch) — so upgrading
      // does NOT put this post back in the feed. Promising that ahead of a charge would be a lie.
      upgrade: `On ${a.nextPlanName}, your next posts collect up to ${a.nextCap} each:`,
      proContact: `Need a higher cap? Write to ${a.supportEmail}.`,
      contactCustom: `Your plan has a custom cap. Write to ${a.supportEmail} to adjust it.`,
      seePlans: 'See plans',
      openMyPosts: 'Open My Posts',
      board: 'You are #{position} on the weekly board.',
      boardGap: 'You are #{position} on the weekly board, {n} {word} from #{next}.'
    },
    pt: {
      subject: `Sua publicação chegou a ${a.total} interações e saiu do feed`,
      body: `Ela atingiu seu limite de ${a.cap} interações e saiu do feed para que os membros vejam as demais.`,
      stays: 'Ela continua em Minhas publicações:',
      upgrade: `No ${a.nextPlanName}, suas próximas publicações recebem até ${a.nextCap} cada uma:`,
      proContact: `Precisa de um limite maior? Escreva para ${a.supportEmail}.`,
      contactCustom: `Seu plano tem um limite personalizado. Escreva para ${a.supportEmail} para ajustá-lo.`,
      seePlans: 'Ver planos',
      openMyPosts: 'Abrir Minhas publicações',
      board: 'Você está em #{position} no ranking semanal.',
      boardGap: 'Você está em #{position} no ranking semanal, a {n} {word} do #{next}.'
    },
    es: {
      subject: `Tu publicación llegó a ${a.total} interacciones y salió del feed`,
      body: `Alcanzó su límite de ${a.cap} interacciones y salió del feed para que los miembros vean las demás.`,
      stays: 'Sigue en Mis publicaciones:',
      upgrade: `En ${a.nextPlanName}, tus próximas publicaciones reciben hasta ${a.nextCap} cada una:`,
      proContact: `¿Necesitas un límite mayor? Escribe a ${a.supportEmail}.`,
      contactCustom: `Tu plan tiene un límite personalizado. Escribe a ${a.supportEmail} para ajustarlo.`,
      seePlans: 'Ver planes',
      openMyPosts: 'Abrir Mis publicaciones',
      board: 'Estás en el puesto #{position} del ranking semanal.',
      boardGap: 'Estás en el puesto #{position} del ranking semanal, a {n} {word} del #{next}.'
    }
  }
  const c = copy[locale]
  const board =
    a.position === null || a.position === undefined
      ? ''
      : a.gapToNext !== undefined && a.gapToNext !== null
        ? c.boardGap
            .replace('{position}', String(a.position))
            .replace('{n}', String(a.gapToNext))
            .replace('{word}', nearEndWord(a.gapToNext, NEAR_END_GRAPH[locale].interactionWords))
            .replace('{next}', String(a.position - 1))
        : c.board.replace('{position}', String(a.position))
  const closing =
    a.mode === 'upgrade' ? `${c.upgrade} ${a.upgradeUrl}` : a.mode === 'proContact' ? c.proContact : c.contactCustom
  // One link per email. In upgrade mode the checkout link is the one the member can act on, so the
  // My Posts line steps aside; the other modes close with a support address, which is not a link.
  const stays = a.mode === 'upgrade' ? '' : `${c.stays} ${a.myPostsUrl}\n\n`
  const content =
    emailQuote(`“${a.excerpt}”`) +
    emailParagraph(c.body) +
    (board ? emailParagraph(escapeHtml(board)) : '') +
    (a.mode === 'upgrade'
      ? emailParagraph(c.upgrade) + (a.upgradeUrl ? emailButton({ href: a.upgradeUrl, label: c.seePlans }) : '')
      : emailParagraph(c.stays) +
        emailButton({ href: a.myPostsUrl, label: c.openMyPosts }) +
        emailNote(escapeHtml(closing)))
  return {
    subject: c.subject,
    text: `“${a.excerpt}”\n\n${c.body}\n\n${board ? `${board}\n\n` : ''}${stays}${closing}`,
    html: renderEmailLayout({ lang: locale, preheader: c.body, heading: c.subject, contentHtml: content })
  }
}
