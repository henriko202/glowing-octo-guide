import { vi } from 'vitest'

// Stable string refs so the useQuery mock can dispatch by WHICH function was asked for.
vi.mock('../../convex', () => ({
  api: {
    users: {
      getMe: 'users.getMe',
      getTrialProgress: 'users.getTrialProgress'
    }
  }
}))

let mockQueryReturns: Record<string, unknown> = {}
vi.mock('convex/react', () => ({
  useQuery: (ref: string) => mockQueryReturns[ref],
  useMutation: () => vi.fn()
}))

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import Sidebar from './Sidebar'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>
  )
}

// Defaults a trialing Growth member 12 of 50 in — matches the R06 example ("made 8 · received 4").
function renderSidebar(userOverride: Record<string, unknown> = {}, progressOverride: Record<string, unknown> = {}) {
  mockQueryReturns['users.getMe'] = { _id: 'u1', subscriptionStatus: 'trialing', tier: 'growth', ...userOverride }
  mockQueryReturns['users.getTrialProgress'] = {
    made: 8,
    received: 4,
    combined: 12,
    threshold: 50,
    nearThreshold: false,
    trialEndsAt: Date.now() + 86400000,
    ...progressOverride
  }
  return renderAt('/feed')
}

beforeEach(() => {
  mockQueryReturns = {}
})

describe('Sidebar', () => {
  it('renders the grouped nav links', () => {
    renderAt('/feed')
    expect(screen.getByRole('link', { name: 'Feed' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'My Posts' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Billing' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Notifications' })).toHaveAttribute('href', '/notifications')
  })
  it('marks the current route with aria-current', () => {
    renderAt('/billing')
    expect(screen.getByRole('link', { name: 'Billing' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Feed' })).not.toHaveAttribute('aria-current')
  })
  it('never renders an Admin link', () => {
    renderAt('/feed')
    expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument()
  })
})

describe('Sidebar trial card (R06)', () => {
  it('shows the trial card while trialing', () => {
    renderSidebar()
    // Scoped to "12/50" together (not a bare /12/ or /50/): the same card renders the trial end date
    // — whose day can be 12 on some calendar days — and shell.trialGoal's own literal "starts at 50"
    // clause renders "50" as a separate text node, so both loose matches are ambiguous.
    expect(screen.getByText(/12\s*\/\s*50/)).toBeInTheDocument()
  })

  it.each(['none', 'active', 'canceled'])('hides the trial card for %s', status => {
    renderSidebar({ subscriptionStatus: status })
    expect(screen.queryByTestId('trial-progress-card')).not.toBeInTheDocument()
  })

  it('switches to the amber near-threshold state', () => {
    renderSidebar({ subscriptionStatus: 'trialing' }, { combined: 40, nearThreshold: true })
    expect(screen.getByTestId('trial-progress-card')).toHaveAttribute('data-near', 'true')
  })

  it('drops the SSI link-out and routes Recap and History to their own pages', () => {
    renderSidebar()
    expect(screen.queryByRole('link', { name: /ssi/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Recap' })).toHaveAttribute('href', '/recap')
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('href', '/history')
  })
})

describe('Sidebar gated Billing accent (R04)', () => {
  // RCD: one attention point per screen. The gate already binds at the tap (CardGateDialog) and in
  // the feed banner, so the nav item only takes the accent colour — no motion competing with them.
  it('accents the Billing link while gated, without pulsing', () => {
    renderSidebar({ subscriptionStatus: 'none' })
    const billing = screen.getByRole('link', { name: /billing/i })
    expect(billing.className).toContain('text-primary')
    expect(billing.className).not.toContain('animate-pulse')
  })
})
