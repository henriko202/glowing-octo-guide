'use client'

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { formatPrice, planPrice, trialHref, validReferral, type BillingInterval } from '@/lib/trial'
import type { Dictionary } from '@/i18n/getDictionary'
import type { Locale } from '@/i18n/config'

const TrialContext = createContext<{
  interval: BillingInterval
  setInterval: (interval: BillingInterval) => void
  referral: string | null
} | null>(null)

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener('popstate', callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener('popstate', callback)
  }
}

function readReferral() {
  const fromUrl = validReferral(new URLSearchParams(window.location.search).get('ref'))
  if (fromUrl) return fromUrl
  try {
    return validReferral(sessionStorage.getItem('ref'))
  } catch {
    return null
  }
}

export default function TrialProvider({ children }: { children: ReactNode }) {
  const [interval, setInterval] = useState<BillingInterval>('annual')
  const pathname = usePathname()
  const referral = useSyncExternalStore(subscribe, readReferral, () => null)
  useEffect(() => {
    if (referral) {
      try {
        sessionStorage.setItem('ref', referral)
      } catch {
        /* URL referrals still work without storage. */
      }
    }
  }, [referral, pathname])
  return <TrialContext.Provider value={{ interval, setInterval, referral }}>{children}</TrialContext.Provider>
}

export function useTrial() {
  const context = useContext(TrialContext)
  if (!context) throw new Error('Trial components require TrialProvider')
  return context
}

export function TrialLink({
  plan = 'growth',
  children,
  className
}: {
  plan?: string
  children: ReactNode
  className?: string
}) {
  const { interval, referral } = useTrial()
  return (
    <a
      href={trialHref(plan, interval, referral)}
      className={className}
    >
      {children}
    </a>
  )
}

export function SelectedOffer({ dict, lang }: { dict: Dictionary['trialOffer']; lang: Locale }) {
  const { interval } = useTrial()
  const price = formatPrice(planPrice('growth', interval), lang)
  return <p className="text-sm font-medium text-cream">{dict[interval].replace('{{price}}', price)}</p>
}
