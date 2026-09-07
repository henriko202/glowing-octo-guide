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
    feed: { getFeed: 'feed.getFeed' },
    interactions: { reactToPost: 'interactions.reactToPost' }
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
