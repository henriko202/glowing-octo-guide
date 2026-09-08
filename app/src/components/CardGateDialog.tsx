import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { captureEvent } from '@/lib/observability/analytics'
import { resolveTargetPlan } from '@/lib/targetPlan'
import { PLAN_PRICES } from '@/lib/planPrices'
import { useCardGate } from '@/hooks/useCardGate'
import { TRIAL_INTERACTION_THRESHOLD, TRIAL_PERIOD_DAYS } from '../../../convex/lib/trialMilestone'

export type GateSource = 'react' | 'comment' | 'linkedin' | 'aiDraft'

/**
 * The card gate binds here, at the tap, instead of on a disabled control (R04 / Option A — the
 * backend gate in convex/lib/access.ts is unchanged, only when the ask is shown). Copy leads with
 * the result, never with billing mechanics.
 */
export default function CardGateDialog({
  open,
  onOpenChange,
  source
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  source: GateSource
}) {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const plan = resolveTargetPlan(searchParams)
  // A past_due member already has a card and already had a trial — "start your trial" copy is
  // wrong for them (F5); they need to fix a failed payment, not sign up. The title's "your post
  // goes live" framing still holds (their post is hidden too), so only body + CTA branch.
  // `canTrial` is the second, quieter version of the same lie: a member on 'none' *with* rows gets
  // no trial at checkout either, so their body, CTA and cost line all swap too.
  const { status, me, canTrial } = useCardGate()
  const pastDue = status === 'past_due'
  // backlog/R19 — an invited member has a 14-day trial; say so. Fallback while `me` loads.
  const days = me?.trialDays ?? TRIAL_PERIOD_DAYS

  // Once per open, not once per render — a re-render while the dialog stays open (or closed)
  // must not re-fire it.
  useEffect(() => {
    if (open) captureEvent('card_gate_opened', { source })
  }, [open, source])

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('feed.cardGateTitle')}</DialogTitle>
          <DialogDescription>
            {t(pastDue ? 'feed.cardGateBodyPastDue' : canTrial ? 'feed.cardGateBody' : 'feed.cardGateBodyNoTrial')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t('feed.cardGateLater')}</Button>
          </DialogClose>
          <Button asChild>
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
        </DialogFooter>
        {/* What the CTA costs, right under it (R04 "the line under it says what it costs") — a trial
            ask with no price line reads as a hidden charge, and a *wrong* price line is worse: a
            member with no trial left is billed on click, so they get the plan's two amounts (M6 — the
            button says "Subscribe to Growth", so the price must not wait for the next page; both
            intervals, because the link carries no interval) and then `billing.noTrialNote` — the same
            sentence BillingPage shows and NO_TRIAL_MESSAGE prints under Stripe's own pay button two
            clicks later. Not for past_due: they're not starting anything, they're fixing a card. */}
        {!pastDue && (
          <p className="text-muted-foreground m-0 text-xs">
            {canTrial ? (
              t('feed.cardGateCost', { threshold: TRIAL_INTERACTION_THRESHOLD, days })
            ) : (
              <>
                {t('feed.cardGatePriceNoTrial', {
                  plan: t(`billing.plans.${plan}.name`),
                  monthly: PLAN_PRICES.monthly[plan],
                  annual: PLAN_PRICES.annual[plan]
                })}{' '}
                {t('billing.noTrialNote')}
              </>
            )}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
