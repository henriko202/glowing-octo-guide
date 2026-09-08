// app/src/components/UpgradeAtLimit.tsx
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { isUnlimitedFeatured } from '../../../convex/lib/postLimit'
import { effectiveInteractionCap } from '../../../convex/lib/interactionLimit'
import { nextTier } from '../../../convex/lib/planLimits'
import { billingIntervalParam } from '../../../convex/lib/postCapNotice'
import { TRIAL_PERIOD_DAYS } from '../../../convex/lib/trialMilestone'
import { api } from '../convex'
import { SUPPORT_EMAIL } from '@/lib/support'
import { captureEvent } from '@/lib/observability/analytics'
import { useCardGate } from '@/hooks/useCardGate'
import { resolveTargetPlan } from '@/lib/targetPlan'
import { FEATURED_POST_PRICE, PLAN_PRICES } from '@/lib/planPrices'

export type LimitKind = 'weeklyPosts' | 'featured' | 'interactionCap' | 'visibility'

/**
 * The upgrade ask at the moment a member actually hits a plan cap (backlog/R08) — one sentence
 * naming the next tier's real numbers, one link. Never a checkout link for Pro or contact: Pro
 * gets the Enterprise contact line, contact (already on a custom limit) gets the custom-limit
 * line — both mailto, following BillingPage.tsx's Enterprise section.
 */
export default function UpgradeAtLimit({
  limit,
  nearCap,
  capBonus,
  className
}: {
  limit: LimitKind
  /** Recap-only: the post is inside the 80% band, not capped yet (backlog/R15). */
  nearCap?: { total: number; cap: number }
  /** backlog/R17 F5 — a bought post's own bonus, so the next-tier number this prints is the post's
   *  real next cap, not the plan's plain one. Undefined for every other caller. */
  capBonus?: number
  className?: string
}) {
  const { t } = useTranslation()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const me = useQuery(api.users.getMe, { sessionToken })
  const tierLimits = useQuery(api.posts.getTierLimits, {})
  const subscriptionInfo = useQuery(api.users.getSubscriptionInfo, sessionToken ? { sessionToken } : 'skip')
  const [searchParams] = useSearchParams()
  const { gated, status, canTrial } = useCardGate()

  // Render nothing while any query is loading, or when signed out — there is no tier to upgrade from.
  if (me === undefined || tierLimits === undefined || subscriptionInfo === undefined || !me) return null

  // A card-gated member (never started a trial, or a lapsed payment) can't meaningfully "upgrade"
  // past a tier they were never actually engaging on — a checkout link for the next tier is the
  // wrong ask. Point them at the same trial/payment-fix ask CardGateBanner/CardGateDialog use
  // instead (F2), branching on past_due -- and on canTrial -- the same way those do (F5).
  if (gated) {
    const plan = resolveTargetPlan(searchParams)
    const pastDue = status === 'past_due'
    return (
      <span className={className}>
        {t(pastDue ? 'feed.cardGateBodyPastDue' : canTrial ? 'feed.cardGateBody' : 'feed.cardGateBodyNoTrial')}{' '}
        {/* M6 — with no trial the link is an ask to pay, so the amount comes before it (both
            intervals: the link carries no interval). */}
        {!pastDue && !canTrial && (
          <>
            {t('feed.cardGatePriceNoTrial', {
              plan: t(`billing.plans.${plan}.name`),
              monthly: PLAN_PRICES.monthly[plan],
              annual: PLAN_PRICES.annual[plan]
            })}{' '}
          </>
        )}
        <Link
          to={`/billing?plan=${plan}`}
          className="text-primary hover:underline"
          onClick={() => captureEvent('card_gate_cta_clicked', { plan, source: limit })}
        >
          {/* backlog/R19 — an invited member has a 14-day trial; say so. */}
          {pastDue
            ? t('feed.cardGatePastDueCta')
            : canTrial
              ? t('feed.cardGateCta', { days: me.trialDays ?? TRIAL_PERIOD_DAYS })
              : t('billing.noTrialCta', { plan: t(`billing.plans.${plan}.name`) })}
        </Link>
      </span>
    )
  }

  const tier = me.tier ?? 'starter'
  // Visibility control is Pro-only (SettingsPage's `isPro`), so a Starter member's next step for it
  // is Pro, not Growth — the generic ladder would send them to a checkout that doesn't unlock it.
  const next = limit === 'visibility' && tier === 'starter' ? 'pro' : nextTier(tier)

  // Pro and contact never see a checkout link (decided 2026-09-05) — mailto for both.
  if (next === null) {
    const copyKey = tier === 'contact' ? 'upgrade.contactCustom' : 'upgrade.proContact'
    return (
      <span className={className}>
        {t(copyKey)}{' '}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="text-primary hover:underline"
          onClick={() => captureEvent('upgrade_at_limit_clicked', { limit, plan: tier, near: nearCap !== undefined })}
        >
          {SUPPORT_EMAIL}
        </a>
      </span>
    )
  }

  // What Stripe actually bills a card holder, off the same webhook snapshot BillingPage.tsx reads,
  // through the same mapper the cap email uses (annual when unknown, BillingPage's own cold default)
  // so the two links never disagree — never re-derives hasCard, the /billing link lands on the same
  // page whose handlePlanClick already makes that decision.
  const chargedInterval = billingIntervalParam(subscriptionInfo?.priceInterval)
  const ownLimits = tierLimits[tier]
  const nextLimits = tierLimits[next]
  const nextPlan = t(`billing.plans.${next}.name`)

  const copy = (() => {
    switch (limit) {
      case 'weeklyPosts':
        return t('upgrade.weeklyPosts', {
          used: ownLimits.postsPerWeek,
          nextPlan,
          next: nextLimits.postsPerWeek,
          interactions: nextLimits.interactionsPerPost
        })
      case 'featured':
        // Guard against ever printing the unlimited sentinel (convex/lib/postLimit.ts) — unreachable
        // via nextTier today (it never returns 'contact'), kept as a belt-and-suspenders check against
        // a future admin override of growth/pro's tier-default row.
        if (isUnlimitedFeatured(nextLimits.featuredPerMonth)) return t('upgrade.contactCustom')
        return t('upgrade.featured', { nextPlan, next: nextLimits.featuredPerMonth })
      case 'interactionCap':
        return nearCap
          ? t('upgrade.interactionCapNear', {
              total: nearCap.total,
              cap: nearCap.cap,
              nextPlan,
              next: effectiveInteractionCap(nextLimits.interactionsPerPost, capBonus)
            })
          : t('upgrade.interactionCap', {
              nextPlan,
              next: nextLimits.interactionsPerPost
            })
      case 'visibility':
        return t('upgrade.visibility', { nextPlan })
    }
  })()

  return (
    <span className={className}>
      {copy}{' '}
      <Link
        to={`/billing?plan=${next}&interval=${chargedInterval}`}
        className="text-primary hover:underline"
        onClick={() => captureEvent('upgrade_at_limit_clicked', { limit, plan: next, near: nearCap !== undefined })}
      >
        {t('upgrade.cta', { nextPlan })}
      </Link>
      {/* backlog/R17 — the add-on, after the upgrade, as text only: the cards on My Posts carry
          the control. Contact never reaches this return (the mailto branch above). F2 — a canceled
          member has no buy control on My Posts either (MyPostsPage.tsx canBuy), so the price has
          nothing to point at here. */}
      {limit === 'featured' && me.subscriptionStatus !== 'canceled' && (
        <span className="block">{t('upgrade.featuredAddon', { price: FEATURED_POST_PRICE })}</span>
      )}
    </span>
  )
}
