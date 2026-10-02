import type { Locale } from '../i18n/config'
import { SIGN_IN_URL } from './links'

export type BillingInterval = 'annual' | 'monthly'
const MONTHLY_PRICES = new Map([
  ['starter', 10],
  ['growth', 15],
  ['pro', 30]
])

export function planPrice(plan: string, interval: BillingInterval) {
  const monthly = MONTHLY_PRICES.get(plan)
  if (monthly === undefined) throw new Error(`Unknown plan: ${plan}`)
  return monthly * (interval === 'annual' ? 10 : 1)
}

export function formatPrice(amount: number, lang: Locale, decimals = 0) {
  const fractionDigits = {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }
  if (lang === 'en') {
    return new Intl.NumberFormat(lang, { style: 'currency', currency: 'USD', ...fractionDigits }).format(amount)
  }
  return `U$${new Intl.NumberFormat(lang, fractionDigits).format(amount)}`
}

// Keep in sync with convex/lib/invite.ts; the landing never imports backend code.
export function validReferral(value: string | null): string | null {
  return value && /^[a-z0-9]{8}$/.test(value) ? value : null
}

export function trialHref(plan: string, interval: BillingInterval, referral: string | null) {
  const url = new URL(SIGN_IN_URL)
  url.searchParams.set('plan', plan)
  url.searchParams.set('interval', interval)
  const code = validReferral(referral)
  if (code) url.searchParams.set('ref', code)
  return url.toString()
}

// The app root cannot be the login target: RequireAuth bounces a browser carrying the app-origin
// `signedOut` marker back to the landing (app/src/App.tsx), so a "Log in" click after an explicit
// sign-out would ping-pong. `/auth/start` always starts OAuth and clears that marker on success.
export function loginHref(referral: string | null) {
  const url = new URL(SIGN_IN_URL)
  const code = validReferral(referral)
  if (code) url.searchParams.set('ref', code)
  return url.toString()
}
