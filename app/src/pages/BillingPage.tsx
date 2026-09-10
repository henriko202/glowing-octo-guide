import { useEffect, useRef, useState } from 'react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../convex'
import { PageHeader } from '@/components/PageHeader'
import { TRIAL_INTERACTION_THRESHOLD, TRIAL_PERIOD_DAYS } from '../../../convex/lib/trialMilestone'
import TrialMeter from '@/components/TrialMeter'
import { useOwnPostState } from '@/components/CardGateBanner'
import CheckoutSuccessDialog from '@/components/CheckoutSuccessDialog'
import CancelInterstitial from '@/components/CancelInterstitial'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import { SUPPORT_EMAIL } from '@/lib/support'
import { friendlyError } from '@/lib/errors'
import { captureException } from '@/lib/observability/sentry'
import { captureEvent } from '@/lib/observability/analytics'
import { formatPriceLabel } from '../../../convex/lib/billingEmails'
import { resolveBillingLocale } from '../../../convex/lib/checkoutCopy'
import { canEngage } from '../../../convex/lib/access'
import { isUnlimitedFeatured } from '../../../convex/lib/postLimit'
import { DEFAULTS, FEATURED_CAP_BONUS, type Tier } from '../../../convex/lib/planLimits'
import { effectiveInteractionCap } from '../../../convex/lib/interactionLimit'
import { isPlanId, PLAN_IDS, type PlanId, resolveTargetPlan } from '@/lib/targetPlan'
import { FEATURED_POST_PRICE, type Interval, isInterval, PLAN_PRICES } from '@/lib/planPrices'

/** How long we give the Stripe webhook to land before the activating state times out (R07). */
const ACTIVATION_TIMEOUT_MS = 20_000

const PLAN_PRICE_IDS: Record<Interval, Record<string, string | undefined>> = {
  monthly: {
    starter: import.meta.env.VITE_STRIPE_STARTER_PRICE_ID as string | undefined,
    growth: import.meta.env.VITE_STRIPE_GROWTH_PRICE_ID as string | undefined,
    pro: import.meta.env.VITE_STRIPE_PRO_PRICE_ID as string | undefined
  },
  annual: {
    starter: import.meta.env.VITE_STRIPE_STARTER_ANNUAL_PRICE_ID as string | undefined,
    growth: import.meta.env.VITE_STRIPE_GROWTH_ANNUAL_PRICE_ID as string | undefined,
    pro: import.meta.env.VITE_STRIPE_PRO_ANNUAL_PRICE_ID as string | undefined
  }
}

function getTrialDaysRemaining(trialEndsAt: number | undefined): number {
  if (!trialEndsAt) return 0
  return Math.max(0, Math.ceil((trialEndsAt - Date.now()) / (1000 * 60 * 60 * 24)))
}

export default function BillingPage() {
  const { t, i18n } = useTranslation()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const me = useQuery(api.users.getMe, { sessionToken })
  const subscriptionInfo = useQuery(api.users.getSubscriptionInfo, sessionToken ? { sessionToken } : 'skip')
  const progress = useQuery(api.users.getTrialProgress, sessionToken ? { sessionToken } : 'skip')
  // backlog/R17 — the featured-post add-on line's numbers (effectiveInteractionCap needs the plan cap).
  const tierLimits = useQuery(api.posts.getTierLimits, {})
  // backlog/R19 — invited members get 14 days; every "7-day" string reads this instead.
  const trialDays = me?.trialDays ?? TRIAL_PERIOD_DAYS
  const createCheckout = useAction(api.billingNode.createCheckoutSession)
  // Moved out of `billing.ts` (B07): the portal session must name a per-tier configuration, which the
  // Stripe component's helper cannot do, so every member's portal home offered every plan.
  const createPortal = useAction(api.billingNode.createPortalSession)
  const createPlanSwitch = useAction(api.billingNode.createPlanSwitchSession)
  const clearBillingNotice = useMutation(api.users.clearBillingNotice)
  const resumeSubscription = useAction(api.billingNode.resumeSubscription)
  const undoDowngrade = useAction(api.billingNode.undoScheduledDowngrade)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [resumeLoading, setResumeLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  // R07 — celebrate activation. Stripe redirects here as /billing?success=true. `justSubscribed`
  // latches that read (adjusting state during render, not an effect — see React's "you might not
  // need an effect" guidance) so it survives the param being stripped a moment later.
  const [justSubscribed, setJustSubscribed] = useState(false)
  if (!justSubscribed && searchParams.get('success') === 'true') {
    setJustSubscribed(true)
  }

  // R09 — Stripe's cancel flow returns here as /billing?canceled=true. Same latch pattern as
  // justSubscribed; the event fires once the webhook has flipped cancelAtPeriodEnd. The "already
  // fired" guard is a ref (not state): it only gates a side effect, never render output, and a
  // useState setter called synchronously in this effect trips react-hooks/set-state-in-effect.
  const [justCanceled, setJustCanceled] = useState(false)
  if (!justCanceled && searchParams.get('canceled') === 'true') {
    setJustCanceled(true)
  }
  const cancelTrackedRef = useRef(false)
  useEffect(() => {
    if (!justCanceled || !me || cancelTrackedRef.current || !subscriptionInfo?.cancelAtPeriodEnd) return
    cancelTrackedRef.current = true
    captureEvent('cancel_completed', { plan: me.tier ?? 'starter' })
    setSearchParams({}, { replace: true })
  }, [justCanceled, subscriptionInfo?.cancelAtPeriodEnd, me, setSearchParams])

  // R20 — the cap email's one link lands here as /billing?plan=…&interval=…&src=cap_email. Same
  // ref latch as cancel_completed: one event per landing, not one per StrictMode double effect.
  const capEmailTrackedRef = useRef(false)
  useEffect(() => {
    if (searchParams.get('src') !== 'cap_email' || capEmailTrackedRef.current) return
    capEmailTrackedRef.current = true
    captureEvent('cap_email_billing_opened', { plan: resolveTargetPlan(searchParams) })
  }, [searchParams])

  const [celebrationOpen, setCelebrationOpen] = useState(false)
  const [hasCelebrated, setHasCelebrated] = useState(false)
  const [activationTimedOut, setActivationTimedOut] = useState(false)
  // The member's first post is hidden only until the webhook flips their status — by the time the
  // celebration can show, it may already be unhidden, so `hasHiddenPost` alone can already read
  // false on the very first render (the query loses the race with the webhook entirely, not just
  // between renders — a per-render latch on it can't help). `hasAnyPost` doesn't depend on winning
  // that race: any post they already had is now live, full stop, since every paid status unhides
  // (F3). Latch it anyway so a fast re-render (e.g. getMyPosts refetching) can't flicker it back off.
  const { hasAnyPost } = useOwnPostState(justSubscribed)
  const [hadAnyPost, setHadAnyPost] = useState(false)
  if (hasAnyPost && !hadAnyPost) {
    setHadAnyPost(true)
  }

  // "Activating" = we know a checkout just succeeded but the webhook hasn't flipped the status yet.
  // getMe is reactive, so this clears itself the moment the row updates — no polling. A `canceled`
  // member re-subscribing is activating too: their row reads `canceled` (not `none`) until the
  // webhook lands, and the repeat-trial guard in billingNode.ts sends them straight to `active`.
  const isResubscribing = me?.subscriptionStatus === 'canceled'
  const isActivating = justSubscribed && (me?.subscriptionStatus === 'none' || isResubscribing)
  const activatingKey = activationTimedOut
    ? 'billing.activatingTimeout'
    : isResubscribing
      ? 'billing.activatingPlan'
      : 'billing.activating'

  useEffect(() => {
    if (!isActivating) return
    const timer = window.setTimeout(() => {
      setActivationTimedOut(true)
      // A genuinely lost webhook must be visible to us, even though the member never sees the word.
      captureException(new Error('Checkout activation timed out: subscriptionStatus not card-backed after 20s'))
    }, ACTIVATION_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [isActivating])

  // Open the celebration once, the moment the status becomes card-backed. `hasCelebrated` latches
  // so dismissing it (celebrationOpen -> false) never lets this reopen it.
  // Only the two statuses a checkout webhook can land on count as "you're in" — `past_due` is a
  // failed charge and `canceled` is the re-subscriber's pre-flip state, not an activation.
  const activated = me?.subscriptionStatus === 'trialing' || me?.subscriptionStatus === 'active'
  if (!hasCelebrated && justSubscribed && activated) {
    setHasCelebrated(true)
    setCelebrationOpen(true)
  }

  // Strip the URL param only once the celebration has actually fired (F4) — stripping it on mount
  // instead would lose `success=true` for good if the member refreshes during the activation
  // window (before hasCelebrated flips): a fresh mount only re-latches `justSubscribed` by reading
  // that same param, so an early strip means a refresh mid-activation drops the celebration forever.
  useEffect(() => {
    if (hasCelebrated && searchParams.get('success') === 'true') {
      setSearchParams({}, { replace: true })
    }
  }, [hasCelebrated, searchParams, setSearchParams])
  // The visitor already chose a plan AND an interval on the landing page (carried through OAuth
  // into sessionStorage by AuthSuccessPage, or passed directly as ?plan=&interval=). Re-asking is
  // re-opening a decision they already made. Both are read the same way — the URL first, then the
  // stash — so a direct link honours both. Growth / annual stay the fallbacks for anyone arriving cold.
  const targetPlan = resolveTargetPlan(searchParams)
  const chosenPlan =
    isPlanId(searchParams.get('plan')) || isPlanId(sessionStorage.getItem('chosenPlan')) ? targetPlan : null
  // `null` = nothing picked yet, so the grid can follow the interval the member is already billed on.
  const [pickedInterval, setPickedInterval] = useState<Interval | null>(() => {
    const intervalParam = searchParams.get('interval')
    const stashedInterval = sessionStorage.getItem('chosenInterval')
    return isInterval(intervalParam) ? intervalParam : isInterval(stashedInterval) ? stashedInterval : null
  })
  const [showAllPlans, setShowAllPlans] = useState(false)

  // The interval Stripe really bills this member on, off the price snapshot on their subscription
  // row; null until the webhook row has caught up, and for anyone without one.
  const liveInterval: Interval | null =
    subscriptionInfo?.priceInterval === 'month'
      ? 'monthly'
      : subscriptionInfo?.priceInterval === 'year'
        ? 'annual'
        : null
  // The plan-grid toggle: what the member picked (URL, landing stash, or a click), else the interval
  // they are billed on — a monthly member comparing plans must not be quoted annual prices — else
  // annual for anyone arriving cold. Derived, not synced, so a click made before the row arrives is
  // never overwritten by it.
  const billingInterval: Interval = pickedInterval ?? liveInterval ?? 'annual'
  // What Stripe will really bill: the row, never the toggle (which is only where the member is
  // looking). Falls back to the toggle only while the row has not caught up.
  const chargedInterval: Interval = liveInterval ?? billingInterval
  // The amount itself is Stripe's own, off the same snapshot; the client table is only the fallback
  // until the webhook row has caught up.
  const chargedPrice =
    formatPriceLabel(resolveBillingLocale(i18n.language), {
      amount: subscriptionInfo?.priceAmount,
      currency: subscriptionInfo?.priceCurrency,
      interval: subscriptionInfo?.priceInterval
    }) ||
    PLAN_PRICES[chargedInterval][me?.tier ?? 'growth'] ||
    ''

  const isTrialing = me?.subscriptionStatus === 'trialing'
  const trialEndsAt = me?.trialEndsAt
  // Date.now() in render is intentional: a trial-expiry comparison that is stale by at most one
  // render. The directive below comes and goes with whether the React Compiler manages to analyze
  // this component at all (R18's `planId` closure was enough to flip it back on) — and ESLint fails
  // the build on unused directives, so if lint ever calls it unused, delete it again.
  // eslint-disable-next-line react-hooks/purity -- intentional: stale-by-one-render expiry check
  const isTrialExpired = isTrialing && !!trialEndsAt && trialEndsAt <= Date.now()
  const isExpired = me?.subscriptionStatus === 'canceled' || me?.subscriptionStatus === 'none' || isTrialExpired
  // "Ended" = a subscription that actually stopped (canceled or trial ran out). Excludes brand-new users
  // (status 'none'), for whom "your subscription has ended" is wrong — they get the plan-selection lead instead.
  const isEnded = me?.subscriptionStatus === 'canceled' || isTrialExpired
  const trialDaysRemaining = isTrialing ? getTrialDaysRemaining(trialEndsAt) : 0

  // A "card holder" is anyone Stripe is currently managing: they switch plans in the Customer
  // Portal, never through a second checkout. 'canceled' is deliberately excluded — a canceled
  // member re-subscribes through checkout (without a trial, enforced server-side).
  // NB: keyed on status, not stripeCustomerId — toSafeMe (convex/users.ts) strips that field.
  const hasCard =
    me?.subscriptionStatus === 'trialing' ||
    me?.subscriptionStatus === 'active' ||
    me?.subscriptionStatus === 'past_due'

  // One trial per account, forever (billingNode.createCheckoutSession). `!hasCard` covers BOTH a
  // brand-new visitor and a returning member who already spent theirs, so every trial promise on
  // this page has to ask the server, not the status: getMe answers from the subscription-row count,
  // the same rule checkout enforces. Optimistic while `me` loads — the majority case is a new
  // visitor, and this whole block already renders on the same optimistic assumption.
  const canTrial = me?.trialEligible !== false

  // backlog/R17 — the featured-post add-on line under the plan grid: same eligibility as the
  // purchase itself (lib/access.canEngage), nothing to sell to an unlimited tier. A canceled member
  // is excluded on top of canEngage (A2): assertCanEngage lets them buy server-side — they're still
  // inside their paid window — but a $5 feature for a post that leaves the feed once that window
  // ends is a bad sale, so the UI says no even where the server would allow it.
  const addonTier: Tier = me?.tier ?? 'starter'
  const addonLimits = tierLimits?.[addonTier]
  const showAddon =
    !!me &&
    canEngage(me.subscriptionStatus) &&
    me.subscriptionStatus !== 'canceled' &&
    addonLimits !== undefined &&
    !isUnlimitedFeatured(addonLimits.featuredPerMonth)
  const starterLimits = tierLimits?.starter ?? DEFAULTS.starter

  // R08 / R20 — back from a portal confirm flow: /billing?switched=<tier>, the tier the server
  // resolved from the price on the button. Latched during render like `justSubscribed`, so it
  // survives the param being stripped. "Switching" until the webhook moves `me.tier` onto the plan;
  // then the event fires once (a ref latch, StrictMode-safe, like cancel_completed) and the param is
  // stripped — only then, so a refresh mid-wait re-latches from the URL (F4). A card-less member
  // ignores the marker: their default tier could otherwise "complete" a switch that never happened.
  // There is no downgrade counterpart: every cheaper-tier move is scheduled and never leaves the app
  // (§8), so `?downgraded=` is not produced and not read.
  const [landing, setLanding] = useState<PlanId | null>(null)
  const switchedParam = searchParams.get('switched')
  if (!landing && isPlanId(switchedParam)) setLanding(switchedParam)
  const switchedTo = landing
  const isSwitching = !!switchedTo && hasCard && me?.tier !== switchedTo
  const switched = !!switchedTo && hasCard && me?.tier === switchedTo
  const [switchTimedOut, setSwitchTimedOut] = useState(false)
  useEffect(() => {
    if (!isSwitching) return
    const timer = window.setTimeout(() => {
      setSwitchTimedOut(true)
      captureException(new Error('Plan switch timed out: tier not updated after 20s'))
    }, ACTIVATION_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [isSwitching])
  const switchTrackedRef = useRef(false)
  useEffect(() => {
    if (!landing || !switched || switchTrackedRef.current) return
    switchTrackedRef.current = true
    captureEvent('plan_switch_completed', { plan: landing })
    setSearchParams({}, { replace: true })
  }, [switched, landing, setSearchParams])

  // Renewal/access-end date for the Billing Info Card below — undefined for free/trial users
  // (no Stripe subscription row yet), so there's simply nothing to format.
  const periodEndDate =
    subscriptionInfo?.currentPeriodEnd != null
      ? new Date(subscriptionInfo.currentPeriodEnd).toLocaleDateString(i18n.language)
      : null

  // backlog/B07 — when the scheduled downgrade takes effect. Falls back to the renewal date: they
  // are the same instant when the schedule is written, and the mirror can lag by one webhook.
  const pendingDate =
    subscriptionInfo?.pendingAt != null
      ? new Date(subscriptionInfo.pendingAt).toLocaleDateString(i18n.language)
      : periodEndDate

  // Derived label shown next to "Current plan:" — lead with X/50 when trialing
  const planLabel = (() => {
    if (isTrialing && !isTrialExpired) {
      const combined = progress?.combined ?? 0
      const threshold = progress?.threshold ?? 50
      return `${t('billing.freeTrial')} · ${combined}/${threshold} ${t('billing.trialProgress', { combined, threshold })} · ${t('billing.daysRemaining', { count: trialDaysRemaining })}`
    }
    if (isExpired) return t('billing.none')
    // The localized plan name, never the raw tier id (`contact` is "Enterprise" / "Empresa").
    if (me?.tier) return t(`billing.plans.${me.tier}.name`)
    return '...'
  })()

  async function handleUpgrade(planId: string, priceId: string) {
    try {
      if (!sessionToken) throw new Error(t('auth.notSignedIn'))
      // R18: the card-entry step, so the survival panel can tell a card-gate leak from an activation leak.
      captureEvent('checkout_started', { plan: planId, interval: billingInterval })
      const result = await createCheckout({ priceId, sessionToken, locale: i18n.language.slice(0, 2) })
      if (result?.url) {
        // Consume the landing's choice so a later visit in this tab does not re-nudge.
        sessionStorage.removeItem('chosenPlan')
        sessionStorage.removeItem('chosenInterval')
        // eslint-disable-next-line react-hooks/immutability -- a browser redirect, not a React mutation
        window.location.href = result.url
      }
    } catch (err: unknown) {
      const message = friendlyError(err, String(err))
      // The server refuses a second live subscription. That is a door, not a failure: open it.
      if (message.startsWith('ALREADY_SUBSCRIBED')) {
        toast(t('billing.alreadySubscribed'))
        await handleManageSubscription()
        return
      }
      toast(t('billing.checkoutFailed', { error: message }))
    }
  }

  // Card holders switch plans in the portal; everyone else checks out.
  function handlePlanClick(planId: string, priceId: string) {
    if (hasCard) {
      // The portal path never fires checkout_started, so this is the card holder's click — the step
      // after the R20 email's landing, tagged with where they came from.
      captureEvent('plan_switch_opened', {
        plan: planId,
        source: searchParams.get('src') === 'cap_email' ? 'cap_email' : 'billing'
      })
      return void handlePlanSwitch(priceId, planId)
    }
    return void handleUpgrade(planId, priceId)
  }

  async function handleManageSubscription() {
    if (!sessionToken) return
    setPortalLoading(true)
    try {
      const result = await createPortal({ sessionToken })
      // eslint-disable-next-line react-hooks/immutability -- a browser redirect, not a React mutation
      if (result?.url) window.location.href = result.url
    } catch (err: unknown) {
      toast(t('billing.portalFailed', { error: friendlyError(err, String(err)) }))
    } finally {
      setPortalLoading(false)
    }
  }

  // Lands the member on Stripe's confirmation for the price on the button they clicked (R08, and the
  // R20 email's landing). A cheaper tier returns NO url: it was scheduled for the period end
  // (backlog/B07), so there is nothing to redirect to and nothing to wait for — which is also why a
  // downgrade never reaches the `?switched=` landing above, or its 20-second Sentry report. Whatever
  // else stops the deep link — the price not yet allowed in the Customer Portal, the plan they are
  // already on — still opens the portal home: a door, never a dead end. The two refusals that name a
  // fix say it instead, because the portal cannot apply either one.
  async function handlePlanSwitch(priceId: string, planId: string) {
    if (!sessionToken) return
    setPortalLoading(true)
    try {
      const result = await createPlanSwitch({ sessionToken, priceId })
      // eslint-disable-next-line react-hooks/immutability -- a browser redirect, not a React mutation
      if (result?.url) window.location.href = result.url
      else {
        captureEvent('downgrade_scheduled', { from: me?.tier ?? 'starter', to: planId })
        // Plan only, no date: pendingAt reaches this component a beat later, through the query.
        toast(t('billing.pendingScheduled', { plan: t(`billing.plans.${planId}.name`) }))
      }
    } catch (err: unknown) {
      const message = friendlyError(err, String(err))
      if (message.startsWith('PENDING_DOWNGRADE')) return void toast(t('billing.pendingUndoFirst'))
      if (message.startsWith('CANCEL_PENDING')) return void toast(t('billing.pendingResumeFirst'))
      // The grid disables its buttons during a trial, so this only lands from a stale tab. Saying so
      // beats the portal home, which cannot change a trial's plan either.
      if (message.startsWith('TRIAL_NO_SWITCH')) return void toast(t('billing.trialNoSwitch'))
      await handleManageSubscription()
    } finally {
      setPortalLoading(false)
    }
  }

  async function handleResume() {
    if (!sessionToken) return
    setResumeLoading(true)
    try {
      await resumeSubscription({ sessionToken })
      toast(t('billing.cancel.resumed'))
    } catch (err: unknown) {
      toast(t('billing.cancel.resumeFailed', { error: friendlyError(err, String(err)) }))
    } finally {
      setResumeLoading(false)
    }
  }

  // backlog/B07 — cancel the scheduled cross-tier downgrade. The webhook clears the mirror on our
  // row, so the cell disappears reactively and nothing is returned. Idempotent server-side.
  async function handleUndoDowngrade() {
    if (!sessionToken) return
    setResumeLoading(true)
    try {
      await undoDowngrade({ sessionToken })
      toast(t('billing.pendingKept'))
    } catch (err: unknown) {
      toast(t('billing.cancel.resumeFailed', { error: friendlyError(err, String(err)) }))
    } finally {
      setResumeLoading(false)
    }
  }

  const lead = `${t('billing.currentPlan')}: ${planLabel}`

  // The escape valve under a webhook-wait notice (R07 activation, R08 plan switch) if it never lands.
  const manageButton = (
    <Button
      variant="outline"
      onClick={handleManageSubscription}
      disabled={portalLoading}
      className={`mt-3 text-[13px] ${portalLoading ? 'cursor-wait' : 'cursor-pointer'}`}
    >
      {portalLoading ? '...' : t('billing.manageSubscription')}
    </Button>
  )

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 font-sans">
      <PageHeader
        title={t('billing.title')}
        lead={lead}
      />

      {/* R07 — waiting for the webhook after a successful checkout. Never blames the member, never
          says "webhook"; the Manage button is the escape valve if it never lands. */}
      {isActivating && (
        <div className="border-border bg-muted mb-6 rounded-xl border p-4 text-sm">
          <p className="m-0">{t(activatingKey)}</p>
          {activationTimedOut && manageButton}
        </div>
      )}

      {/* R08 / R20 — back from the plan-switch confirm flow. One line while the webhook moves the
          tier, one line naming the plan once it has; the Manage button is the escape valve. */}
      {switchedTo && (isSwitching || switched) && (
        <div
          className={`mb-6 rounded-xl border p-4 text-sm ${
            switched ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-muted'
          }`}
        >
          <p className="m-0">
            {t(switched ? 'billing.switched' : switchTimedOut ? 'billing.switchTimeout' : 'billing.switching', {
              plan: t(`billing.plans.${switchedTo}.name`)
            })}
          </p>
          {isSwitching && switchTimedOut && manageButton}
        </div>
      )}

      {/* Billing Info Card — shown to every card holder, so a trialing or past_due member can
          reach the Customer Portal (and cancel) at all. */}
      {subscriptionInfo && hasCard && (
        <div className="border-border bg-muted mb-6 rounded-xl border p-5">
          <h2 className="text-foreground mt-0 mb-3 text-base font-bold">{t('billing.subscriptionInfo')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-muted-foreground m-0 text-xs">{t('billing.status')}</p>
              <p className="text-foreground mt-1 text-sm font-semibold capitalize">{String(subscriptionInfo.status)}</p>
            </div>
            {(subscriptionInfo.cancelAtPeriodEnd || subscriptionInfo.pendingTier || periodEndDate) && (
              <div>
                <p className="text-muted-foreground m-0 text-xs">
                  {subscriptionInfo.cancelAtPeriodEnd
                    ? periodEndDate
                      ? t('billing.cancelsOn')
                      : t('billing.renewal')
                    : subscriptionInfo.pendingTier
                      ? t('billing.pendingChange')
                      : t('billing.nextBilling')}
                </p>
                <p
                  className={`mt-1 text-sm font-semibold ${subscriptionInfo.cancelAtPeriodEnd ? 'text-destructive' : 'text-foreground'}`}
                >
                  {subscriptionInfo.cancelAtPeriodEnd
                    ? periodEndDate
                      ? t('billing.accessUntil', { date: periodEndDate })
                      : t('billing.cancelPending')
                    : subscriptionInfo.pendingTier
                      ? t('billing.pendingFrom', {
                          plan: t(`billing.plans.${subscriptionInfo.pendingTier}.name`),
                          date: pendingDate
                        })
                      : t('billing.renewsOn', { date: periodEndDate })}
                </p>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Button
              variant="outline"
              onClick={handleManageSubscription}
              disabled={portalLoading}
              className={`text-[13px] ${portalLoading ? 'cursor-wait' : 'cursor-pointer'}`}
            >
              {portalLoading ? '...' : t('billing.manageSubscription')}
            </Button>
            {subscriptionInfo.cancelAtPeriodEnd ? (
              <Button
                onClick={handleResume}
                disabled={resumeLoading}
                aria-busy={resumeLoading}
                className="cursor-pointer text-[13px]"
              >
                {resumeLoading ? '...' : t('billing.cancel.resume')}
              </Button>
            ) : (
              <>
                {/* backlog/B07 — the undo for a scheduled downgrade. The cancel link stays reachable
                    beside it: createCancelFlowSession('cancel') releases the schedule first. */}
                {subscriptionInfo.pendingTier && (
                  <Button
                    onClick={handleUndoDowngrade}
                    disabled={resumeLoading}
                    aria-busy={resumeLoading}
                    className="cursor-pointer text-[13px]"
                  >
                    {resumeLoading ? '...' : t('billing.pendingKeep', { plan: t(`billing.plans.${me?.tier}.name`) })}
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => setCancelOpen(true)}
                  className="text-muted-foreground min-h-10 text-[13px] underline-offset-4 hover:underline"
                >
                  {t('billing.cancel.link')}
                </button>
              </>
            )}
          </div>
          {subscriptionInfo.cancelAtPeriodEnd && periodEndDate ? (
            <p className="text-muted-foreground mt-2 mb-0 text-xs">
              {t('billing.cancel.postsLeave', { date: periodEndDate })}
            </p>
          ) : subscriptionInfo.pendingTier ? (
            <p className="text-muted-foreground mt-2 mb-0 text-xs">
              {t('billing.pendingUntil', { plan: t(`billing.plans.${me?.tier}.name`) })}
            </p>
          ) : null}
        </div>
      )}

      {/* A voided duplicate subscription is never silent — see convex/http.ts. */}
      {me?.billingNotice === 'duplicate_canceled' && (
        <div className="border-border bg-muted mb-6 flex items-start justify-between gap-3 rounded-xl border p-4 text-sm">
          <p className="m-0">{t('billing.duplicateCanceledNotice')}</p>
          <Button
            variant="outline"
            className="shrink-0 text-[12px]"
            onClick={() => sessionToken && void clearBillingNotice({ sessionToken })}
          >
            {t('billing.dismiss')}
          </Button>
        </div>
      )}

      {/* Trial banner — accent while there is room, amber-emphasised from 40 of 50 (information,
          not alarm). There is no `warning` colour token: the Badge `warning` variant resolves to
          bg-accent/text-accent-foreground, and the emphasis pattern is the gold --primary border
          already used by ChangeTierModal. */}
      {isTrialing && !isTrialExpired && (
        <div
          className={`mb-6 rounded-xl border p-4 text-sm ${
            progress?.nearThreshold
              ? 'border-primary bg-accent text-accent-foreground'
              : 'border-border bg-accent text-accent-foreground'
          }`}
        >
          <p className="m-0">
            ⏳{' '}
            {progress?.nearThreshold
              ? t('billing.nearThresholdBanner', {
                  remaining: Math.max(0, progress.threshold - progress.combined),
                  plan: t(`billing.plans.${me?.tier ?? 'growth'}.name`),
                  price: chargedPrice
                })
              : t(trialEndsAt ? 'billing.trialBanner' : 'billing.trialBannerNoDate', {
                  plan: t(`billing.plans.${me?.tier ?? 'growth'}.name`),
                  threshold: progress?.threshold ?? TRIAL_INTERACTION_THRESHOLD,
                  days: trialDays,
                  date: trialEndsAt ? new Date(trialEndsAt).toLocaleDateString(i18n.language) : undefined
                })}
          </p>
          {/* X/50 interaction progress meter */}
          {progress != null && <TrialMeter progress={progress} />}
        </div>
      )}

      {/* Ended (canceled / trial-expired) banner — NOT shown to brand-new users */}
      {isEnded && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mb-6 rounded-xl border p-4 text-sm">
          🔒 {t('billing.expiredBanner')}
        </div>
      )}

      {/* New / no-card users — lead with the decision the visitor already made on the landing page */}
      {!hasCard && (
        <div className="mb-4">
          <p className="text-foreground text-base font-semibold">
            {!chosenPlan
              ? t('billing.newUserLead')
              : canTrial
                ? t('billing.chosenPlanLead', { plan: t(`billing.plans.${targetPlan}.name`) })
                : t('billing.noTrialChosenPlanLead', { plan: t(`billing.plans.${targetPlan}.name`) })}
          </p>
          <p className="text-muted-foreground mt-1 text-[13px]">
            {canTrial
              ? t('billing.newUserTrialNote', { days: trialDays, threshold: TRIAL_INTERACTION_THRESHOLD })
              : t('billing.noTrialNote')}
          </p>
          {/* backlog/R19 — a statement of fact, not a CTA: they were given a longer trial, and this
              says so without claiming it has already started. Gated on `canTrial` like every other
              trial promise on this page: the gift is only true while a trial is still coming. */}
          {me?.inviterName && canTrial && (
            <p className="text-muted-foreground mt-1 text-[13px]">
              {t('billing.giftFrom', { name: me.inviterName, days: trialDays, base: TRIAL_PERIOD_DAYS })}
            </p>
          )}
        </div>
      )}

      {/* Monthly / Annual toggle — always visible */}
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border p-1 text-sm">
        <button
          onClick={() => setPickedInterval('annual')}
          className={`rounded-full px-3 py-1 ${billingInterval === 'annual' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
        >
          {t('billing.annual')}
        </button>
        <button
          onClick={() => setPickedInterval('monthly')}
          className={`rounded-full px-3 py-1 ${billingInterval === 'monthly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
        >
          {t('billing.monthly')}
        </button>
      </div>

      {/* Pre-card: one plan, one decision. The full grid (and the Pro/Enterprise anchor that makes
          Growth look cheap) stays one click away. Card holders always see the grid — a member
          switching plans needs the comparison. */}
      {!hasCard && (
        <button
          onClick={() => setShowAllPlans(v => !v)}
          className="text-muted-foreground hover:text-foreground mb-3 text-[13px] underline"
        >
          {showAllPlans ? t('billing.hideAllPlans') : t('billing.seeAllPlans')}
        </button>
      )}

      {/* Plan grid — Enterprise sits outside the map, so it stays visible in both layouts */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        {(hasCard || showAllPlans ? PLAN_IDS : PLAN_IDS.filter(p => p === targetPlan)).map(planId => {
          // "Current plan" badge for any card-backed subscriber on this tier, trialing included since
          // 2026-09-09: a trial runs on the plan it started on, so that plan IS current. It used to be
          // withheld while trialing only so the Switch button showed instead, and that switch no
          // longer exists. Guarding on hasCard stops a brand-new user's default tier being mislabeled.
          const isCurrent = hasCard && me?.tier === planId
          // Nudge new / no-card users toward the plan they chose, without hiding the other plans. A card
          // holder sent here by an upgrade-at-the-limit link (`?plan=` in the URL, R08) gets the same
          // highlight on the plan they came for — never on the plan they're already on.
          const isRecommended = planId === targetPlan && !isCurrent && (!hasCard || isPlanId(searchParams.get('plan')))
          const priceId = PLAN_PRICE_IDS[billingInterval][planId]
          const showWhatYouLlMiss = isTrialing && planId === 'starter'
          const features = t(`billing.plans.${planId}.features`, { returnObjects: true }) as unknown as string[]
          return (
            <div
              key={planId}
              className={`relative flex h-full flex-col rounded-xl p-5 ${
                isCurrent
                  ? 'border-primary bg-accent border-2'
                  : isRecommended
                    ? 'border-primary bg-card border-2'
                    : 'border-border bg-card border'
              }`}
            >
              {isRecommended && (
                <Badge
                  variant="primary"
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2"
                >
                  {t(chosenPlan ? 'billing.selected' : 'billing.recommended')}
                </Badge>
              )}
              <h2 className="text-foreground mt-0 text-lg font-bold">{t(`billing.plans.${planId}.name`)}</h2>
              <p className="text-foreground my-2 text-2xl font-bold">{PLAN_PRICES[billingInterval][planId]}</p>
              <p className="text-muted-foreground mb-4 text-[13px]">{t(`billing.plans.${planId}.description`)}</p>
              {Array.isArray(features) && (
                <ul className="text-muted-foreground mb-5 space-y-2 text-[13px]">
                  {features.map(f => (
                    <li
                      key={f}
                      className="flex items-start gap-2"
                    >
                      <span className="text-primary mt-0.5 flex-shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
              )}
              {/* "What you'll miss" loss-framing for Starter when trialing */}
              {showWhatYouLlMiss && (
                <div className="border-destructive/30 bg-destructive/10 text-destructive mb-3 rounded-lg border p-3 text-[12px]">
                  {t('billing.whatYouLlMiss')}
                </div>
              )}
              {isCurrent ? (
                <div className="mt-auto flex justify-center">
                  <Badge variant="warning">{t('billing.currentPlanLabel')}</Badge>
                </div>
              ) : (
                <Button
                  onClick={() => priceId && handlePlanClick(planId, priceId)}
                  disabled={!priceId || portalLoading || isTrialing}
                  className={`mt-auto w-full text-[13px] ${priceId && !isTrialing ? 'cursor-pointer opacity-100' : 'cursor-not-allowed opacity-60'}`}
                >
                  {/* A trial cannot change plan (product rule, 2026-09-09) — convert early, cancel, or
                      let it run out. The member's own tier shows the "current plan" badge instead of
                      reaching this branch at all, so this labels the plans they are not on. */}
                  {isTrialing
                    ? t('billing.trialNoSwitch')
                    : hasCard
                      ? t('billing.switchPlan', { plan: t(`billing.plans.${planId}.name`) })
                      : canTrial
                        ? t('billing.startTrialCta', { plan: t(`billing.plans.${planId}.name`) })
                        : t('billing.noTrialCta', { plan: t(`billing.plans.${planId}.name`) })}
                </Button>
              )}
            </div>
          )
        })}

        {/* Enterprise / Contact */}
        <div className="border-border bg-card flex h-full flex-col rounded-xl border p-5">
          <h2 className="text-foreground mt-0 text-lg font-bold">{t('billing.plans.contact.name')}</h2>
          <p className="text-foreground my-2 text-2xl font-bold">{t('billing.customPrice')}</p>
          <p className="text-muted-foreground mb-4 text-[13px]">{t('billing.plans.contact.description')}</p>
          <Button
            variant="outline"
            className="mt-auto self-start"
            asChild
          >
            <a href={`mailto:${SUPPORT_EMAIL}`}>{t('billing.plans.contact.cta')}</a>
          </Button>
        </div>
      </div>

      {/* Upgrade (the grid above) first, add-on second — never instead of a plan. */}
      {showAddon && addonLimits && (
        <p className="text-muted-foreground mt-6 text-[13px]">
          {t('billing.featuredAddon', {
            price: FEATURED_POST_PRICE,
            newCap: effectiveInteractionCap(addonLimits.interactionsPerPost, FEATURED_CAP_BONUS[addonTier])
          })}{' '}
          <Link
            to="/my-posts?feature=buy"
            className="text-primary hover:underline"
          >
            {t('billing.featuredAddonCta')}
          </Link>
        </p>
      )}

      <p className="text-muted-foreground mt-6 text-[13px]">
        {t('billing.enterprise')}{' '}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="text-primary hover:underline"
        >
          {SUPPORT_EMAIL}
        </a>
      </p>

      <CheckoutSuccessDialog
        open={celebrationOpen}
        onOpenChange={setCelebrationOpen}
        plan={me?.tier ?? targetPlan}
        isTrial={me?.subscriptionStatus === 'trialing'}
        showPostLive={hadAnyPost && me?.subscriptionStatus === 'trialing'}
      />

      <CancelInterstitial
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        tier={me?.tier ?? 'starter'}
        isTrialing={isTrialing}
        periodEndDate={periodEndDate}
        pendingTier={subscriptionInfo?.pendingTier}
        starterPrice={PLAN_PRICES[chargedInterval].starter}
        starterInteractions={starterLimits.interactionsPerPost}
        starterPosts={starterLimits.postsPerWeek}
      />
    </div>
  )
}
