import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'
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
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { friendlyError } from '@/lib/errors'
import { captureEvent } from '@/lib/observability/analytics'
import { floorToHour } from '../../../convex/lib/recap'

// Mirrors MAX_FEEDBACK_LENGTH (convex/feedback/feedback.ts); importing it would pull the server module into the bundle.
const MAX = 4000

interface OwnPost {
  hidden?: boolean
  interactionLimitReached?: boolean
}

// backlog/R09 — the single interstitial between "Cancel plan" and Stripe's hosted cancel flow.
// It shows what the member keeps (real counts), offers Starter above Starter, and asks one optional
// question. Never a second screen, never a guilt line.
export default function CancelInterstitial({
  open,
  onOpenChange,
  tier,
  isTrialing,
  periodEndDate,
  pendingTier
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tier: string
  isTrialing: boolean
  periodEndDate: string | null
  /** backlog/B07 — a downgrade already scheduled for the period end. Hides the alternative. */
  pendingTier?: string
}) {
  const { t } = useTranslation()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const [now] = useState(() => floorToHour(Date.now()))
  const recap = useQuery(
    api.interactions.getRecap,
    open && sessionToken ? { sessionToken, window: '30d', now } : 'skip'
  )
  const posts = useQuery(api.posts.getMyPosts, open && sessionToken ? { sessionToken } : 'skip') as
    | OwnPost[]
    | undefined
  const createCancelFlow = useAction(api.billingNode.createCancelFlowSession)
  const submitFeedback = useMutation(api.feedback.feedback.submitFeedback)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)

  // Guards against a re-fire while the dialog stays open: `tier`/`isTrialing` come from a live
  // subscription in BillingPage, so a mid-read status change would otherwise re-run this effect.
  const startedRef = useRef(false)
  useEffect(() => {
    if (!open) {
      startedRef.current = false
      return
    }
    if (startedRef.current) return
    startedRef.current = true
    captureEvent('cancel_started', { plan: tier, trial: isTrialing })
  }, [open, tier, isTrialing])

  const received = recap?.received.current.total
  // getMyPosts already excludes soft-deleted posts; hidden + capped mirror computeFeedFields
  // (convex/lib/feedRank.ts) — keep in sync.
  const liveCount = posts?.filter(p => !p.hidden && !p.interactionLimitReached).length

  let body: ReactNode
  if (isTrialing) {
    body = t(periodEndDate ? 'billing.cancel.trialBody' : 'billing.cancel.trialBodyNoDate', { date: periodEndDate })
  } else if (received === undefined || liveCount === undefined) {
    body = (
      <span
        role="status"
        aria-live="polite"
      >
        …
      </span>
    )
  } else if (!periodEndDate) {
    body = t('billing.cancel.bodyNoDate', { received })
  } else if (liveCount === 0) {
    body = t('billing.cancel.bodyNoPosts', { date: periodEndDate, received })
  } else {
    body = t('billing.cancel.body', { count: liveCount, date: periodEndDate, received })
  }

  async function go(flow: 'cancel' | 'downgrade') {
    if (!sessionToken) return
    setPending(true)
    try {
      if (flow === 'cancel') {
        const trimmed = message.trim()
        if (trimmed) {
          try {
            await submitFeedback({ sessionToken, category: 'cancellation', message: trimmed })
          } catch {
            // The note is a courtesy; the cancel must never depend on it.
          }
        }
      } else {
        captureEvent('cancel_alternative_taken', { from: tier })
      }
      const { url } = await createCancelFlow({ sessionToken, flow })
      if (url) {
        window.location.href = url
        return
      }
      // No url means the downgrade was SCHEDULED for the period end (backlog/B07): nowhere to send
      // them, and the save has already happened here rather than on a Stripe return leg — so this is
      // where cancel_alternative_taken's completion belongs.
      setPending(false)
      if (flow === 'downgrade') {
        captureEvent('cancel_alternative_completed', { from: tier })
        toast(t('billing.pendingScheduled', { plan: t('billing.plans.starter.name') }))
        onOpenChange(false)
      }
    } catch (err: unknown) {
      toast(t('billing.portalFailed', { error: friendlyError(err, String(err)) }))
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={o => {
        if (!o) setMessage('')
        onOpenChange(o)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('billing.cancel.title')}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>

        {/* Hidden during a trial: a trial runs on the plan it started on (product rule, 2026-09-09),
            so the save here is "keep my plan", not "move to Starter". billingNode refuses it too. */}
        {tier !== 'starter' && !pendingTier && !isTrialing && (
          <div className="bg-muted rounded-xl p-4 text-sm">
            <p className="m-0">{t('billing.cancel.alternative')}</p>
            <Button
              variant="outline"
              className="mt-3"
              disabled={pending}
              aria-busy={pending}
              onClick={() => void go('downgrade')}
            >
              {t('billing.cancel.alternativeCta')}
            </Button>
          </div>
        )}

        <label className="block text-sm">
          <span className="text-foreground mb-1 block font-medium">{t('billing.cancel.question')}</span>
          <Textarea
            value={message}
            maxLength={MAX}
            rows={3}
            placeholder={t('billing.cancel.questionPlaceholder')}
            onChange={e => setMessage(e.target.value)}
            className="resize-none"
          />
        </label>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t('billing.cancel.keep')}</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            aria-busy={pending}
            onClick={() => void go('cancel')}
          >
            {t('billing.cancel.continue')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
