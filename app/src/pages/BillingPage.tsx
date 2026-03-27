import { useState } from 'react'
import { useAction, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import type { Id } from '../../../convex/_generated/dataModel'
import { api } from '../convex'

const PLAN_IDS = ['starter', 'growth', 'pro'] as const

const PLAN_PRICE_IDS: Record<string, string | undefined> = {
  starter: import.meta.env.VITE_STRIPE_STARTER_PRICE_ID as string | undefined,
  growth: import.meta.env.VITE_STRIPE_GROWTH_PRICE_ID as string | undefined,
  pro: import.meta.env.VITE_STRIPE_PRO_PRICE_ID as string | undefined
}

const PLAN_PRICES: Record<string, string> = {
  starter: '$5/mo',
  growth: '$15/mo',
  pro: '$50/mo'
}

function getTrialDaysRemaining(trialEndsAt: number | undefined): number {
  if (!trialEndsAt) return 0
  return Math.max(0, Math.ceil((trialEndsAt - Date.now()) / (1000 * 60 * 60 * 24)))
}

export default function BillingPage() {
  const { t } = useTranslation()
  const userId = (sessionStorage.getItem('convexUserId') ?? undefined) as Id<'users'> | undefined
  const me = useQuery(api.users.getMe, { userId })
  const subscriptionInfo = useQuery(api.users.getSubscriptionInfo, userId ? { userId } : 'skip')
  const createCheckout = useAction(api.billing.createCheckoutSession)
  const createPortal = useAction(api.billing.createPortalSession)
  const [portalLoading, setPortalLoading] = useState(false)

  const isTrialing = me?.subscriptionStatus === 'trialing'
  const trialEndsAt = me?.trialEndsAt
  const isTrialExpired = isTrialing && !!trialEndsAt && trialEndsAt <= Date.now()
  const isExpired = me?.subscriptionStatus === 'canceled' || me?.subscriptionStatus === 'none' || isTrialExpired
  const trialDaysRemaining = isTrialing ? getTrialDaysRemaining(trialEndsAt) : 0

  // Derived label shown next to "Current plan:"
  const planLabel =
    isTrialing && !isTrialExpired
      ? `${t('billing.freeTrial')} (${t('billing.daysRemaining', { count: trialDaysRemaining })})`
      : isExpired
        ? t('billing.none')
        : (me?.tier ?? '...')

  async function handleUpgrade(priceId: string) {
    try {
      if (!userId) throw new Error('Not signed in')
      const result = await createCheckout({ priceId, userId })
      if (result?.url) window.location.href = result.url
    } catch (err: unknown) {
      alert(`Checkout failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function handleManageSubscription() {
    if (!userId) return
    setPortalLoading(true)
    try {
      const result = await createPortal({ userId })
      if (result?.url) window.location.href = result.url
    } catch (err: unknown) {
      alert(`Failed to open portal: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 font-sans">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">{t('billing.title')}</h1>
      <p className="mb-6 text-sm text-slate-500">
        {t('billing.currentPlan')}: <strong className="capitalize">{planLabel}</strong>
      </p>

      {/* Billing Info Card — shown for active subscribers */}
      {subscriptionInfo && me?.subscriptionStatus === 'active' && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="mb-3 mt-0 text-base font-bold text-slate-900">{t('billing.subscriptionInfo')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="m-0 text-xs text-slate-500">{t('billing.status')}</p>
              <p className="mt-1 text-sm font-semibold capitalize text-slate-900">{String(subscriptionInfo.status)}</p>
            </div>
            {(subscriptionInfo as { cancelAtPeriodEnd?: boolean }).cancelAtPeriodEnd && (
              <div>
                <p className="m-0 text-xs text-slate-500">{t('billing.cancelsOn')}</p>
                <p className="mt-1 text-sm font-semibold text-red-500">{t('billing.endOfPeriod')}</p>
              </div>
            )}
          </div>
          <button
            onClick={handleManageSubscription}
            disabled={portalLoading}
            className={`mt-4 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-[13px] font-semibold text-slate-900 ${portalLoading ? 'cursor-wait' : 'cursor-pointer'}`}
          >
            {portalLoading ? '...' : t('billing.manageSubscription')}
          </button>
        </div>
      )}

      {/* Trial banner */}
      {isTrialing && !isTrialExpired && (
        <div className="mb-6 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-amber-800">
          ⏳ {t('billing.trialBanner')}
        </div>
      )}

      {/* Expired / canceled banner */}
      {isExpired && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          🔒 {t('billing.expiredBanner')}
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        {PLAN_IDS.map(planId => {
          // Trialing users on starter should see the Subscribe button (they haven't paid yet)
          const isCurrent = me?.tier === planId && me?.subscriptionStatus !== 'trialing'
          const priceId = PLAN_PRICE_IDS[planId]
          return (
            <div
              key={planId}
              className={`rounded-xl p-5 ${isCurrent ? 'border-2 border-blue-600 bg-blue-50' : 'border border-slate-200 bg-white'}`}
            >
              <h2 className="mt-0 text-lg font-bold text-slate-900">{t(`billing.plans.${planId}.name`)}</h2>
              <p className="my-2 text-2xl font-bold text-slate-900">{PLAN_PRICES[planId]}</p>
              <p className="mb-4 text-[13px] text-slate-500">{t(`billing.plans.${planId}.description`)}</p>
              {isCurrent ? (
                <p className="text-center text-[13px] font-semibold text-blue-600">{t('billing.currentPlanLabel')}</p>
              ) : (
                <button
                  onClick={() => priceId && handleUpgrade(priceId)}
                  disabled={!priceId}
                  className={`w-full rounded-lg border-none bg-blue-600 py-2.5 text-[13px] font-semibold text-white ${priceId ? 'cursor-pointer opacity-100' : 'cursor-not-allowed opacity-60'}`}
                >
                  {t(`billing.plans.${planId}.cta`)}
                </button>
              )}
            </div>
          )
        })}

        {/* Enterprise / Contact */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mt-0 text-lg font-bold text-slate-900">{t('billing.plans.contact.name')}</h2>
          <p className="my-2 text-2xl font-bold text-slate-900">Custom</p>
          <p className="mb-4 text-[13px] text-slate-500">{t('billing.plans.contact.description')}</p>
          <a
            href="mailto:hello@linkintothessi.com"
            className="block rounded-lg border border-slate-200 py-2.5 text-center text-[13px] font-semibold text-slate-900 no-underline"
          >
            {t('billing.plans.contact.cta')}
          </a>
        </div>
      </div>
      <p className="mt-6 text-[13px] text-slate-400">{t('billing.enterprise')}</p>
    </div>
  )
}
