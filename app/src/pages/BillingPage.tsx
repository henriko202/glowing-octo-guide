import { useState } from 'react'
import { useAction, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import { SUPPORT_EMAIL } from '@/lib/support'
import { friendlyError } from '@/lib/errors'

const PLAN_IDS = ['starter', 'growth', 'pro'] as const

type Interval = 'monthly' | 'annual'

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

const PLAN_PRICES: Record<Interval, Record<string, string>> = {
  monthly: { starter: '$5/mo', growth: '$15/mo', pro: '$50/mo' },
  annual: { starter: '$50/yr', growth: '$150/yr', pro: '$500/yr' }
}

function getTrialDaysRemaining(trialEndsAt: number | undefined): number {
  if (!trialEndsAt) return 0
  return Math.max(0, Math.ceil((trialEndsAt - Date.now()) / (1000 * 60 * 60 * 24)))
}

export default function BillingPage() {
  const { t } = useTranslation()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const me = useQuery(api.users.getMe, { sessionToken })
  const subscriptionInfo = useQuery(api.users.getSubscriptionInfo, sessionToken ? { sessionToken } : 'skip')
  const progress = useQuery(api.users.getTrialProgress, sessionToken ? { sessionToken } : 'skip')
  const createCheckout = useAction(api.billingNode.createCheckoutSession)
  const createPortal = useAction(api.billing.createPortalSession)
  const [portalLoading, setPortalLoading] = useState(false)
  // NB: named setBillingInterval (not setInterval) so it doesn't shadow the global timer API.
  const [billingInterval, setBillingInterval] = useState<Interval>(
    () => (sessionStorage.getItem('chosenInterval') as Interval | null) ?? 'annual'
  )

  const isTrialing = me?.subscriptionStatus === 'trialing'
  const trialEndsAt = me?.trialEndsAt
  // eslint-disable-next-line react-hooks/purity -- intentional: Date.now() used for trial-expiry comparison; stale-by-one-render is acceptable
  const isTrialExpired = isTrialing && !!trialEndsAt && trialEndsAt <= Date.now()
  const isExpired = me?.subscriptionStatus === 'canceled' || me?.subscriptionStatus === 'none' || isTrialExpired
  // "Ended" = a subscription that actually stopped (canceled or trial ran out). Excludes brand-new users
  // (status 'none'), for whom "your subscription has ended" is wrong — they get the plan-selection lead instead.
  const isEnded = me?.subscriptionStatus === 'canceled' || isTrialExpired
  const trialDaysRemaining = isTrialing ? getTrialDaysRemaining(trialEndsAt) : 0

  // A user "has a card" if they are trialing or active — these are the only card-backed states.
  const hasCard = me?.subscriptionStatus === 'trialing' || me?.subscriptionStatus === 'active'

  // Renewal/access-end date for the Billing Info Card below — undefined for free/trial users
  // (no Stripe subscription row yet), so there's simply nothing to format.
  const periodEndDate =
    subscriptionInfo?.currentPeriodEnd != null ? new Date(subscriptionInfo.currentPeriodEnd).toLocaleDateString() : null

  // Derived label shown next to "Current plan:" — lead with X/50 when trialing
  const planLabel = (() => {
    if (isTrialing && !isTrialExpired) {
      const combined = progress?.combined ?? 0
      const threshold = progress?.threshold ?? 50
      return `${t('billing.freeTrial')} · ${combined}/${threshold} ${t('billing.trialProgress', { combined, threshold })} · ${t('billing.daysRemaining', { count: trialDaysRemaining })}`
    }
    if (isExpired) return t('billing.none')
    if (me?.tier) return me.tier.charAt(0).toUpperCase() + me.tier.slice(1)
    return '...'
  })()

  async function handleUpgrade(priceId: string) {
    try {
      if (!sessionToken) throw new Error(t('auth.notSignedIn'))
      const result = await createCheckout({ priceId, sessionToken })
      if (result?.url) window.location.href = result.url
    } catch (err: unknown) {
      toast(t('billing.checkoutFailed', { error: friendlyError(err, String(err)) }))
    }
  }

  async function handleManageSubscription() {
    if (!sessionToken) return
    setPortalLoading(true)
    try {
      const result = await createPortal({ sessionToken })
      if (result?.url) window.location.href = result.url
    } catch (err: unknown) {
      toast(t('billing.portalFailed', { error: friendlyError(err, String(err)) }))
    } finally {
      setPortalLoading(false)
    }
  }

  const lead = `${t('billing.currentPlan')}: ${planLabel}`

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 font-sans">
      <PageHeader
        title={t('billing.title')}
        lead={lead}
      />

      {/* Billing Info Card — shown for active subscribers */}
      {subscriptionInfo && me?.subscriptionStatus === 'active' && (
        <div className="border-border bg-muted mb-6 rounded-xl border p-5">
          <h2 className="text-foreground mt-0 mb-3 text-base font-bold">{t('billing.subscriptionInfo')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-muted-foreground m-0 text-xs">{t('billing.status')}</p>
              <p className="text-foreground mt-1 text-sm font-semibold capitalize">{String(subscriptionInfo.status)}</p>
            </div>
            {(subscriptionInfo.cancelAtPeriodEnd || periodEndDate) && (
              <div>
                <p className="text-muted-foreground m-0 text-xs">
                  {subscriptionInfo.cancelAtPeriodEnd
                    ? periodEndDate
                      ? t('billing.cancelsOn')
                      : t('billing.renewal')
                    : t('billing.nextBilling')}
                </p>
                <p
                  className={`mt-1 text-sm font-semibold ${subscriptionInfo.cancelAtPeriodEnd ? 'text-destructive' : 'text-foreground'}`}
                >
                  {subscriptionInfo.cancelAtPeriodEnd
                    ? periodEndDate
                      ? t('billing.accessUntil', { date: periodEndDate })
                      : t('billing.cancelPending')
                    : t('billing.renewsOn', { date: periodEndDate })}
                </p>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            onClick={handleManageSubscription}
            disabled={portalLoading}
            className={`mt-4 text-[13px] ${portalLoading ? 'cursor-wait' : 'cursor-pointer'}`}
          >
            {portalLoading ? '...' : t('billing.manageSubscription')}
          </Button>
        </div>
      )}

      {/* Trial banner — shown when actively trialing */}
      {isTrialing && !isTrialExpired && (
        <div className="border-border bg-accent text-accent-foreground mb-6 rounded-xl border p-4 text-sm">
          <p className="m-0">⏳ {t('billing.trialBanner')}</p>
          {/* X/50 interaction progress meter */}
          {progress != null && (
            <div className="mt-3">
              <p className="text-accent-foreground/80 mb-1.5 text-xs font-medium">
                {t('billing.trialProgress', {
                  combined: progress.combined,
                  threshold: progress.threshold
                })}
              </p>
              <div className="bg-accent-foreground/20 h-2 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary h-2 rounded-full transition-[width]"
                  style={{
                    width: `${Math.min(100, Math.round((progress.combined / progress.threshold) * 100))}%`
                  }}
                />
              </div>
            </div>
          )}
          {/* SSI link-out */}
          <a
            href="https://linkedin.com/sales/ssi"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary mt-3 inline-flex items-center gap-1 text-xs hover:underline"
          >
            {t('billing.ssiLink')} ↗
          </a>
        </div>
      )}

      {/* Ended (canceled / trial-expired) banner — NOT shown to brand-new users */}
      {isEnded && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mb-6 rounded-xl border p-4 text-sm">
          🔒 {t('billing.expiredBanner')}
        </div>
      )}

      {/* New / no-card users — plan-selection lead (push toward Growth without limiting to it) */}
      {!hasCard && (
        <div className="mb-4">
          <p className="text-foreground text-base font-semibold">{t('billing.newUserLead')}</p>
          <p className="text-muted-foreground mt-1 text-[13px]">{t('billing.newUserTrialNote')}</p>
        </div>
      )}

      {/* Monthly / Annual toggle — always visible */}
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border p-1 text-sm">
        <button
          onClick={() => setBillingInterval('annual')}
          className={`rounded-full px-3 py-1 ${billingInterval === 'annual' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
        >
          {t('billing.annual')}
        </button>
        <button
          onClick={() => setBillingInterval('monthly')}
          className={`rounded-full px-3 py-1 ${billingInterval === 'monthly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
        >
          {t('billing.monthly')}
        </button>
      </div>

      {/* Plan grid — 3 plans + Enterprise, shown to everyone (new, trialing, active) */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        {PLAN_IDS.map(planId => {
          // "Current plan" badge only for a card-backed, non-trialing (i.e. active) subscriber on this tier.
          // Guarding on hasCard stops a brand-new user's default tier from being mislabeled as current.
          const isCurrent = hasCard && me?.tier === planId && me?.subscriptionStatus !== 'trialing'
          // Nudge new / no-card users toward Growth without hiding the other plans.
          const isRecommended = planId === 'growth' && !hasCard
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
                  {t('billing.recommended')}
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
                  onClick={() => priceId && handleUpgrade(priceId)}
                  disabled={!priceId}
                  className={`mt-auto w-full text-[13px] ${priceId ? 'cursor-pointer opacity-100' : 'cursor-not-allowed opacity-60'}`}
                >
                  {t(`billing.plans.${planId}.cta`)}
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

      <p className="text-muted-foreground mt-6 text-[13px]">
        {t('billing.enterprise')}{' '}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="text-primary hover:underline"
        >
          {SUPPORT_EMAIL}
        </a>
      </p>
    </div>
  )
}
