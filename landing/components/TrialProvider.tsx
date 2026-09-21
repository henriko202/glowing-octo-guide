'use client'

import { createContext, type ReactNode, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { type BillingInterval, formatPrice, loginHref, planPrice, trialHref, validReferral } from '@/lib/trial'
import { type CtaPlacement, trackLandingEvent } from '@/lib/metrics'
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

const TRIAL_STARTED_KEY = 'trialStarted'

function readTrialStarted(): boolean {
  try {
    return localStorage.getItem(TRIAL_STARTED_KEY) === '1'
  } catch {
    return false
  }
}

function markTrialStarted() {
  try {
    localStorage.setItem(TRIAL_STARTED_KEY, '1')
  } catch {
    /* Storage-unavailable browsers still navigate; only the label swap is lost. */
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
  placement,
  children,
  className
}: {
  plan?: string
  placement: CtaPlacement
  children: ReactNode
  className?: string
}) {
  const { interval, referral } = useTrial()
  return (
    <a
      href={trialHref(plan, interval, referral)}
      onClick={() => {
        markTrialStarted()
        trackLandingEvent(`cta_click_${placement}`)
      }}
      className={className}
    >
      {children}
    </a>
  )
}

// The primary slots live here so Hero and FinalCTA stay server components. The server snapshot is
// false, so the prerendered HTML keeps the trial CTA and the stored flag swaps in after hydration.
export function PrimaryCta({
  placement,
  className,
  loginLabel,
  children
}: {
  placement: CtaPlacement
  className: string
  loginLabel: string
  children: ReactNode
}) {
  const { referral } = useTrial()
  const trialStarted = useSyncExternalStore(subscribe, readTrialStarted, () => false)
  // The trial state stays TrialLink's job, so the click side effects (flag + beacon) have one owner.
  if (!trialStarted) {
    return (
      <TrialLink
        placement={placement}
        className={className}
      >
        {children}
      </TrialLink>
    )
  }
  return (
    <a
      href={loginHref(referral)}
      onClick={() => trackLandingEvent(`cta_click_${placement}`)}
      className={className}
    >
      {loginLabel}
    </a>
  )
}

export function SelectedOffer({ dict, lang }: { dict: Dictionary['trialOffer']; lang: Locale }) {
  const { interval } = useTrial()
  const price = formatPrice(planPrice('starter', interval), lang)
  return <p className="text-sm font-medium text-cream">{dict[interval].replace('{{price}}', price)}</p>
}
