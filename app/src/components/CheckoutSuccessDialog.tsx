import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
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

/**
 * The checkout-return celebration (R07 — peak-end rule + choice-supportive reinforcement).
 * BillingPage owns all the timing (waiting for the webhook, the 20s timeout); this component only
 * renders once told to open. `showPostLive` is the member's hidden-post state captured BEFORE the
 * webhook flip — by the time this opens the post is no longer hidden, so the caller must latch it.
 * `isTrial` picks the body: a first checkout lands on `trialing`, a canceled member re-subscribing
 * lands on `active` (no second trial) — "your trial is live" would be a lie for them.
 */
export default function CheckoutSuccessDialog({
  open,
  onOpenChange,
  plan,
  isTrial,
  showPostLive
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: string
  isTrial: boolean
  showPostLive: boolean
}) {
  const { t } = useTranslation()
  const planName = t(`billing.plans.${plan}.name`)

  // Once per open, not once per render.
  useEffect(() => {
    if (open) captureEvent('checkout_success_viewed', { plan })
  }, [open, plan])

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('billing.successTitle')}</DialogTitle>
          {/* asChild swaps Radix's default <p> for a <div> — the description has two lines, and a <p>
              can't legally contain another <p> (the browser would auto-close it and break the
              aria-describedby link to this text). */}
          <DialogDescription asChild>
            <div>
              <p className="m-0">
                {t(isTrial ? 'billing.successBody' : 'billing.successBodyActive', { plan: planName })}
              </p>
              {showPostLive && <p className="mt-2">{t('billing.successPostLive')}</p>}
              {/* Continue directly to the first useful action; do not promise a LinkedIn result. */}
              <p className="mt-2">{t('billing.successOutcome')}</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        {/* Reinforce the choice with the plan's own description — no upsell, no fabricated number. */}
        <p className="text-muted-foreground text-[13px]">{t(`billing.plans.${plan}.description`)}</p>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t('billing.successStay')}</Button>
          </DialogClose>
          <Button asChild>
            <Link to="/feed">{t('billing.successCta')}</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
