// app/src/pages/FeedPage.test.tsx
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FeedPage from './FeedPage'

// Mock the Convex API module so each query/action has a stable, identifiable reference — the same
// by-function-identity dispatch MyPostsPage.test.tsx and BillingPage.test.tsx use, not call order.
vi.mock('../convex', () => ({
  api: {
    users: { getMe: 'users.getMe', getTrialProgress: 'users.getTrialProgress' },
    posts: { getMyPosts: 'posts.getMyPosts', submitPost: 'posts.submitPost' },
    feed: { getFeed: 'feed.getFeed', getCaughtUp: 'feed.getCaughtUp' },
    interactions: { reactToPost: 'interactions.reactToPost', hidePost: 'interactions.hidePost' }
  }
}))

let mockQueryReturns: Record<string, unknown> = {}
let mockPaginated: { results: unknown[]; status: string; loadMore: ReturnType<typeof vi.fn> }

vi.mock('convex/react', () => ({
  useQuery: vi.fn((ref: string) => mockQueryReturns[ref]),
  usePaginatedQuery: vi.fn(() => mockPaginated),
  useAction: vi.fn(() => async () => {}),
  useMutation: vi.fn(() => vi.fn(async () => {}))
}))

// FeedPage always mounts CardGateDialog (and, for a gated member, CardGateBanner), both of which
// call useSearchParams/Link unconditionally — mock react-router-dom the same minimal way
// BillingPage.test.tsx does so no <MemoryRouter> plumbing is needed here either.
vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useSearchParams: () => [new URLSearchParams(), vi.fn()]
}))

// Only the R21 budget test renders a post at all, and it cares about the load calls, not the card.
vi.mock('../components/PostCard', () => ({
  default: ({ post }: { post: { _id: string } }) => <article data-testid={`post-${post._id}`} />
}))

function renderPage() {
  return render(<FeedPage />)
}

beforeEach(() => {
  sessionStorage.setItem('sessionToken', 'tok')
  mockPaginated = { results: [], status: 'Exhausted', loadMore: vi.fn() }
  mockQueryReturns = {
    'users.getMe': { tier: 'starter', subscriptionStatus: 'trialing' },
    'users.getTrialProgress': {
      made: 0,
      received: 0,
      combined: 0,
      threshold: 50,
      reached: false,
      nearThreshold: false
    },
    'posts.getMyPosts': []
  }
})

describe('FeedPage empty states (R05)', () => {
  it('renders EmptyFeed on an empty unfiltered feed', () => {
    renderPage()
    expect(screen.getByText(/your feed fills as members post/i)).toBeInTheDocument()
    expect(screen.queryByText(/no posts match your filter/i)).not.toBeInTheDocument()
  })

  it('still renders feed.emptyFiltered, with its existing recovery copy, for an empty filtered feed', () => {
    mockQueryReturns['users.getMe'] = {
      tier: 'pro',
      subscriptionStatus: 'trialing',
      feedFilterIndustries: ['software'],
      feedFilterCountries: []
    }
    renderPage()
    expect(
      screen.getByText(/no posts match your filter yet\. adjust it or clear it to see more\./i)
    ).toBeInTheDocument()
    expect(screen.queryByText(/your feed fills as members post/i)).not.toBeInTheDocument()
  })
})

// backlog/R21 — an empty page is not proof the feed is empty: handled posts are dropped per viewer.
describe('FeedPage feed hygiene (R21)', () => {
  it('keeps loading while empty pages can still load more, instead of showing the empty state', () => {
    mockPaginated = { results: [], status: 'CanLoadMore', loadMore: vi.fn() }
    renderPage()
    expect(mockPaginated.loadMore).toHaveBeenCalledWith(20)
    expect(screen.queryByText(/your feed fills as members post/i)).not.toBeInTheDocument()
  })

  it('shows the caught-up state when the feed is exhausted and the member interacted recently', () => {
    mockQueryReturns['feed.getCaughtUp'] = { caughtUp: true }
    renderPage()
    expect(screen.getByText(/you.re caught up/i)).toBeInTheDocument()
    expect(screen.queryByText(/your feed fills as members post/i)).not.toBeInTheDocument()
  })

  // The budget covers one run of empty pages. Left un-reset, a session that burned all five once
  // would show the empty state beside a "Load more" button the next time the feed empties.
  it('starts the empty-page budget over once a page comes back with posts', () => {
    const loadMore = vi.fn()
    mockQueryReturns['feed.getCaughtUp'] = { caughtUp: true }
    mockPaginated = { results: [], status: 'CanLoadMore', loadMore }
    const { rerender } = render(<FeedPage />)
    // One auto-load per CanLoadMore edge: the mocked loadMore never advances status itself.
    const emptyPage = () => {
      mockPaginated = { ...mockPaginated, results: [], status: 'LoadingMore' }
      rerender(<FeedPage />)
      mockPaginated = { ...mockPaginated, results: [], status: 'CanLoadMore' }
      rerender(<FeedPage />)
    }
    expect(loadMore).toHaveBeenCalledTimes(1)
    for (let i = 0; i < 4; i++) emptyPage()
    expect(loadMore).toHaveBeenCalledTimes(5) // MAX_EMPTY_LOADS
    emptyPage()
    expect(loadMore).toHaveBeenCalledTimes(5) // budget spent — no sixth auto-load
    // The manual Load more has taken over: no empty state may sit above it and contradict it.
    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument()
    expect(screen.queryByText(/you.re caught up/i)).not.toBeInTheDocument()

    // A page arrives with posts (status is not CanLoadMore, so nothing auto-loads on this render)…
    mockPaginated = { ...mockPaginated, results: [{ _id: 'p1' }], status: 'LoadingMore' }
    rerender(<FeedPage />)
    expect(loadMore).toHaveBeenCalledTimes(5)
    // …and when the feed empties again the budget is back.
    mockPaginated = { ...mockPaginated, results: [], status: 'CanLoadMore' }
    rerender(<FeedPage />)
    expect(loadMore).toHaveBeenCalledTimes(6)
  })
})
