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
import { useCardGate } from '@/hooks/useCardGate'
import { TRIAL_INTERACTION_THRESHOLD } from '../../../convex/lib/trialMilestone'

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
  const { status } = useCardGate()
  const pastDue = status === 'past_due'

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
          <DialogDescription>{t(pastDue ? 'feed.cardGateBodyPastDue' : 'feed.cardGateBody')}</DialogDescription>
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
              {t(pastDue ? 'feed.cardGatePastDueCta' : 'feed.cardGateCta')}
            </Link>
          </Button>
        </DialogFooter>
        {/* What the CTA costs, right under it (R04 "the line under it says what it costs") — a trial
            ask with no price line reads as a hidden charge. Not for past_due: they're not starting
            a trial, they're fixing a card. */}
        {!pastDue && (
          <p className="text-muted-foreground m-0 text-xs">
            {t('feed.cardGateCost', { threshold: TRIAL_INTERACTION_THRESHOLD })}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
