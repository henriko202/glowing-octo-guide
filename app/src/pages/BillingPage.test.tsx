// app/src/pages/BillingPage.test.tsx
import { StrictMode, type ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

// PLAN_PRICE_IDS is read from import.meta.env at BillingPage module scope, and the real values
// only exist in a developer's gitignored app/.env.local. Stub them before the module is imported
// (vi.hoisted runs above the imports) so the plan buttons are enabled in CI too.
vi.hoisted(() => {
  for (const plan of ['STARTER', 'GROWTH', 'PRO']) {
    vi.stubEnv(`VITE_STRIPE_${plan}_PRICE_ID`, `price_${plan.toLowerCase()}_month`)
    vi.stubEnv(`VITE_STRIPE_${plan}_ANNUAL_PRICE_ID`, `price_${plan.toLowerCase()}_year`)
  }
})

// Stable string refs so the useQuery/useAction mocks can dispatch by WHICH function was asked for.
vi.mock('../convex', () => ({
  api: {
    users: {
      getMe: 'users.getMe',
      getSubscriptionInfo: 'users.getSubscriptionInfo',
      getTrialProgress: 'users.getTrialProgress',
      clearBillingNotice: 'users.clearBillingNotice'
    },
    billing: { createPortalSession: 'billing.createPortalSession' },
    billingNode: {
      createCheckoutSession: 'billingNode.createCheckoutSession',
      createCancelFlowSession: 'billingNode.createCancelFlowSession',
      createPlanSwitchSession: 'billingNode.createPlanSwitchSession',
      resumeSubscription: 'billingNode.resumeSubscription'
    },
    interactions: { getRecap: 'interactions.getRecap' },
    feedback: { feedback: { submitFeedback: 'feedback.feedback.submitFeedback' } },
    // CardGateBanner's useOwnPostState (reused for the R07 "post is live" line) reads this.
    posts: { getMyPosts: 'posts.getMyPosts' }
  }
}))

let mockQueryReturns: Record<string, unknown> = {}
const mockCheckout = vi.fn(async () => ({ url: '' }))
const mockPortal = vi.fn(async () => ({ url: '' }))
const mockResume = vi.fn(async () => null)
const mockCancelFlow = vi.fn(async () => ({ url: '' }))
const mockSwitch = vi.fn(async () => ({ url: '' }))
const ACTIONS: Record<string, unknown> = {
  'billing.createPortalSession': mockPortal,
  'billingNode.resumeSubscription': mockResume,
  'billingNode.createCancelFlowSession': mockCancelFlow,
  'billingNode.createPlanSwitchSession': mockSwitch
}

vi.mock('convex/react', () => ({
  useQuery: vi.fn((ref: string) => mockQueryReturns[ref]),
  useAction: vi.fn((ref: string) => ACTIONS[ref] ?? mockCheckout),
  useMutation: vi.fn(() => vi.fn(async () => {}))
}))
vi.mock('@/lib/observability/analytics', () => ({ captureEvent: vi.fn() }))

// useSearchParams is mocked (not the real router) so tests can assert the setter was called and
// drive the query string directly, the same mockSetSearchParams pattern as AdminPage.test.tsx:59.
// MemoryRouter is kept as a harmless passthrough so the existing <MemoryRouter> wrapper still works.
const mockSetSearchParams = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock('react-router-dom', () => ({
  MemoryRouter: ({ children }: { children: ReactNode }) => children,
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useSearchParams: () => [mockSearchParams, mockSetSearchParams]
}))

// Echo the key plus its interpolation so assertions can see both — except plan names, which
// resolve to the real localized label. That keeps the "never print a raw tier id" rule testable.
const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  growth: 'Growth',
  pro: 'Pro',
  contact: 'Enterprise'
}

// The R07 celebration/activating copy is asserted by its real English wording (not the raw key),
// so those two keys resolve to their actual copy here; everything else keeps echoing its key.
const REAL_COPY: Record<string, string> = {
  'billing.successTitle': "You're in.",
  'billing.activating': 'Activating your trial…'
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => {
      if (REAL_COPY[k]) return REAL_COPY[k]
      const planName = /^billing\.plans\.(\w+)\.name$/.exec(k)
      if (planName) return PLAN_LABELS[planName[1]] ?? k
      return o && !('returnObjects' in o) ? `${k}:${JSON.stringify(o)}` : k
    },
    i18n: { language: 'en' }
  })
}))

import { captureEvent } from '@/lib/observability/analytics'
import BillingPage from './BillingPage'

function setUser(over: Record<string, unknown> = {}) {
  mockQueryReturns['users.getMe'] = { _id: 'u1', tier: 'growth', subscriptionStatus: 'none', ...over }
}

// `strict` renders under React.StrictMode — the same wrapper app/src/main.tsx puts around the real
// app — so a run-once effect guard (e.g. cancelTrackedRef) is actually exercised: StrictMode
// double-invokes effects on mount, so a guard that isn't a genuine "already ran" latch shows up as a
// second call (I1).
function renderPage({ strict = false }: { strict?: boolean } = {}) {
  const tree = (
    <MemoryRouter>
      <BillingPage />
    </MemoryRouter>
  )
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree)
}

// For the R07 checkout-return tests: drives the mocked useSearchParams from a query string and the
// mocked getMe from `me`, in one call.
function renderBilling({
  search = '',
  me = {},
  strict = false
}: {
  search?: string
  me?: Record<string, unknown>
  strict?: boolean
} = {}) {
  mockSearchParams = new URLSearchParams(search)
  setUser(me)
  return renderPage({ strict })
}

beforeEach(() => {
  sessionStorage.clear()
  sessionStorage.setItem('sessionToken', 'tok')
  mockCheckout.mockClear()
  mockPortal.mockClear()
  mockResume.mockClear()
  mockCancelFlow.mockClear()
  mockSwitch.mockClear()
  vi.mocked(captureEvent).mockClear()
  mockSetSearchParams.mockClear()
  mockSearchParams = new URLSearchParams()
  mockQueryReturns = {
    'users.getSubscriptionInfo': { tier: 'growth', status: 'trialing', cancelAtPeriodEnd: false },
    'users.getTrialProgress': { made: 1, received: 1, combined: 2, threshold: 50, reached: false, nearThreshold: false }
  }
  setUser()
})

describe('plan click routing (R01)', () => {
  it('sends a pre-card member to checkout', async () => {
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: /billing\.startTrialCta/ })[0])
    await waitFor(() =>
      expect(mockCheckout).toHaveBeenCalledWith({
        priceId: 'price_growth_year',
        sessionToken: 'tok',
        locale: 'en'
      })
    )
    expect(mockPortal).not.toHaveBeenCalled()
  })

  it('deep-links a trialing card holder into the portal confirm flow for the price they clicked, never a second checkout', async () => {
    setUser({ subscriptionStatus: 'trialing' })
    renderPage()
    // A trialing member has no "current" card, so the first switch button is the first plan: starter.
    fireEvent.click(screen.getAllByRole('button', { name: /billing\.switchPlan/ })[0])
    await waitFor(() => expect(mockSwitch).toHaveBeenCalledWith({ sessionToken: 'tok', priceId: 'price_starter_year' }))
    expect(mockCheckout).not.toHaveBeenCalled()
    expect(mockPortal).not.toHaveBeenCalled()
  })

  it('falls back to the portal home when the deep link is refused', async () => {
    mockSwitch.mockRejectedValueOnce(new Error('ALREADY_ON_PLAN'))
    setUser({ subscriptionStatus: 'trialing' })
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: /billing\.switchPlan/ })[0])
    await waitFor(() => expect(mockPortal).toHaveBeenCalledWith({ sessionToken: 'tok' }))
    expect(mockCheckout).not.toHaveBeenCalled()
  })

  // R20: the cap email's link names the next plan and the member's charged interval; the confirm
  // flow must target exactly that price, not the page's annual default.
  it('targets the plan and interval the cap email named', async () => {
    renderBilling({ search: 'plan=pro&interval=monthly&src=cap_email', me: { subscriptionStatus: 'active' } })
    fireEvent.click(screen.getByRole('button', { name: /billing\.switchPlan.*Pro/ }))
    await waitFor(() => expect(mockSwitch).toHaveBeenCalledWith({ sessionToken: 'tok', priceId: 'price_pro_month' }))
  })

  it('opens the portal when the server refuses with ALREADY_SUBSCRIBED', async () => {
    mockCheckout.mockRejectedValueOnce(new Error('ALREADY_SUBSCRIBED: You already have a plan.'))
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: /billing\.startTrialCta/ })[0])
    await waitFor(() => expect(mockPortal).toHaveBeenCalled())
  })

  it('shows the Manage Subscription button to a trialing member', () => {
    setUser({ subscriptionStatus: 'trialing' })
    renderPage()
    expect(screen.getByRole('button', { name: 'billing.manageSubscription' })).toBeInTheDocument()
  })

  it('shows the Manage Subscription button to a past_due member', () => {
    setUser({ subscriptionStatus: 'past_due' })
    renderPage()
    expect(screen.getByRole('button', { name: 'billing.manageSubscription' })).toBeInTheDocument()
  })
})

describe('chosen plan (R03)', () => {
  it('follows sessionStorage.chosenPlan', () => {
    sessionStorage.setItem('chosenPlan', 'pro')
    renderPage()
    expect(screen.getByText(/billing\.chosenPlanLead.*Pro/)).toBeInTheDocument()
  })

  it('follows the ?plan= query parameter', () => {
    mockSearchParams = new URLSearchParams('?plan=starter')
    renderPage()
    expect(screen.getByText(/billing\.chosenPlanLead.*Starter/)).toBeInTheDocument()
  })

  it('falls back to growth with no stash and no query param', () => {
    renderPage()
    expect(screen.getByText('billing.newUserLead')).toBeInTheDocument()
  })

  it('shows only the chosen plan until the member asks for the rest', () => {
    sessionStorage.setItem('chosenPlan', 'pro')
    renderPage()
    expect(screen.queryByText('Starter')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'billing.seeAllPlans' }))
    expect(screen.getByText('Starter')).toBeInTheDocument()
  })

  it('follows ?interval= the same way as ?plan=, so a direct landing link honours both', () => {
    // The landing's Pricing links pass plan and interval together; a member arriving by direct
    // link (no OAuth stash) must land on the monthly price, not the annual default.
    mockSearchParams = new URLSearchParams('?plan=pro&interval=monthly')
    renderPage()
    expect(screen.getByText('$50/mo')).toBeInTheDocument()
    expect(screen.queryByText('$500/yr')).not.toBeInTheDocument()
  })

  it('seeds the toggle from the interval the member is already billed on', async () => {
    // A monthly Growth member comparing plans sees monthly prices, and "Switch to Pro" aims at the
    // monthly Pro price — not the annual default the toggle starts on for a cold arrival.
    setUser({ subscriptionStatus: 'active' })
    mockQueryReturns['users.getSubscriptionInfo'] = {
      tier: 'growth',
      status: 'active',
      cancelAtPeriodEnd: false,
      priceInterval: 'month'
    }
    renderPage()
    expect(screen.getByText('$50/mo')).toBeInTheDocument()
    expect(screen.queryByText('$500/yr')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /billing\.switchPlan.*Pro/ }))
    await waitFor(() => expect(mockSwitch).toHaveBeenCalledWith({ sessionToken: 'tok', priceId: 'price_pro_month' }))
  })

  it('lets a URL interval win over the billed one', () => {
    // The cap email and the upgrade link name an interval on purpose; the row never overrides it.
    setUser({ subscriptionStatus: 'active' })
    mockQueryReturns['users.getSubscriptionInfo'] = {
      tier: 'growth',
      status: 'active',
      cancelAtPeriodEnd: false,
      priceInterval: 'month'
    }
    mockSearchParams = new URLSearchParams('?plan=pro&interval=annual')
    renderPage()
    expect(screen.getByText('$500/yr')).toBeInTheDocument()
    expect(screen.queryByText('$50/mo')).not.toBeInTheDocument()
  })

  it('keeps a click made before the subscription row arrives', () => {
    // The row loads after first paint; a member who already tapped Monthly is not flipped back
    // to their annual row when it lands (the toggle is derived from the pick first, the row second).
    setUser({ subscriptionStatus: 'active' })
    mockQueryReturns['users.getSubscriptionInfo'] = undefined
    const { rerender } = renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'billing.monthly' }))
    expect(screen.getByText('$50/mo')).toBeInTheDocument()
    mockQueryReturns['users.getSubscriptionInfo'] = {
      tier: 'growth',
      status: 'active',
      cancelAtPeriodEnd: false,
      priceInterval: 'year'
    }
    rerender(
      <MemoryRouter>
        <BillingPage />
      </MemoryRouter>
    )
    expect(screen.getByText('$50/mo')).toBeInTheDocument()
    expect(screen.queryByText('$500/yr')).not.toBeInTheDocument()
  })

  it('shows the localized plan name as the current plan, never the capitalized tier id', () => {
    setUser({ subscriptionStatus: 'active', tier: 'contact' })
    renderPage()
    expect(screen.getByText(/billing\.currentPlan: Enterprise/)).toBeInTheDocument()
    expect(screen.queryByText(/Contact/)).not.toBeInTheDocument()
  })

  it('names the real tier in the trial banner, not always Growth', () => {
    setUser({ subscriptionStatus: 'trialing', tier: 'pro', trialEndsAt: Date.now() + 86400000 })
    renderPage()
    expect(screen.getByText(/billing\.trialBanner.*Pro/)).toBeInTheDocument()
  })

  // The banner states the trial's terms with the real threshold and the exact end date — never a
  // typed "50" or a relative "after 7 days" — and no longer links out to the SSI page, which sits
  // behind Sales Navigator (the sidebar keeps the one qualified link).
  it('states the threshold and the localized end date, with no SSI link-out', () => {
    const trialEndsAt = Date.now() + 86400000
    setUser({ subscriptionStatus: 'trialing', tier: 'pro', trialEndsAt })
    renderPage()
    const date = new Date(trialEndsAt).toLocaleDateString('en')
    expect(screen.getByText(new RegExp(`billing\\.trialBanner:.*"threshold":50.*${date}`))).toBeInTheDocument()
    expect(document.querySelector('a[href*="linkedin.com/sales/ssi"]')).toBeNull()
  })
})

describe('near-threshold state (R02)', () => {
  it('switches the banner to the amber near-threshold copy at 40 of 50', () => {
    setUser({ subscriptionStatus: 'trialing', trialEndsAt: Date.now() + 86400000 })
    mockQueryReturns['users.getTrialProgress'] = {
      made: 32,
      received: 8,
      combined: 40,
      threshold: 50,
      reached: false,
      nearThreshold: true
    }
    renderPage()
    // Names what is left, the plan and the price — never a countdown, never the raw tier id.
    const banner = screen.getByText(/billing\.nearThresholdBanner/)
    expect(banner).toHaveTextContent('"remaining":10')
    expect(banner).toHaveTextContent('"plan":"Growth"')
    expect(screen.queryByText(/billing\.trialBanner/)).not.toBeInTheDocument()
  })

  it('quotes the price for the interval Stripe will really bill, not the plan-grid toggle', () => {
    // The grid toggle defaults to 'annual'. A member actually on a monthly subscription must not be
    // shown "$150/yr" in the one banner whose job is to state what they are about to be charged.
    setUser({ subscriptionStatus: 'trialing', trialEndsAt: Date.now() + 86400000 })
    mockQueryReturns['users.getSubscriptionInfo'] = {
      tier: 'growth',
      status: 'trialing',
      cancelAtPeriodEnd: false,
      priceInterval: 'month'
    }
    mockQueryReturns['users.getTrialProgress'] = {
      made: 32,
      received: 8,
      combined: 40,
      threshold: 50,
      reached: false,
      nearThreshold: true
    }
    renderPage()
    const banner = screen.getByText(/billing\.nearThresholdBanner/)
    expect(banner).toHaveTextContent('$15/mo')
    expect(banner).not.toHaveTextContent('$150/yr')
  })

  it('quotes the annual price for an annual subscriber', () => {
    setUser({ subscriptionStatus: 'trialing', trialEndsAt: Date.now() + 86400000 })
    mockQueryReturns['users.getSubscriptionInfo'] = {
      tier: 'growth',
      status: 'trialing',
      cancelAtPeriodEnd: false,
      priceInterval: 'year'
    }
    mockQueryReturns['users.getTrialProgress'] = {
      made: 32,
      received: 8,
      combined: 40,
      threshold: 50,
      reached: false,
      nearThreshold: true
    }
    renderPage()
    expect(screen.getByText(/billing\.nearThresholdBanner/)).toHaveTextContent('$150/yr')
  })

  it("quotes Stripe's own amount once the subscription row carries the price snapshot", () => {
    setUser({ subscriptionStatus: 'trialing', trialEndsAt: Date.now() + 86400000 })
    mockQueryReturns['users.getSubscriptionInfo'] = {
      tier: 'growth',
      status: 'trialing',
      cancelAtPeriodEnd: false,
      priceInterval: 'month',
      // Deliberately not the client table's $15, to prove which source the banner reads.
      priceAmount: 1200,
      priceCurrency: 'usd'
    }
    mockQueryReturns['users.getTrialProgress'] = {
      made: 32,
      received: 8,
      combined: 40,
      threshold: 50,
      reached: false,
      nearThreshold: true
    }
    renderPage()
    const banner = screen.getByText(/billing\.nearThresholdBanner/)
    expect(banner).toHaveTextContent('$12 / month')
    expect(banner).not.toHaveTextContent('$15/mo')
  })

  it('stays on the plain accent banner below the threshold', () => {
    setUser({ subscriptionStatus: 'trialing', trialEndsAt: Date.now() + 86400000 })
    renderPage()
    expect(screen.getByText(/billing\.trialBanner/)).toBeInTheDocument()
    expect(screen.queryByText(/billing\.nearThresholdBanner/)).not.toBeInTheDocument()
  })
})

describe('duplicate notice', () => {
  it('renders the notice when the backend raised it', () => {
    setUser({ billingNotice: 'duplicate_canceled' })
    renderPage()
    expect(screen.getByText('billing.duplicateCanceledNotice')).toBeInTheDocument()
  })

  it('renders nothing when there is no notice', () => {
    renderPage()
    expect(screen.queryByText('billing.duplicateCanceledNotice')).not.toBeInTheDocument()
  })
})

describe('checkout-return celebration (R07)', () => {
  it('opens the celebration once when returning from checkout with the status already flipped', () => {
    renderBilling({ search: '?success=true', me: { subscriptionStatus: 'trialing', tier: 'growth' } })
    expect(screen.getByRole('dialog')).toHaveTextContent(/you're in/i)
    expect(mockSetSearchParams).toHaveBeenCalledWith({}, { replace: true })
  })

  it('shows the activating state while the webhook has not landed', () => {
    renderBilling({ search: '?success=true', me: { subscriptionStatus: 'none' } })
    expect(screen.getByText(/activating your trial/i)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('changes nothing on a plain visit', () => {
    renderBilling({ search: '', me: { subscriptionStatus: 'active' } })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  // F3: the webhook can unhide the member's post before this page's own getMyPosts query lands —
  // hasHiddenPost (the query's already-hidden flag) then reads false on the very first render, so a
  // per-render latch on it can never recover the "your post is live" line. hasAnyPost doesn't care
  // whether the post is still hidden at query time, only that they had one, so it survives the race.
  it('still reports the post as live when it was already unhidden by the time getMyPosts lands', () => {
    mockQueryReturns['posts.getMyPosts'] = [{ hidden: false }]
    renderBilling({ search: '?success=true', me: { subscriptionStatus: 'trialing', tier: 'growth' } })
    expect(screen.getByText('billing.successPostLive')).toBeInTheDocument()
  })

  // F4: stripping `success=true` on mount (instead of once the celebration has actually fired) lost
  // the celebration for good if the member refreshed mid-activation — a fresh mount only re-latches
  // justSubscribed by reading that same param, so an early strip means it's gone before the webhook
  // ever lands.
  it('does not strip the URL param while still activating (celebration has not fired yet)', () => {
    renderBilling({ search: '?success=true', me: { subscriptionStatus: 'none' } })
    expect(mockSetSearchParams).not.toHaveBeenCalled()
  })

  // A canceled member re-subscribing sits on `canceled` (not `none`) until the webhook lands, and
  // the repeat-trial guard (billingNode.ts) lands them on `active`, never `trialing`. So: no
  // premature "your trial is live" dialog while still canceled, the activating copy says "plan"
  // (they get no trial), and the real dialog names the plan — never a trial, never a first post
  // going live (a canceled member's posts were never hidden).
  it('treats a canceled re-subscriber as activating, then celebrates the plan (not a trial) once active', () => {
    mockQueryReturns['posts.getMyPosts'] = [{ hidden: false }]
    const { rerender } = renderBilling({
      search: '?success=true',
      me: { subscriptionStatus: 'canceled', tier: 'starter' }
    })
    expect(screen.getByText('billing.activatingPlan')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    setUser({ subscriptionStatus: 'active', tier: 'growth' })
    rerender(
      <MemoryRouter>
        <BillingPage />
      </MemoryRouter>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent(/billing\.successBodyActive/)
    expect(dialog).not.toHaveTextContent(/billing\.successBody:/)
    expect(dialog).not.toHaveTextContent('billing.successPostLive')
  })

  it('strips the URL param once the celebration actually fires, not before', () => {
    const { rerender } = renderBilling({ search: '?success=true', me: { subscriptionStatus: 'none' } })
    expect(mockSetSearchParams).not.toHaveBeenCalled()

    setUser({ subscriptionStatus: 'trialing', tier: 'growth' })
    rerender(
      <MemoryRouter>
        <BillingPage />
      </MemoryRouter>
    )
    expect(mockSetSearchParams).toHaveBeenCalledWith({}, { replace: true })
  })
})

// R08: an upgrade-at-the-limit link lands a card holder on /billing?plan=<next>. The plan they came
// for gets the same "Recommended" highlight a no-card visitor's chosen plan does — but only when the
// URL names one, never on a plain visit, and never on the plan they already hold.
describe('plan highlight for card holders (R08)', () => {
  it('highlights the plan a card holder was sent to by an upgrade link', () => {
    renderBilling({ search: '?plan=pro', me: { subscriptionStatus: 'active', tier: 'growth' } })
    expect(screen.getByText('billing.recommended')).toBeInTheDocument()
  })

  it('highlights nothing for a card holder arriving without a plan in the URL', () => {
    renderBilling({ search: '', me: { subscriptionStatus: 'active', tier: 'growth' } })
    expect(screen.queryByText('billing.recommended')).not.toBeInTheDocument()
  })

  it('never marks the plan a card holder already holds as recommended', () => {
    renderBilling({ search: '?plan=growth', me: { subscriptionStatus: 'active', tier: 'growth' } })
    expect(screen.queryByText('billing.recommended')).not.toBeInTheDocument()
  })
})

describe('activation timeout (Item B)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the timeout state once 20s pass with the webhook still not landed', () => {
    vi.useFakeTimers()
    renderBilling({ search: '?success=true', me: { subscriptionStatus: 'none' } })
    expect(screen.getByText(/activating your trial/i)).toBeInTheDocument()
    expect(screen.queryByText('billing.activatingTimeout')).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(20_000)
    })

    expect(screen.getByText('billing.activatingTimeout')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'billing.manageSubscription' })).toBeInTheDocument()
  })
})

describe('cancel + resume (R09)', () => {
  it('shows the cancel link for a card holder with nothing pending, and opens the interstitial only on click', () => {
    setUser({ subscriptionStatus: 'active' })
    renderPage()
    expect(screen.getByRole('button', { name: 'billing.cancel.link' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'billing.cancel.resume' })).not.toBeInTheDocument()
    expect(screen.queryByText('billing.cancel.title')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'billing.cancel.link' }))
    expect(screen.getByText('billing.cancel.title')).toBeInTheDocument()
  })

  it('swaps the link for Resume once a cancellation is pending and calls the action', async () => {
    mockQueryReturns['users.getSubscriptionInfo'] = {
      tier: 'growth',
      status: 'active',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: Date.now() + 5 * 86_400_000
    }
    setUser({ subscriptionStatus: 'active' })
    renderPage()
    expect(screen.queryByRole('button', { name: 'billing.cancel.link' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'billing.cancel.resume' }))
    await waitFor(() => expect(mockResume).toHaveBeenCalledWith({ sessionToken: 'tok' }))
    expect(screen.getByText(/billing\.cancel\.postsLeave/)).toBeInTheDocument()
  })

  it('?canceled=true fires cancel_completed exactly once under StrictMode, and strips the param once', async () => {
    mockQueryReturns['users.getSubscriptionInfo'] = { tier: 'growth', status: 'active', cancelAtPeriodEnd: true }
    renderBilling({
      search: 'canceled=true',
      me: { subscriptionStatus: 'active', tier: 'growth' },
      strict: true
    })
    await waitFor(() => expect(captureEvent).toHaveBeenCalledWith('cancel_completed', { plan: 'growth' }))
    expect(captureEvent).toHaveBeenCalledTimes(1)
    expect(mockSetSearchParams).toHaveBeenCalledTimes(1)
    expect(mockSetSearchParams).toHaveBeenCalledWith({}, { replace: true })
  })

  // M-1: getMe can still be undefined (loading) on the render where cancelAtPeriodEnd first flips
  // true. The guard must not latch cancelTrackedRef on that render, or the corrected re-fire once
  // getMe lands is blocked for good.
  it('does not fire cancel_completed while getMe is still loading', () => {
    mockQueryReturns['users.getSubscriptionInfo'] = { tier: 'growth', status: 'active', cancelAtPeriodEnd: true }
    mockQueryReturns['users.getMe'] = undefined
    mockSearchParams = new URLSearchParams('canceled=true')
    renderPage()
    expect(captureEvent).not.toHaveBeenCalled()
  })
})

// R18: one consent-gated event per checkout attempt, carrying the plan and the interval the price
// belongs to, fired right before the checkout call — never on the portal path.
describe('checkout_started (R18)', () => {
  it('fires once with the plan and the interval before checkout', async () => {
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: /billing\.startTrialCta/ })[0])
    await waitFor(() => expect(mockCheckout).toHaveBeenCalled())
    expect(captureEvent).toHaveBeenCalledWith('checkout_started', { plan: 'growth', interval: 'annual' })
    expect(captureEvent).toHaveBeenCalledTimes(1)
  })

  it('does not fire when a card holder is routed to the portal', async () => {
    setUser({ subscriptionStatus: 'trialing' })
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: /billing\.switchPlan/ })[0])
    await waitFor(() => expect(mockSwitch).toHaveBeenCalled())
    expect(captureEvent).not.toHaveBeenCalledWith('checkout_started', expect.anything())
  })
})

// R20 review: a card holder's click is the funnel step after the email's landing, and the portal
// path fires nothing else — without this the cap-email funnel ended at `cap_email_billing_opened`.
describe('plan_switch_opened', () => {
  it('fires with the plan and source "billing" when a card holder opens the portal from the page', async () => {
    setUser({ subscriptionStatus: 'trialing' })
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: /billing\.switchPlan/ })[0])
    await waitFor(() => expect(mockSwitch).toHaveBeenCalled())
    // A trialing member has no "current" card, so the first switch button is the first plan: starter.
    expect(captureEvent).toHaveBeenCalledWith('plan_switch_opened', { plan: 'starter', source: 'billing' })
  })

  it('tags the source "cap_email" when the post-cap email brought them here', async () => {
    renderBilling({ search: 'plan=growth&interval=annual&src=cap_email', me: { subscriptionStatus: 'active' } })
    fireEvent.click(screen.getAllByRole('button', { name: /billing\.switchPlan/ })[0])
    await waitFor(() => expect(mockSwitch).toHaveBeenCalled())
    expect(captureEvent).toHaveBeenCalledWith('plan_switch_opened', expect.objectContaining({ source: 'cap_email' }))
  })
})

// R08 / R20: the return leg of the plan-switch deep link. The page waits for the webhook to move the
// tier (the URL alone proves nothing), then names the plan and fires the funnel's last step exactly
// once. A card-less member's default tier must never "complete" a switch that never happened.
describe('plan switch landing (R08 / R20)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the switching state while the webhook has not moved the tier, and fires nothing', () => {
    renderBilling({ search: 'switched=pro', me: { subscriptionStatus: 'active', tier: 'growth' } })
    expect(screen.getByText(/billing\.switching:.*Pro/)).toBeInTheDocument()
    expect(screen.queryByText(/billing\.switched:/)).not.toBeInTheDocument()
    expect(captureEvent).not.toHaveBeenCalled()
    expect(mockSetSearchParams).not.toHaveBeenCalled()
  })

  it('fires plan_switch_completed exactly once under StrictMode once the tier matches, and strips the param', async () => {
    renderBilling({ search: 'switched=pro', me: { subscriptionStatus: 'active', tier: 'pro' }, strict: true })
    await waitFor(() => expect(captureEvent).toHaveBeenCalledWith('plan_switch_completed', { plan: 'pro' }))
    expect(captureEvent).toHaveBeenCalledTimes(1)
    expect(mockSetSearchParams).toHaveBeenCalledTimes(1)
    expect(mockSetSearchParams).toHaveBeenCalledWith({}, { replace: true })
    expect(screen.getByText(/billing\.switched:.*Pro/)).toBeInTheDocument()
  })

  it('flips from switching to switched when the webhook lands', async () => {
    const { rerender } = renderBilling({ search: 'switched=pro', me: { subscriptionStatus: 'active', tier: 'growth' } })
    expect(screen.getByText(/billing\.switching:/)).toBeInTheDocument()

    setUser({ subscriptionStatus: 'active', tier: 'pro' })
    rerender(
      <MemoryRouter>
        <BillingPage />
      </MemoryRouter>
    )
    expect(screen.getByText(/billing\.switched:.*Pro/)).toBeInTheDocument()
    await waitFor(() => expect(captureEvent).toHaveBeenCalledWith('plan_switch_completed', { plan: 'pro' }))
  })

  it('ignores the marker for a member without a card', () => {
    renderBilling({ search: 'switched=growth', me: { subscriptionStatus: 'none', tier: 'growth' } })
    expect(screen.queryByText(/billing\.switch(ing|ed):/)).not.toBeInTheDocument()
    expect(captureEvent).not.toHaveBeenCalled()
  })

  // R09: the cancel interstitial's "Move to Starter" returns as ?downgraded=<tier left behind> and
  // lands the same way — same copy, its own event, so the interstitial's save rate is one funnel
  // (cancel_alternative_taken → cancel_alternative_completed) that grid switches never touch.
  it('lands the Starter downgrade the same way and fires cancel_alternative_completed with the tier left behind', async () => {
    const { rerender } = renderBilling({
      search: 'downgraded=growth',
      me: { subscriptionStatus: 'active', tier: 'growth' }
    })
    expect(screen.getByText(/billing\.switching:.*Starter/)).toBeInTheDocument()
    expect(captureEvent).not.toHaveBeenCalled()

    setUser({ subscriptionStatus: 'active', tier: 'starter' })
    rerender(
      <MemoryRouter>
        <BillingPage />
      </MemoryRouter>
    )
    expect(screen.getByText(/billing\.switched:.*Starter/)).toBeInTheDocument()
    await waitFor(() => expect(captureEvent).toHaveBeenCalledWith('cancel_alternative_completed', { from: 'growth' }))
    expect(captureEvent).not.toHaveBeenCalledWith('plan_switch_completed', expect.anything())
    expect(mockSetSearchParams).toHaveBeenCalledWith({}, { replace: true })
  })

  it('ignores a downgrade marker that names no plan', () => {
    renderBilling({ search: 'downgraded=true', me: { subscriptionStatus: 'active', tier: 'starter' } })
    expect(screen.queryByText(/billing\.switch(ing|ed):/)).not.toBeInTheDocument()
    expect(captureEvent).not.toHaveBeenCalled()
  })

  it('offers the portal after 20s if the tier never moves', () => {
    vi.useFakeTimers()
    // No Billing Info Card, so the only Manage button on the page is the notice's escape valve.
    mockQueryReturns['users.getSubscriptionInfo'] = undefined
    renderBilling({ search: 'switched=pro', me: { subscriptionStatus: 'active', tier: 'growth' } })
    expect(screen.queryByText(/billing\.switchTimeout/)).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(20_000)
    })

    expect(screen.getByText(/billing\.switchTimeout/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'billing.manageSubscription' })).toBeInTheDocument()
  })
})

describe('cap email landing (R20)', () => {
  it('fires cap_email_billing_opened exactly once under StrictMode, tagged with the plan in the link', () => {
    renderBilling({ search: 'plan=growth&interval=annual&src=cap_email', strict: true })
    expect(captureEvent).toHaveBeenCalledTimes(1)
    expect(captureEvent).toHaveBeenCalledWith('cap_email_billing_opened', { plan: 'growth' })
  })

  it('fires nothing on a plain ?plan= visit', () => {
    renderBilling({ search: 'plan=growth' })
    expect(captureEvent).not.toHaveBeenCalled()
  })
})

describe('BillingPage invited member (R19)', () => {
  it('renders the gift line and 14-day copy for a member who joined through an invite', () => {
    setUser({ trialDays: 14, inviterName: 'Ana' })
    renderPage()
    expect(screen.getByText(/billing\.giftFrom:.*"name":"Ana".*"days":14/)).toBeInTheDocument()
    expect(screen.getByText(/billing\.newUserTrialNote:\{"days":14\}/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /billing\.startTrialCta:.*"days":14/ }).length).toBeGreaterThan(0)
  })

  it('says 7 days and shows no gift line for a plain signup', () => {
    renderPage()
    expect(screen.queryByText(/billing\.giftFrom/)).not.toBeInTheDocument()
    expect(screen.getByText(/billing\.newUserTrialNote:\{"days":7\}/)).toBeInTheDocument()
  })

  // A referred member who trialed, canceled and came back is still !hasCard, but getMe reports
  // trialEligible:false (one trial per account) — so the gift line would be a lie.
  it('hides the gift line for a referred member who already used their trial and canceled', () => {
    setUser({ trialDays: 14, inviterName: 'Ana', subscriptionStatus: 'canceled', trialEligible: false })
    renderPage()
    expect(screen.queryByText(/billing\.giftFrom/)).not.toBeInTheDocument()
  })
})

// One trial per account, forever (billingNode.createCheckoutSession keys it on the subscription-row
// COUNT). A member who already spent theirs is still !hasCard, so they land in the same pre-card
// block as a brand-new visitor — and every trial promise in it has to go, or the page contradicts
// the message Stripe puts under its own pay button (convex/lib/checkoutCopy NO_TRIAL_MESSAGE).
describe('BillingPage member with no trial left', () => {
  it('replaces the note and the plan CTA with the no-trial copy', () => {
    setUser({ subscriptionStatus: 'canceled', trialEligible: false })
    renderPage()
    expect(screen.queryByText(/billing\.newUserTrialNote/)).not.toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: /billing\.startTrialCta/ })).toHaveLength(0)
    expect(screen.getByText(/billing\.noTrialNote/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /billing\.noTrialCta:.*"plan":"Growth"/ }).length).toBeGreaterThan(0)
  })

  // Arriving from a landing pricing CTA takes the chosenPlanLead branch, which promised the trial too.
  it('drops the trial from the chosen-plan lead', () => {
    renderBilling({ search: 'plan=pro', me: { subscriptionStatus: 'canceled', trialEligible: false } })
    expect(screen.queryByText(/billing\.chosenPlanLead/)).not.toBeInTheDocument()
    expect(screen.getByText(/billing\.noTrialChosenPlanLead:.*"plan":"Pro"/)).toBeInTheDocument()
  })

  // 'canceled' is not the whole set: convex/stripe.ts toSubscriptionStatus maps an incomplete or
  // paused Stripe subscription to 'none' with the row already inserted, and an admin can set 'none'
  // back on a member who has rows. Both are ineligible. The client asks the server, never the status.
  it('trusts the server flag over a "none" status', () => {
    setUser({ subscriptionStatus: 'none', trialEligible: false })
    renderPage()
    expect(screen.queryByText(/billing\.newUserTrialNote/)).not.toBeInTheDocument()
    expect(screen.getByText(/billing\.noTrialNote/)).toBeInTheDocument()
  })

  it('still promises the trial to an eligible member', () => {
    setUser({ trialEligible: true })
    renderPage()
    expect(screen.getByText(/billing\.newUserTrialNote:\{"days":7\}/)).toBeInTheDocument()
    expect(screen.queryByText(/billing\.noTrialNote/)).not.toBeInTheDocument()
  })
})
