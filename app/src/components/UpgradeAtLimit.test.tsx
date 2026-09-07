import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getFunctionName } from 'convex/server'
import { useQuery } from 'convex/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('convex/react', () => ({
  useQuery: vi.fn()
}))

import UpgradeAtLimit from './UpgradeAtLimit'

// getTierLimits result — matches the shape convex/posts.ts's getTierLimits returns.
const TIER_LIMITS = {
  starter: { interactionsPerPost: 25, postsPerWeek: 1, featuredPerMonth: 0 },
  growth: { interactionsPerPost: 50, postsPerWeek: 7, featuredPerMonth: 1 },
  pro: { interactionsPerPost: 200, postsPerWeek: 5, featuredPerMonth: 3 },
  contact: { interactionsPerPost: 200, postsPerWeek: 5, featuredPerMonth: 9999 }
}

let mockMe: { tier: string; subscriptionStatus?: string } = { tier: 'starter', subscriptionStatus: 'active' }
let mockSubscriptionInfo: { priceInterval?: string } | null = { priceInterval: 'year' }

function routeQueries() {
  vi.mocked(useQuery).mockImplementation((ref: unknown, ..._rest: unknown[]) => {
    const name = getFunctionName(ref as Parameters<typeof getFunctionName>[0])
    if (name === 'users:getMe') return mockMe as never
    if (name === 'users:getSubscriptionInfo') return mockSubscriptionInfo as never
    if (name === 'posts:getTierLimits') return TIER_LIMITS as never
    return undefined
  })
}

function renderComponent(limit: 'weeklyPosts' | 'featured' | 'interactionCap' | 'visibility') {
  return render(
    <MemoryRouter>
      <UpgradeAtLimit limit={limit} />
    </MemoryRouter>
  )
}

beforeEach(() => {
  mockMe = { tier: 'starter', subscriptionStatus: 'active' }
  mockSubscriptionInfo = { priceInterval: 'year' }
  routeQueries()
})

describe('UpgradeAtLimit', () => {
  it('links a starter member to the growth checkout carrying their interval', () => {
    renderComponent('weeklyPosts')
    expect(screen.getByRole('link')).toHaveAttribute('href', '/billing?plan=growth&interval=annual')
  })

  it('names the next tier numbers from the query, never a hardcoded value', () => {
    renderComponent('weeklyPosts')
    expect(screen.getByText(/7/)).toBeInTheDocument()
  })

  it('gives a pro member the enterprise contact line, never a checkout link', () => {
    mockMe = { tier: 'pro', subscriptionStatus: 'active' }
    renderComponent('featured')
    expect(screen.getByRole('link')).toHaveAttribute('href', 'mailto:contact@linkintothessi.com')
  })

  it('gives a contact-tier member the custom-limit line and never prints the 9999 sentinel', () => {
    mockMe = { tier: 'contact', subscriptionStatus: 'active' }
    renderComponent('featured')
    expect(screen.queryByText(/9999/)).not.toBeInTheDocument()
  })

  // Visibility control is Pro-only (SettingsPage's isPro) — sending Starter to the Growth checkout
  // would sell them a plan that doesn't unlock the thing they just tried to use.
  it('sends a starter member to Pro for the visibility upsell, never Growth', () => {
    renderComponent('visibility')
    expect(screen.getByRole('link', { name: /upgrade to pro/i })).toHaveAttribute(
      'href',
      '/billing?plan=pro&interval=annual'
    )
  })

  // F2: a card-gated member (no trial started, or a lapsed payment) can't check out a "next tier"
  // when they aren't even engaging on their current one — they get the same trial/payment ask as
  // CardGateBanner/CardGateDialog instead of an upgrade pitch.
  it('asks a never-started member to start their trial instead of pitching an upgrade', () => {
    mockMe = { tier: 'starter', subscriptionStatus: 'none' }
    renderComponent('weeklyPosts')
    expect(screen.getByRole('link', { name: /start 7-day trial/i })).toHaveAttribute('href', '/billing?plan=growth')
    expect(screen.queryByText(/weekly post cap/i)).not.toBeInTheDocument()
  })

  it('asks a past_due member to update payment instead of pitching an upgrade', () => {
    mockMe = { tier: 'starter', subscriptionStatus: 'past_due' }
    renderComponent('featured')
    expect(screen.getByRole('link', { name: /update payment method/i })).toHaveAttribute('href', '/billing?plan=growth')
    expect(screen.queryByText(/used all your featured posts/i)).not.toBeInTheDocument()
  })
})
