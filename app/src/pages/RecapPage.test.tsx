import { vi } from 'vitest'

vi.mock('../convex', () => ({
  api: {
    interactions: { getRecap: 'interactions.getRecap' },
    posts: {
      getWeeklyUsage: 'posts.getWeeklyUsage',
      getFeaturedUsage: 'posts.getFeaturedUsage',
      getTierLimits: 'posts.getTierLimits'
    },
    users: {
      getMe: 'users.getMe',
      getSubscriptionInfo: 'users.getSubscriptionInfo',
      getTrialProgress: 'users.getTrialProgress'
    }
  }
}))

let mockQueryReturns: Record<string, unknown> = {}
let mockRecapError: Error | null = null
vi.mock('convex/react', () => ({
  useQuery: vi.fn((ref: string) => mockQueryReturns[ref])
}))
vi.mock('@/lib/useQueryOnce', () => ({
  useQueryOnce: vi.fn((ref: string) => ({ data: mockQueryReturns[ref], error: mockRecapError }))
}))
vi.mock('@/lib/observability/analytics', () => ({ captureEvent: vi.fn() }))

import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useQuery } from 'convex/react'
import { useQueryOnce } from '@/lib/useQueryOnce'
import { beforeEach, describe, expect, it } from 'vitest'
import { captureEvent } from '@/lib/observability/analytics'
import { RECAP_ROW_CEILING } from '../../../convex/lib/recap'
import RecapPage from './RecapPage'

const COUNTS = (reactions: number, comments: number, posts: number, drafts = 0) => ({
  reactions,
  comments,
  posts,
  drafts,
  total: reactions + comments + drafts
})

const RECAP = {
  window: '7d',
  since: 0,
  until: 1,
  made: { current: COUNTS(5, 2, 4), previous: COUNTS(2, 1, 2) },
  received: { current: COUNTS(3, 1, 1), previous: COUNTS(0, 0, 0) },
  truncated: false,
  plan: { tier: 'starter', interactionsPerPost: 25, postsPerWeek: 1, featuredPerMonth: 0, nextTier: 'growth' },
  posts: [
    {
      id: 'p1',
      linkedinPostUrn: 'urn:li:share:1',
      sourceUrl: 'https://www.linkedin.com/posts/ana_hello-world',
      excerpt: 'Hello world',
      likeCount: 18,
      commentCount: 2,
      isFeatured: false,
      interactionLimitReached: false
    }
  ],
  nearCapPost: { id: 'p1', excerpt: 'Hello world', total: 20 }
}

const EMPTY = {
  ...RECAP,
  made: { current: COUNTS(0, 0, 0), previous: COUNTS(0, 0, 0) },
  received: { current: COUNTS(0, 0, 0), previous: COUNTS(0, 0, 0) },
  posts: [],
  nearCapPost: null
}

function renderPage() {
  return render(
    <MemoryRouter>
      <RecapPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  sessionStorage.setItem('sessionToken', 'tok')
  mockRecapError = null
  vi.mocked(captureEvent).mockClear()
  vi.mocked(useQuery).mockClear()
  vi.mocked(useQueryOnce).mockClear()
  mockQueryReturns = {
    'interactions.getRecap': RECAP,
    'posts.getWeeklyUsage': { postsThisWeek: 1, postsPerWeek: 1 },
    'posts.getFeaturedUsage': { usedCount: 0, featuredPerMonth: 0 },
    'posts.getTierLimits': {
      starter: { interactionsPerPost: 25, postsPerWeek: 1, featuredPerMonth: 0 },
      growth: { interactionsPerPost: 50, postsPerWeek: 2, featuredPerMonth: 1 },
      pro: { interactionsPerPost: 200, postsPerWeek: 5, featuredPerMonth: 3 }
    },
    'users.getMe': { _id: 'u1', tier: 'starter', subscriptionStatus: 'active' },
    'users.getSubscriptionInfo': { priceInterval: 'year' },
    'users.getTrialProgress': null
  }
})

describe('RecapPage', () => {
  it('keeps the header and window toggle mounted while the recap loads (F1)', () => {
    mockQueryReturns['interactions.getRecap'] = undefined
    renderPage()
    expect(screen.getByRole('heading', { name: 'Recap' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Last 7 days' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })

  it('renders a minimal error state instead of the loading skeleton when the recap fetch fails (F16)', () => {
    mockRecapError = new Error('boom')
    mockQueryReturns['interactions.getRecap'] = undefined
    renderPage()
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('An unexpected error occurred. Reloading the page usually fixes it.')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(captureEvent).not.toHaveBeenCalled()
  })

  it('renders both tiles with breakdown, delta and the celebrate line only where earned', () => {
    renderPage()
    expect(screen.getByText('You made')).toBeInTheDocument()
    expect(screen.getByText('5 reactions · 2 comments · across 4 posts')).toBeInTheDocument()
    expect(screen.getByText('+4 vs the previous 7 days')).toBeInTheDocument()
    expect(screen.getAllByText(/vs the previous/)).toHaveLength(1) // received had no previous data
    expect(screen.getByText('More than the previous 7 days. Keep going.')).toBeInTheDocument()
  })

  it('adds the AI-drafts part to the breakdown when drafts exist', () => {
    mockQueryReturns['interactions.getRecap'] = { ...RECAP, made: { ...RECAP.made, current: COUNTS(5, 2, 4, 3) } }
    renderPage()
    expect(screen.getByText('5 reactions · 2 comments · across 4 posts · 3 AI drafts')).toBeInTheDocument()
    // The big total stays counts.total (10): the backend folds drafts in, the Tile never adds them.
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('shows the near-cap upgrade ask with both numbers and the per-post bar', () => {
    renderPage()
    expect(screen.getByText(/20 of 25 interactions\. On Growth it keeps collecting to 50/)).toBeInTheDocument()
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '20')
    expect(bar.firstElementChild).toHaveStyle({ width: '80%' })
    expect(screen.getByText('1 of 1 posts in the last 7 days')).toBeInTheDocument()
    const card = screen.getByRole('link', { name: 'Hello world' }).closest('li')
    expect(card).toHaveClass('rounded-xl', 'border', 'border-border', 'bg-card', 'p-4', 'shadow-xs')
    expect(card?.parentElement).toHaveClass('flex', 'flex-col', 'gap-3')
    expect(screen.getByRole('link', { name: /View on LinkedIn/ })).toHaveAttribute(
      'href',
      'https://www.linkedin.com/posts/ana_hello-world'
    )
  })

  it('renders the truncated notice with the reworded copy and the row ceiling (F3, F8)', () => {
    mockQueryReturns['interactions.getRecap'] = { ...RECAP, truncated: true }
    renderPage()
    expect(screen.getByText(`Showing your most recent ${RECAP_ROW_CEILING} interactions.`)).toBeInTheDocument()
  })

  it('renders the interaction-cap badge on a post that reached its cap (F8)', () => {
    mockQueryReturns['interactions.getRecap'] = {
      ...RECAP,
      posts: [{ ...RECAP.posts[0], interactionLimitReached: true }]
    }
    renderPage()
    expect(screen.getByText('Reached 25 interactions and left the feed')).toBeInTheDocument()
  })

  // backlog/R17 A1: a bought post's cap is the plan cap plus its bonus, not the plan cap alone —
  // "50 of 25" was wrong. starter plan cap 25 + bonus 25 = 50.
  it("uses the bought post's bigger cap, not the plan cap, in its usage line and progress bar", () => {
    mockQueryReturns['interactions.getRecap'] = {
      ...RECAP,
      posts: [{ ...RECAP.posts[0], likeCount: 30, commentCount: 15, interactionCapBonus: 25 }]
    }
    renderPage()
    expect(screen.getByText('45 of 50 interactions')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '50')
  })

  it('keeps the SSI mention behind the Sales Navigator line and links to history', () => {
    renderPage()
    expect(screen.getByText(/Check your SSI in Sales Navigator/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See every interaction' })).toHaveAttribute('href', '/history')
    expect(screen.getByText(/doesn't read or estimate your SSI/)).toBeInTheDocument()
  })

  it('fires recap_viewed once per loaded window and re-queries on toggle', () => {
    renderPage()
    expect(captureEvent).toHaveBeenCalledTimes(1)
    expect(captureEvent).toHaveBeenCalledWith('recap_viewed', { window: '7d', nearCap: true })
    fireEvent.click(screen.getByRole('button', { name: 'Last 30 days' }))
    const asked30 = vi
      .mocked(useQueryOnce)
      .mock.calls.some(
        ([ref, args]) => (ref as unknown) === 'interactions.getRecap' && (args as { window?: string })?.window === '30d'
      )
    expect(asked30).toBe(true)
  })

  it('renders the empty state with a feed link, no plan section, and still shows the honesty line and history link (F7)', () => {
    mockQueryReturns['interactions.getRecap'] = EMPTY
    renderPage()
    expect(screen.getByText('Nothing recorded in the last 7 days')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to the feed' })).toHaveAttribute('href', '/feed')
    expect(screen.queryByText('Plan usage')).not.toBeInTheDocument()
    expect(captureEvent).toHaveBeenCalledWith('recap_viewed', { window: '7d', nearCap: false })
    expect(screen.getByText(/doesn't read or estimate your SSI/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See every interaction' })).toHaveAttribute('href', '/history')
  })
})

describe('RecapPage invite line (R19)', () => {
  it('links to Settings › Invite when the member received interactions', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /invite a peer/i })).toHaveAttribute('href', '/settings#invite')
  })

  it('stays quiet when nobody interacted with them yet', () => {
    mockQueryReturns['interactions.getRecap'] = EMPTY
    renderPage()
    expect(screen.queryByRole('link', { name: /invite a peer/i })).not.toBeInTheDocument()
  })
})
