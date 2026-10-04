'use client'

import { createContext, type ReactNode, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { type BillingInterval, loginHref, trialHref, validReferral } from '@/lib/trial'
import { type CtaPlacement, trackLandingEvent } from '@/lib/metrics'

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
  interval: fixedInterval,
  placement,
  children,
  className
}: {
  plan?: string
  // Overrides the toggle: an offer that exists on one interval only must always link to it.
  interval?: BillingInterval
  placement: CtaPlacement
  children: ReactNode
  className?: string
}) {
  const { interval, referral } = useTrial()
  return (
    <a
      href={trialHref(plan, fixedInterval ?? interval, referral)}
      onClick={() => trackLandingEvent(`cta_click_${placement}`)}
      className={className}
    >
      {children}
    </a>
  )
}

// The primary slots (hero, nav, final, guide) always log in; only the pricing cards start a trial.
// A client component so Hero and FinalCTA stay server components while the referral rides along.
export function LoginLink({
  placement,
  className,
  children
}: {
  placement: CtaPlacement
  className: string
  children: ReactNode
}) {
  const { referral } = useTrial()
  return (
    <a
      href={loginHref(referral)}
      onClick={() => trackLandingEvent(`cta_click_${placement}`)}
      className={className}
    >
      {children}
    </a>
  )
}
