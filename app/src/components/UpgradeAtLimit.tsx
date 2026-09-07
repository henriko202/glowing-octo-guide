// app/src/components/UpgradeAtLimit.tsx
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { isUnlimitedFeatured } from '../../../convex/lib/postLimit'
import { nextTier } from '../../../convex/lib/planLimits'
import { api } from '../convex'
import { SUPPORT_EMAIL } from '@/lib/support'
import { captureEvent } from '@/lib/observability/analytics'
import { useCardGate } from '@/hooks/useCardGate'
import { resolveTargetPlan } from '@/lib/targetPlan'

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
  className
}: {
  limit: LimitKind
  /** Recap-only: the post is inside the 80% band, not capped yet (backlog/R15). */
  nearCap?: { total: number; cap: number }
  className?: string
}) {
  const { t } = useTranslation()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const me = useQuery(api.users.getMe, { sessionToken })
  const tierLimits = useQuery(api.posts.getTierLimits, {})
  const subscriptionInfo = useQuery(api.users.getSubscriptionInfo, sessionToken ? { sessionToken } : 'skip')
  const [searchParams] = useSearchParams()
  const { gated, status } = useCardGate()

  // Render nothing while any query is loading, or when signed out — there is no tier to upgrade from.
  if (me === undefined || tierLimits === undefined || subscriptionInfo === undefined || !me) return null

  // A card-gated member (never started a trial, or a lapsed payment) can't meaningfully "upgrade"
  // past a tier they were never actually engaging on — a checkout link for the next tier is the
  // wrong ask. Point them at the same trial/payment-fix ask CardGateBanner/CardGateDialog use
  // instead (F2), branching on past_due the same way those do (F5).
  if (gated) {
    const plan = resolveTargetPlan(searchParams)
    const pastDue = status === 'past_due'
    return (
      <span className={className}>
        {t(pastDue ? 'feed.cardGateBodyPastDue' : 'feed.cardGateBody')}{' '}
        <Link
          to={`/billing?plan=${plan}`}
          className="text-primary hover:underline"
          onClick={() => captureEvent('card_gate_cta_clicked', { plan, source: limit })}
        >
          {t(pastDue ? 'feed.cardGatePastDueCta' : 'feed.cardGateCta')}
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

  // What Stripe actually bills a card holder, off the same webhook snapshot BillingPage.tsx reads;
  // falls back to 'annual' otherwise (BillingPage's own toggle default) — never re-derives hasCard,
  // the /billing link lands on the same page whose handlePlanClick already makes that decision.
  const chargedInterval = subscriptionInfo?.priceInterval === 'month' ? 'monthly' : 'annual'
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
              next: nextLimits.interactionsPerPost
            })
          : t('upgrade.interactionCap', { nextPlan, next: nextLimits.interactionsPerPost })
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
    </span>
  )
}
