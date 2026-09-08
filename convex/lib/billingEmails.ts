// convex/lib/billingEmails.ts
// Pure transactional-email builders for billing notices, mirroring convex/privacy/emails.ts.
// No I/O — each returns { subject, html, text } for convex/lib/email.ts:sendEmail to deliver.
//
// These are contract notices (card-network trial rules require a pre-charge reminder stating the
// amount, the date and how to cancel), never marketing: no promotional copy, no countdown, no
// urgency. Each one leads with what the member DID, then the term, then one link to cancel.
import type { BillingLocale } from './checkoutCopy'
import type { CapNoticeMode } from './postCapNotice'
import { escapeHtml } from '../feedback/emails'
import type { EmailContent } from './email'
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
  const amount = new Intl.NumberFormat(INTL_TAG[locale], {
    style: 'currency',
    currency: price.currency.toUpperCase(),
    minimumFractionDigits: price.amount % 100 === 0 ? 0 : 2
  }).format(price.amount / 100)
  const unit = price.interval ? PERIOD[locale][price.interval] : undefined
  return unit ? `${amount} / ${unit}` : amount
}

interface NearEndArgs {
  made: number
  received: number
  remaining: number
  planName: string
  priceLabel: string
  billingUrl: string
}

export function trialNearEndEmail(locale: BillingLocale, a: NearEndArgs): EmailContent {
  const copy: Record<BillingLocale, { subject: string; lead: string; term: string; cancel: string }> = {
    en: {
      subject: `${a.made + a.received} interactions so far on ${APP}`,
      lead: `You have ${a.made} interactions made and ${a.received} received — ${a.made + a.received} in total.`,
      term: `Your ${a.planName} plan (${a.priceLabel}) starts after ${a.remaining} more interactions, or on the last day of your trial, whichever comes first.`,
      cancel: `Cancel before then and you pay nothing:`
    },
    pt: {
      subject: `${a.made + a.received} interações até agora no ${APP}`,
      lead: `Você tem ${a.made} interações feitas e ${a.received} recebidas — ${a.made + a.received} no total.`,
      term: `Seu plano ${a.planName} (${a.priceLabel}) começa depois de mais ${a.remaining} interações, ou no último dia do seu teste, o que vier primeiro.`,
      cancel: `Cancele antes disso e você não paga nada:`
    },
    es: {
      subject: `${a.made + a.received} interacciones hasta ahora en ${APP}`,
      lead: `Tienes ${a.made} interacciones hechas y ${a.received} recibidas: ${a.made + a.received} en total.`,
      term: `Tu plan ${a.planName} (${a.priceLabel}) comienza después de ${a.remaining} interacciones más, o el último día de tu prueba, lo que ocurra primero.`,
      cancel: `Cancela antes y no pagas nada:`
    }
  }
  const c = copy[locale]
  return {
    subject: c.subject,
    text: `${c.lead}\n\n${c.term}\n\n${c.cancel} ${a.billingUrl}`,
    html: `<p>${c.lead}</p><p>${c.term}</p><p>${c.cancel} <a href="${a.billingUrl}">${a.billingUrl}</a></p>`
  }
}

interface EndingArgs {
  endsOn: string
  planName: string
  priceLabel: string
  billingUrl: string
}

export function trialEndingEmail(locale: BillingLocale, a: EndingArgs): EmailContent {
  const copy: Record<BillingLocale, { subject: string; term: string; cancel: string }> = {
    en: {
      subject: `Your ${APP} trial ends on ${a.endsOn}`,
      term: `Your free trial ends on ${a.endsOn}, or as soon as you reach ${TRIAL_INTERACTION_THRESHOLD} interactions, whichever comes first. Your ${a.planName} plan (${a.priceLabel}) starts then.`,
      cancel: `Cancel before then and you pay nothing:`
    },
    pt: {
      subject: `Seu teste do ${APP} termina em ${a.endsOn}`,
      term: `Seu teste grátis termina em ${a.endsOn} ou assim que você chegar a ${TRIAL_INTERACTION_THRESHOLD} interações, o que ocorrer primeiro. Seu plano ${a.planName} (${a.priceLabel}) começa nesse momento.`,
      cancel: `Cancele antes disso e você não paga nada:`
    },
    es: {
      subject: `Tu prueba de ${APP} termina el ${a.endsOn}`,
      term: `Tu prueba gratuita termina el ${a.endsOn} o en cuanto llegues a ${TRIAL_INTERACTION_THRESHOLD} interacciones, lo que ocurra primero. Tu plan ${a.planName} (${a.priceLabel}) comienza en ese momento.`,
      cancel: `Cancela antes y no pagas nada:`
    }
  }
  const c = copy[locale]
  return {
    subject: c.subject,
    text: `${c.term}\n\n${c.cancel} ${a.billingUrl}`,
    html: `<p>${c.term}</p><p>${c.cancel} <a href="${a.billingUrl}">${a.billingUrl}</a></p>`
  }
}

export function duplicateSubscriptionCanceledEmail(
  locale: BillingLocale,
  a: { planName: string; billingUrl: string }
): EmailContent {
  const copy: Record<BillingLocale, { subject: string; body: string; link: string }> = {
    en: {
      subject: `We removed a duplicate subscription on ${APP}`,
      body: `A second subscription was created on your account by mistake, so we cancelled it right away. You have not been charged for it. Your ${a.planName} plan is unchanged.`,
      link: `See your subscription:`
    },
    pt: {
      subject: `Removemos uma assinatura duplicada no ${APP}`,
      body: `Uma segunda assinatura foi criada na sua conta por engano, então cancelamos na hora. Você não foi cobrado por ela. Seu plano ${a.planName} continua igual.`,
      link: `Veja sua assinatura:`
    },
    es: {
      subject: `Eliminamos una suscripción duplicada en ${APP}`,
      body: `Se creó una segunda suscripción en tu cuenta por error, así que la cancelamos de inmediato. No se te cobró por ella. Tu plan ${a.planName} sigue igual.`,
      link: `Consulta tu suscripción:`
    }
  }
  const c = copy[locale]
  return {
    subject: c.subject,
    text: `${c.body}\n\n${c.link} ${a.billingUrl}`,
    html: `<p>${c.body}</p><p>${c.link} <a href="${a.billingUrl}">${a.billingUrl}</a></p>`
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
  const copy: Record<BillingLocale, { subject: string; lead: string; term: string; link: string }> = {
    en: {
      subject: `Your ${a.planName} plan started today`,
      lead: `During your trial you made ${a.made} interactions and your posts received ${a.received}.`,
      term: `Your ${a.planName} plan (${a.priceLabel}) is now active.`,
      link: 'See your recap:'
    },
    pt: {
      subject: `Seu plano ${a.planName} começou hoje`,
      lead: `Durante o seu teste você fez ${a.made} interações e suas publicações receberam ${a.received}.`,
      term: `Seu plano ${a.planName} (${a.priceLabel}) está ativo.`,
      link: 'Veja seu resumo:'
    },
    es: {
      subject: `Tu plan ${a.planName} comenzó hoy`,
      lead: `Durante tu prueba hiciste ${a.made} interacciones y tus publicaciones recibieron ${a.received}.`,
      term: `Tu plan ${a.planName} (${a.priceLabel}) ya está activo.`,
      link: 'Mira tu resumen:'
    }
  }
  const c = copy[locale]
  return {
    subject: c.subject,
    text: `${c.lead}\n\n${c.term}\n\n${c.link} ${a.recapUrl}`,
    html: `<p>${c.lead}</p><p>${c.term}</p><p>${c.link} <a href="${a.recapUrl}">${a.recapUrl}</a></p>`
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
  planName: string
  mode: CapNoticeMode
  nextPlanName?: string
  nextCap?: number
  upgradeUrl?: string
  myPostsUrl: string
  supportEmail: string
}

/**
 * Sent once per post when it reaches the plan's interaction cap and leaves the feed (backlog/R20).
 * The event first, then where the post still lives, then the one line the tier can act on. No
 * urgency and no second link — the transactional guard test enforces the words.
 */
export function postCapReachedEmail(locale: BillingLocale, a: CapReachedArgs): EmailContent {
  const copy: Record<
    BillingLocale,
    { subject: string; body: string; stays: string; upgrade: string; proContact: string; contactCustom: string }
  > = {
    en: {
      subject: `Your post reached ${a.total} interactions and left the feed`,
      body: `It reached the ${a.planName} cap of ${a.cap} interactions and left the feed so members see the rest.`,
      stays: 'It stays on My Posts:',
      // Future tense on purpose: nothing ever un-flips `interactionLimitReached`, so upgrading does
      // NOT put this post back in the feed. Promising that ahead of a charge would be a lie.
      upgrade: `On ${a.nextPlanName}, your next posts collect up to ${a.nextCap} each:`,
      proContact: `Need a higher cap? Write to ${a.supportEmail}.`,
      contactCustom: `Your plan has a custom cap. Write to ${a.supportEmail} to adjust it.`
    },
    pt: {
      subject: `Sua publicação chegou a ${a.total} interações e saiu do feed`,
      body: `Ela atingiu o limite do plano ${a.planName}, de ${a.cap} interações, e saiu do feed para que os membros vejam as demais.`,
      stays: 'Ela continua em Minhas publicações:',
      upgrade: `No ${a.nextPlanName}, suas próximas publicações recebem até ${a.nextCap} cada uma:`,
      proContact: `Precisa de um limite maior? Escreva para ${a.supportEmail}.`,
      contactCustom: `Seu plano tem um limite personalizado. Escreva para ${a.supportEmail} para ajustá-lo.`
    },
    es: {
      subject: `Tu publicación llegó a ${a.total} interacciones y salió del feed`,
      body: `Alcanzó el límite del plan ${a.planName}, de ${a.cap} interacciones, y salió del feed para que los miembros vean las demás.`,
      stays: 'Sigue en Mis publicaciones:',
      upgrade: `En ${a.nextPlanName}, tus próximas publicaciones reciben hasta ${a.nextCap} cada una:`,
      proContact: `¿Necesitas un límite mayor? Escribe a ${a.supportEmail}.`,
      contactCustom: `Tu plan tiene un límite personalizado. Escribe a ${a.supportEmail} para ajustarlo.`
    }
  }
  const c = copy[locale]
  const closing =
    a.mode === 'upgrade' ? `${c.upgrade} ${a.upgradeUrl}` : a.mode === 'proContact' ? c.proContact : c.contactCustom
  const closingHtml =
    a.mode === 'upgrade' ? `${c.upgrade} <a href="${a.upgradeUrl}">${a.upgradeUrl}</a>` : escapeHtml(closing)
  // One link per email. In upgrade mode the checkout link is the one the member can act on, so the
  // My Posts line steps aside; the other modes close with a support address, which is not a link.
  const stays = a.mode === 'upgrade' ? '' : `${c.stays} ${a.myPostsUrl}\n\n`
  const staysHtml = a.mode === 'upgrade' ? '' : `<p>${c.stays} <a href="${a.myPostsUrl}">${a.myPostsUrl}</a></p>`
  return {
    subject: c.subject,
    text: `“${a.excerpt}”\n\n${c.body}\n\n${stays}${closing}`,
    html: `<p>“${escapeHtml(a.excerpt)}”</p><p>${c.body}</p>${staysHtml}<p>${closingHtml}</p>`
  }
}
