// convex/lib/checkoutCopy.ts
// Pure copy for the Stripe-hosted checkout page. The rule the user is agreeing to has to sit
// under the pay button, not in a FAQ: a cost learned after the card is entered is the single
// biggest cause of abandonment, and card-network trial rules expect the term stated up front.
// No I/O. Three languages, kept in parity with app/src/i18n/locales.
export type BillingLocale = 'en' | 'pt' | 'es'

const SUPPORTED: readonly string[] = ['en', 'pt', 'es']

/**
 * Which language a billing notice is written in.
 * Order: the language the member last checked out in → their scraped LinkedIn locale → English.
 * Accepts regional tags ('pt-BR') and any casing.
 */
export function resolveBillingLocale(language?: string, primaryLocale?: string): BillingLocale {
  for (const candidate of [language, primaryLocale]) {
    const short = candidate?.slice(0, 2).toLowerCase()
    if (short && SUPPORTED.includes(short)) return short as BillingLocale
  }
  return 'en'
}

/** Stripe's own locale codes differ from ours: it wants pt-BR, not pt. */
export function stripeCheckoutLocale(locale: BillingLocale): 'en' | 'pt-BR' | 'es' {
  return locale === 'pt' ? 'pt-BR' : locale
}

const TRIAL_MESSAGE: Record<BillingLocale, string> = {
  en: 'Your free trial ends as soon as you reach 50 interactions (made plus received), or after 7 days — whichever comes first. Billing starts then. Cancel before that from Subscription and you pay nothing.',
  pt: 'Seu teste grátis termina assim que você atingir 50 interações (feitas e recebidas) ou depois de 7 dias — o que vier primeiro. A cobrança começa nesse momento. Cancele antes disso em Assinatura e você não paga nada.',
  es: 'Tu prueba gratuita termina en cuanto alcances 50 interacciones (hechas y recibidas) o a los 7 días, lo que ocurra primero. La facturación comienza en ese momento. Cancela antes desde Suscripción y no pagas nada.'
}

const NO_TRIAL_MESSAGE: Record<BillingLocale, string> = {
  en: 'No trial this time — you have already used yours. You are billed today and your plan starts immediately. Cancel anytime from Subscription.',
  pt: 'Sem teste grátis desta vez — você já usou o seu. A cobrança é hoje e seu plano começa imediatamente. Cancele quando quiser em Assinatura.',
  es: 'Sin prueba gratuita esta vez: ya usaste la tuya. El cobro es hoy y tu plan comienza de inmediato. Cancela cuando quieras desde Suscripción.'
}

/** The line under Stripe's pay button. Stripe caps custom_text.submit.message at 1200 chars. */
export function checkoutSubmitMessage(locale: BillingLocale, opts: { trial: boolean }): string {
  return opts.trial ? TRIAL_MESSAGE[locale] : NO_TRIAL_MESSAGE[locale]
}
