import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getFunctionName } from 'convex/server'
import { useQuery } from 'convex/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('convex/react', () => ({
  useQuery: vi.fn()
}))
vi.mock('@/lib/observability/analytics', () => ({ captureEvent: vi.fn() }))

import UpgradeAtLimit from './UpgradeAtLimit'
import { captureEvent } from '@/lib/observability/analytics'

// getTierLimits result — matches the shape convex/posts.ts's getTierLimits returns.
const TIER_LIMITS = {
  starter: { interactionsPerPost: 25, postsPerWeek: 1, featuredPerMonth: 0 },
  growth: { interactionsPerPost: 50, postsPerWeek: 7, featuredPerMonth: 1 },
  pro: { interactionsPerPost: 200, postsPerWeek: 5, featuredPerMonth: 3 },
  contact: { interactionsPerPost: 200, postsPerWeek: 5, featuredPerMonth: 5 }
}

let mockMe: { tier: string; subscriptionStatus?: string; trialEligible?: boolean } = {
  tier: 'starter',
  subscriptionStatus: 'active'
}
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

function renderComponent(
  limit: 'weeklyPosts' | 'featured' | 'interactionCap' | 'visibility',
  nearCap?: { total: number; cap: number },
  capBonus?: number
) {
  return render(
    <MemoryRouter>
      <UpgradeAtLimit
        limit={limit}
        nearCap={nearCap}
        capBonus={capBonus}
      />
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

  it('gives a contact-tier member the custom-limit line, never a checkout link or raw cap', () => {
    mockMe = { tier: 'contact', subscriptionStatus: 'active' }
    renderComponent('featured')
    expect(screen.getByText(/custom limit/i)).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', 'mailto:contact@linkintothessi.com')
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
    expect(screen.getByRole('link', { name: /try pro free/i })).toHaveAttribute('href', '/billing?plan=pro')
    expect(screen.queryByText(/weekly post cap/i)).not.toBeInTheDocument()
  })

  // Same 'none' status, opposite offer: this member already has subscription rows (incomplete/
  // paused, or an admin reset), so checkout gives them no trial and the gated ask must not promise
  // one. Only `getMe.trialEligible` separates them from the member above.
  it('asks a gated member with no trial left to subscribe, never to start a trial', () => {
    mockMe = { tier: 'starter', subscriptionStatus: 'none', trialEligible: false }
    renderComponent('weeklyPosts')
    expect(screen.getByRole('link', { name: /subscribe to growth/i })).toHaveAttribute('href', '/billing?plan=growth')
    expect(screen.getByText(/the growth plan is US\$15\/mo or US\$150\/yr/i)).toBeInTheDocument()
    expect(screen.queryByText(/trial/i)).not.toBeInTheDocument()
  })

  it('asks a past_due member to update payment instead of pitching an upgrade', () => {
    // A past_due member always holds a subscription row, so getMe says no trial left.
    mockMe = { tier: 'starter', subscriptionStatus: 'past_due', trialEligible: false }
    renderComponent('featured')
    expect(screen.getByRole('link', { name: /update payment method/i })).toHaveAttribute('href', '/billing?plan=growth')
    expect(screen.queryByText(/used all your featured posts/i)).not.toBeInTheDocument()
  })

  // R15: Recap shows the upgrade ask inside the 80% band, before the post is actually capped —
  // both numbers (not just the plan's own cap) distinguish it from the plain interactionCap copy.
  it('renders the near-cap copy with both numbers and tags the event near=true', () => {
    renderComponent('interactionCap', { total: 20, cap: 25 })
    expect(screen.getByText(/20 of 25 interactions/)).toBeInTheDocument()
    expect(screen.getByText(/keeps collecting to 50/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link'))
    expect(captureEvent).toHaveBeenCalledWith('upgrade_at_limit_clicked', {
      limit: 'interactionCap',
      plan: 'growth',
      near: true
    })
  })

  // C4 — after C5, capBonus only reaches the near-cap branch (a bought post that hasn't flipped
  // yet); the plain branch below no longer reads it. RecapPage.tsx:169 is the only caller that
  // passes it, so this pins the arithmetic the way that call site relies on.
  it('adds a bought post’s bonus to the next tier’s cap on the near-cap branch', () => {
    renderComponent('interactionCap', { total: 40, cap: 50 }, 25)
    expect(screen.getByText(/40 of 50 interactions/)).toBeInTheDocument()
    // next tier is growth (50) + this post's own bonus (25) = 75, not the plain 50.
    expect(screen.getByText(/keeps collecting to 75/)).toBeInTheDocument()
  })

  it('tags the plain cap event near=false', () => {
    renderComponent('interactionCap')
    fireEvent.click(screen.getByRole('link'))
    expect(captureEvent).toHaveBeenCalledWith('upgrade_at_limit_clicked', {
      limit: 'interactionCap',
      plan: 'growth',
      near: false
    })
  })

  it('names the one-time US$5 add-on after the featured upgrade line (backlog/R17)', () => {
    mockMe = { tier: 'growth', subscriptionStatus: 'active' }
    renderComponent('featured')
    const upgrade = screen.getByRole('link', { name: /upgrade to/i })
    const addon = screen.getByText(/one-time US\$5 purchase to feature one post/i)
    expect(upgrade.compareDocumentPosition(addon) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  // F2 — a canceled member has no buy control on My Posts (MyPostsPage.tsx canBuy), so the add-on
  // line has nothing to point at there. Mirrors the test above with only the status changed.
  it('never names the US$5 add-on for a canceled member', () => {
    mockMe = { tier: 'growth', subscriptionStatus: 'canceled' }
    renderComponent('featured')
    expect(screen.getByRole('link', { name: /upgrade to/i })).toBeInTheDocument()
    expect(screen.queryByText(/one-time US\$5 purchase to feature one post/i)).not.toBeInTheDocument()
  })

  it('keeps the add-on off the contact line and off every other limit kind', () => {
    mockMe = { tier: 'contact', subscriptionStatus: 'active' }
    const contact = renderComponent('featured')
    expect(screen.queryByText(/US\$5/)).not.toBeInTheDocument()
    contact.unmount()
    mockMe = { tier: 'growth', subscriptionStatus: 'active' }
    renderComponent('weeklyPosts')
    expect(screen.queryByText(/US\$5/)).not.toBeInTheDocument()
  })
})
