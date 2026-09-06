// app/src/pages/BillingPage.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
    billingNode: { createCheckoutSession: 'billingNode.createCheckoutSession' }
  }
}))

let mockQueryReturns: Record<string, unknown> = {}
const mockCheckout = vi.fn(async () => ({ url: '' }))
const mockPortal = vi.fn(async () => ({ url: '' }))

vi.mock('convex/react', () => ({
  useQuery: vi.fn((ref: string) => mockQueryReturns[ref]),
  useAction: vi.fn((ref: string) => (ref === 'billing.createPortalSession' ? mockPortal : mockCheckout)),
  useMutation: vi.fn(() => vi.fn(async () => {}))
}))

// Echo the key plus its interpolation so assertions can see both — except plan names, which
// resolve to the real localized label. That keeps the "never print a raw tier id" rule testable.
const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  growth: 'Growth',
  pro: 'Pro',
  contact: 'Enterprise'
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => {
      const planName = /^billing\.plans\.(\w+)\.name$/.exec(k)
      if (planName) return PLAN_LABELS[planName[1]] ?? k
      return o && !('returnObjects' in o) ? `${k}:${JSON.stringify(o)}` : k
    },
    i18n: { language: 'en' }
  })
}))

import BillingPage from './BillingPage'

function setUser(over: Record<string, unknown> = {}) {
  mockQueryReturns['users.getMe'] = { _id: 'u1', tier: 'growth', subscriptionStatus: 'none', ...over }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <BillingPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  sessionStorage.clear()
  sessionStorage.setItem('sessionToken', 'tok')
  mockCheckout.mockClear()
  mockPortal.mockClear()
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

  it('sends a trialing card holder to the portal instead of a second checkout', async () => {
    setUser({ subscriptionStatus: 'trialing' })
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: /billing\.switchPlan/ })[0])
    await waitFor(() => expect(mockPortal).toHaveBeenCalled())
    expect(mockCheckout).not.toHaveBeenCalled()
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
    render(
      <MemoryRouter initialEntries={['/billing?plan=starter']}>
        <BillingPage />
      </MemoryRouter>
    )
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

  it('names the real tier in the trial banner, not always Growth', () => {
    setUser({ subscriptionStatus: 'trialing', tier: 'pro', trialEndsAt: Date.now() + 86400000 })
    renderPage()
    expect(screen.getByText(/billing\.trialBanner.*Pro/)).toBeInTheDocument()
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
