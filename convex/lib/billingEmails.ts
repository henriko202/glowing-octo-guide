// convex/lib/billingEmails.ts
// Pure transactional-email builders for billing notices, mirroring convex/privacy/emails.ts.
// No I/O — each returns { subject, html, text } for convex/lib/email.ts:sendEmail to deliver.
//
// These are contract notices (card-network trial rules require a pre-charge reminder stating the
// amount, the date and how to cancel), never marketing: no promotional copy, no countdown, no
// urgency. Each one leads with what the member DID, then the term, then one link to cancel.
import type { BillingLocale } from './checkoutCopy'
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
