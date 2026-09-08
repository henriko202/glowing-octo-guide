import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../convex'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { captureEvent } from '@/lib/observability/analytics'
import { resolveTargetPlan } from '@/lib/targetPlan'
import { PLAN_PRICES } from '@/lib/planPrices'
import { useCardGate } from '@/hooks/useCardGate'
import { TRIAL_PERIOD_DAYS } from '../../../convex/lib/trialMilestone'

/**
 * Own-post state for a card-gated member, off the same query MyPostsPage already uses: whether
 * their post is sitting hidden (`postCreatedHidden` in convex/lib/access.ts) and whether they have
 * a post at all. Subscribed only while `enabled` — a gated member has at most one post, so reusing
 * `getMyPosts` costs less than a new query. Shared with Task 4's success dialog and Task 5's
 * empty-feed checklist, so the signature must not drift.
 */
export function useOwnPostState(enabled: boolean): { hasHiddenPost: boolean; hasAnyPost: boolean } {
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const posts = useQuery(api.posts.getMyPosts, enabled && sessionToken ? { sessionToken } : 'skip') as
    | { hidden?: boolean }[]
    | undefined
  return {
    hasHiddenPost: !!posts?.some(p => p.hidden === true),
    hasAnyPost: !!posts && posts.length > 0
  }
}

/** Names what the member already owns — their hidden first post — with the one CTA that reveals it. */
export default function CardGateBanner({ className }: { className?: string }) {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const plan = resolveTargetPlan(searchParams)
  // A past_due member already has a card and already had a trial — "start your trial" copy is
  // wrong for them (F5); they need to fix a failed payment, not sign up. `canTrial` catches the
  // quieter version: a member on 'none' who still has subscription rows (incomplete/paused, or an
  // admin status reset) gets no trial at checkout either.
  const { status, me, canTrial } = useCardGate()
  const pastDue = status === 'past_due'
  // backlog/R19 — an invited member has a 14-day trial; say so. Fallback while `me` loads.
  const days = me?.trialDays ?? TRIAL_PERIOD_DAYS

  return (
    <div
      className={cn('border-primary bg-accent text-accent-foreground mb-4 rounded-xl border p-4 text-sm', className)}
    >
      <p className="m-0">
        {t(
          pastDue ? 'feed.hiddenPostBannerPastDue' : canTrial ? 'feed.hiddenPostBanner' : 'feed.hiddenPostBannerNoTrial'
        )}
      </p>
      <Button
        asChild
        className="mt-3"
      >
        <Link
          to={`/billing?plan=${plan}`}
          onClick={() => captureEvent('card_gate_cta_clicked', { plan })}
        >
          {pastDue
            ? t('feed.cardGatePastDueCta')
            : canTrial
              ? t('feed.cardGateCta', { days })
              : t('billing.noTrialCta', { plan: t(`billing.plans.${plan}.name`) })}
        </Link>
      </Button>
      {/* M6 — "Subscribe to Growth" with no trial is an ask to pay, so the amount is named here, not
          one page later. Both intervals: the link carries `?plan=` but no interval. The trial twin
          has no cost line on the banner (the dialog carries it), so this is no-trial only. */}
      {!pastDue && !canTrial && (
        <p className="text-muted-foreground mt-2 mb-0 text-xs">
          {t('feed.cardGatePriceNoTrial', {
            plan: t(`billing.plans.${plan}.name`),
            monthly: PLAN_PRICES.monthly[plan],
            annual: PLAN_PRICES.annual[plan]
          })}
        </p>
      )}
    </div>
  )
}
