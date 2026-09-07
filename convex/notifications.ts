// convex/notifications.ts
// Transactional billing notices. I/O only — every string comes from lib/billingEmails.ts and every
// branch from lib/trialMilestone.ts, so the copy and the rules are unit-tested without a database.
//
// Two trial-end paths exist and must never both fire for one event:
//   • 50 interactions  → endTrialEarly sets trial_end:'now', so Stripe emits no trial_will_end.
//                        Ours is the only warning, sent at 40 (lib/trialMilestone.ts).
//   • 7 elapsed days   → Stripe emits customer.subscription.trial_will_end 3 days ahead.
//                        Ours handles it; Stripe's own trial-ending email stays OFF in the
//                        Dashboard (see docs/PLATFORM.md §8, Stripe Dashboard setup).
import { internalAction } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { sendEmail } from './lib/email'
import type { EmailContent } from './lib/email'
import { scrubError } from './lib/scrubError'
import { resolveBillingLocale } from './lib/checkoutCopy'
import {
  duplicateSubscriptionCanceledEmail,
  formatPriceLabel,
  INTL_TAG,
  planName,
  trialConvertedEmail,
  trialEndingEmail,
  trialNearEndEmail
} from './lib/billingEmails'
import { findLiveSubscription, pickTrialingSubscription, TRIAL_INTERACTION_THRESHOLD } from './lib/trialMilestone'

function billingUrl(): string {
  return `${process.env.APP_URL ?? 'http://localhost:5173'}/billing`
}

/**
 * sendEmail no-ops when RESEND_API_KEY / EMAIL_FROM are unset (lib/email.ts). For a privacy
 * flow that is a convenience; for a pre-charge notice it is a compliance hole, so make it loud
 * in `pnpm watch:errors` and the Convex dashboard.
 */
async function deliver(kind: string, to: string, m: EmailContent): Promise<void> {
  const result = await sendEmail({ to, subject: m.subject, html: m.html, text: m.text })
  if (result.skipped) {
    console.error('[billing] notification skipped — email not configured', scrubError({ kind }))
  }
}

/** Fired once, on the interaction that reaches 40 of 50. Progress note first, then the term. */
export const sendTrialNearEnd = internalAction({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const c = await ctx.runQuery(internal.billing.getBillingContext, { userId })
    if (!c?.email) return
    // Never mail someone who already left: status moved on, or they cancelled at period end.
    if (c.subscriptionStatus !== 'trialing') return
    const sub = pickTrialingSubscription(c.subscriptions)
    if (!sub) return
    // Cancelled mid-trial: Stripe keeps status 'trialing', but no charge is coming.
    if (sub.cancelAtPeriodEnd) return

    const locale = resolveBillingLocale(c.language, c.primaryLocale)
    const combined = c.made + c.received
    const m = trialNearEndEmail(locale, {
      made: c.made,
      received: c.received,
      remaining: Math.max(0, TRIAL_INTERACTION_THRESHOLD - combined),
      planName: planName(locale, sub.tier),
      priceLabel: formatPriceLabel(locale, {
        amount: sub.priceAmount,
        currency: sub.priceCurrency,
        interval: sub.priceInterval
      }),
      billingUrl: billingUrl()
    })
    await deliver('trial_near_end', c.email, m)
  }
})

/** Stripe's customer.subscription.trial_will_end, 3 days before the 7-day trial elapses. */
export const sendTrialEnding = internalAction({
  args: { stripeSubscriptionId: v.string(), trialEndsAt: v.number() },
  handler: async (ctx, { stripeSubscriptionId, trialEndsAt }) => {
    const owner = await ctx.runQuery(internal.billing.getUserBySubscriptionId, { stripeSubscriptionId })
    if (!owner) return
    const c = await ctx.runQuery(internal.billing.getBillingContext, { userId: owner.userId })
    if (!c?.email || c.subscriptionStatus !== 'trialing') return
    const sub = c.subscriptions.find(s => s.stripeSubscriptionId === stripeSubscriptionId)
    if (!sub || sub.status !== 'trialing') return
    if (sub.cancelAtPeriodEnd) return

    const locale = resolveBillingLocale(c.language, c.primaryLocale)
    const m = trialEndingEmail(locale, {
      endsOn: new Date(trialEndsAt).toLocaleDateString(INTL_TAG[locale], {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }),
      planName: planName(locale, sub.tier),
      priceLabel: formatPriceLabel(locale, {
        amount: sub.priceAmount,
        currency: sub.priceCurrency,
        interval: sub.priceInterval
      }),
      billingUrl: billingUrl()
    })
    await deliver('trial_ending', c.email, m)
  }
})

/** A duplicate subscription was voided by the webhook — say so, never silently. */
export const sendDuplicateCanceled = internalAction({
  args: { userId: v.id('users'), tier: v.string() },
  handler: async (ctx, { userId, tier }) => {
    const c = await ctx.runQuery(internal.billing.getBillingContext, { userId })
    if (!c?.email) return
    const locale = resolveBillingLocale(c.language, c.primaryLocale)
    await deliver(
      'duplicate_canceled',
      c.email,
      duplicateSubscriptionCanceledEmail(locale, { planName: planName(locale, tier), billingUrl: billingUrl() })
    )
  }
})

/** Fired by stripe.syncUserSubscription when a row goes trialing → active (backlog/R14). */
export const sendTrialConverted = internalAction({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const c = await ctx.runQuery(internal.billing.getBillingContext, { userId })
    if (!c?.email) return
    if (c.subscriptionStatus !== 'active') return
    const sub = findLiveSubscription(c.subscriptions)
    if (!sub) return
    // Nothing recorded means nothing to recap — Henriko's call: skip the email at zero.
    if (c.made + c.received === 0) return

    const locale = resolveBillingLocale(c.language, c.primaryLocale)
    const m = trialConvertedEmail(locale, {
      made: c.made,
      received: c.received,
      planName: planName(locale, sub.tier),
      priceLabel: formatPriceLabel(locale, {
        amount: sub.priceAmount,
        currency: sub.priceCurrency,
        interval: sub.priceInterval
      }),
      recapUrl: `${process.env.APP_URL ?? 'http://localhost:5173'}/recap`
    })
    await deliver('trial_converted', c.email, m)
  }
})
