import { useState } from 'react'
import { useAction, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

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
  const createCheckout = useAction(api.billingNode.createCheckoutSession)
  const createPortal = useAction(api.billing.createPortalSession)
  const [portalLoading, setPortalLoading] = useState(false)
  const [interval, setInterval] = useState<Interval>('annual') // default annual

  const isTrialing = me?.subscriptionStatus === 'trialing'
  const trialEndsAt = me?.trialEndsAt
  // eslint-disable-next-line react-hooks/purity -- intentional: Date.now() used for trial-expiry comparison; stale-by-one-render is acceptable
  const isTrialExpired = isTrialing && !!trialEndsAt && trialEndsAt <= Date.now()
  const isExpired = me?.subscriptionStatus === 'canceled' || me?.subscriptionStatus === 'none' || isTrialExpired
  const trialDaysRemaining = isTrialing ? getTrialDaysRemaining(trialEndsAt) : 0

  // Derived label shown next to "Current plan:"
  const planLabel =
    isTrialing && !isTrialExpired
      ? `${t('billing.freeTrial')} (${t('billing.daysRemaining', { count: trialDaysRemaining })})`
      : isExpired
        ? t('billing.none')
        : me?.tier
          ? me.tier.charAt(0).toUpperCase() + me.tier.slice(1)
          : '...'

  async function handleUpgrade(priceId: string) {
    try {
      if (!sessionToken) throw new Error('Not signed in')
      const result = await createCheckout({ priceId, sessionToken })
      if (result?.url) window.location.href = result.url
    } catch (err: unknown) {
      alert(`Checkout failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function handleManageSubscription() {
    if (!sessionToken) return
    setPortalLoading(true)
    try {
      const result = await createPortal({ sessionToken })
      if (result?.url) window.location.href = result.url
    } catch (err: unknown) {
      alert(`Failed to open portal: ${err instanceof Error ? err.message : String(err)}`)
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
          <h2 className="text-foreground mb-3 mt-0 text-base font-bold">{t('billing.subscriptionInfo')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-muted-foreground m-0 text-xs">{t('billing.status')}</p>
              <p className="text-foreground mt-1 text-sm font-semibold capitalize">{String(subscriptionInfo.status)}</p>
            </div>
            {(subscriptionInfo as { cancelAtPeriodEnd?: boolean }).cancelAtPeriodEnd && (
              <div>
                <p className="text-muted-foreground m-0 text-xs">{t('billing.cancelsOn')}</p>
                <p className="text-destructive mt-1 text-sm font-semibold">{t('billing.endOfPeriod')}</p>
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

      {/* Trial banner */}
      {isTrialing && !isTrialExpired && (
        <div className="border-border bg-accent text-accent-foreground mb-6 rounded-xl border p-4 text-sm">
          ⏳ {t('billing.trialBanner')}
        </div>
      )}

      {/* Expired / canceled banner */}
      {isExpired && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mb-6 rounded-xl border p-4 text-sm">
          🔒 {t('billing.expiredBanner')}
        </div>
      )}

      <div className="mb-4 inline-flex items-center gap-2 rounded-full border p-1 text-sm">
        <button
          onClick={() => setInterval('annual')}
          className={`rounded-full px-3 py-1 ${interval === 'annual' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
        >
          {t('billing.annual')}
        </button>
        <button
          onClick={() => setInterval('monthly')}
          className={`rounded-full px-3 py-1 ${interval === 'monthly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
        >
          {t('billing.monthly')}
        </button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        {PLAN_IDS.map(planId => {
          // Trialing users on starter should see the Subscribe button (they haven't paid yet)
          const isCurrent = me?.tier === planId && me?.subscriptionStatus !== 'trialing'
          const priceId = PLAN_PRICE_IDS[interval][planId]
          return (
            <div
              key={planId}
              className={`rounded-xl p-5 ${isCurrent ? 'border-primary bg-accent border-2' : 'border-border bg-card border'}`}
            >
              <h2 className="text-foreground mt-0 text-lg font-bold">{t(`billing.plans.${planId}.name`)}</h2>
              <p className="text-foreground my-2 text-2xl font-bold">{PLAN_PRICES[interval][planId]}</p>
              <p className="text-muted-foreground mb-4 text-[13px]">{t(`billing.plans.${planId}.description`)}</p>
              {isCurrent ? (
                <div className="flex justify-center">
                  <Badge variant="warning">{t('billing.currentPlanLabel')}</Badge>
                </div>
              ) : (
                <Button
                  onClick={() => priceId && handleUpgrade(priceId)}
                  disabled={!priceId}
                  className={`w-full text-[13px] ${priceId ? 'cursor-pointer opacity-100' : 'cursor-not-allowed opacity-60'}`}
                >
                  {t(`billing.plans.${planId}.cta`)}
                </Button>
              )}
            </div>
          )
        })}

        {/* Enterprise / Contact */}
        <div className="border-border bg-card rounded-xl border p-5">
          <h2 className="text-foreground mt-0 text-lg font-bold">{t('billing.plans.contact.name')}</h2>
          <p className="text-foreground my-2 text-2xl font-bold">Custom</p>
          <p className="text-muted-foreground mb-4 text-[13px]">{t('billing.plans.contact.description')}</p>
          <Button
            variant="outline"
            asChild
          >
            <a href="mailto:hello@linkintothessi.com">{t('billing.plans.contact.cta')}</a>
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground mt-6 text-[13px]">{t('billing.enterprise')}</p>
    </div>
  )
}
