import { useQuery, useAction } from 'convex/react'
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

export default function BillingPage() {
  const { t } = useTranslation()
  const userId = (sessionStorage.getItem('convexUserId') ?? undefined) as Id<'users'> | undefined
  const me = useQuery(api.users.getMe, { userId })
  const createCheckout = useAction(api.billing.createCheckoutSession)

  async function handleUpgrade(priceId: string) {
    try {
      if (!userId) throw new Error('Not signed in')
      const result = await createCheckout({ priceId, userId })
      if (result?.url) window.location.href = result.url
    } catch (err: unknown) {
      alert(`Checkout failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>{t('billing.title')}</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>
        {t('billing.currentPlan')}: <strong style={{ textTransform: 'capitalize' }}>{me?.tier ?? '...'}</strong>
        {me?.subscriptionStatus === 'trialing' && ` ${t('billing.trial')}`}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {PLAN_IDS.map(planId => {
          const isCurrent = me?.tier === planId
          const priceId = PLAN_PRICE_IDS[planId]
          return (
            <div
              key={planId}
              style={{
                border: isCurrent ? '2px solid #2563eb' : '1px solid #e2e8f0',
                borderRadius: 12,
                padding: 20,
                background: isCurrent ? '#eff6ff' : '#fff'
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 0 }}>
                {t(`billing.plans.${planId}.name`)}
              </h2>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: '8px 0 8px' }}>
                {PLAN_PRICES[planId]}
              </p>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
                {t(`billing.plans.${planId}.description`)}
              </p>
              {isCurrent ? (
                <p style={{ color: '#2563eb', fontWeight: 600, fontSize: 13, textAlign: 'center' }}>
                  {t('billing.currentPlanLabel')}
                </p>
              ) : (
                <button
                  onClick={() => priceId && handleUpgrade(priceId)}
                  disabled={!priceId}
                  style={{
                    width: '100%',
                    padding: '10px 0',
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: priceId ? 'pointer' : 'not-allowed',
                    opacity: priceId ? 1 : 0.6
                  }}
                >
                  {t(`billing.plans.${planId}.cta`)}
                </button>
              )}
            </div>
          )
        })}

        {/* Enterprise / Contact */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, background: '#fff' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 0 }}>
            {t('billing.plans.contact.name')}
          </h2>
          <p style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: '8px 0 8px' }}>Custom</p>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>{t('billing.plans.contact.description')}</p>
          <a
            href="mailto:hello@linkintothessi.com"
            style={{
              display: 'block',
              textAlign: 'center',
              padding: '10px 0',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              color: '#0f172a',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none'
            }}
          >
            {t('billing.plans.contact.cta')}
          </a>
        </div>
      </div>
      <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 24 }}>{t('billing.enterprise')}</p>
    </div>
  )
}
