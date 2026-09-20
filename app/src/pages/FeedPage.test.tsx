// app/src/pages/FeedPage.test.tsx
import type { ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FeedPage from './FeedPage'
import { toast } from '@/components/ui/toast'

// Mock the Convex API module so each query/action has a stable, identifiable reference — the same
// by-function-identity dispatch MyPostsPage.test.tsx and BillingPage.test.tsx use, not call order.
vi.mock('../convex', () => ({
  api: {
    users: { getMe: 'users.getMe', getTrialProgress: 'users.getTrialProgress' },
    posts: { getMyPosts: 'posts.getMyPosts', submitPost: 'posts.submitPost' },
    feed: { getFeed: 'feed.getFeed', getCaughtUp: 'feed.getCaughtUp' },
    interactions: { reactToPost: 'interactions.reactToPost', hidePost: 'interactions.hidePost' },
    rankings: { getWeeklyTop: 'rankings.getWeeklyTop' }
  }
}))

let mockQueryReturns: Record<string, unknown> = {}
let mockPaginated: { results: unknown[]; status: string; loadMore: ReturnType<typeof vi.fn> }
let mockHidePost: ReturnType<typeof vi.fn>

vi.mock('convex/react', () => ({
  useQuery: vi.fn((ref: string) => mockQueryReturns[ref]),
  usePaginatedQuery: vi.fn(() => mockPaginated),
  useAction: vi.fn(() => async () => {}),
  useMutation: vi.fn(() => mockHidePost)
}))

// FeedPage always mounts CardGateDialog (and, for a gated member, CardGateBanner), both of which
// call useSearchParams/Link unconditionally — mock react-router-dom the same minimal way
// BillingPage.test.tsx does so no <MemoryRouter> plumbing is needed here either.
vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useSearchParams: () => [new URLSearchParams(), vi.fn()]
}))

// jsdom has no layout; render the loaded rows so feed visibility can be exercised with a clock.
vi.mock('@tanstack/react-virtual', () => ({
  useWindowVirtualizer: ({ count, scrollMargin }: { count: number; scrollMargin: number }) => ({
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ index, key: index, start: 0 })),
    getTotalSize: () => count * 220,
    measureElement: vi.fn(),
    options: { scrollMargin }
  })
}))

vi.mock('../components/PostCard', () => ({
  default: ({ post, onHide, authorMedal }: { post: { _id: string }; onHide?: () => void; authorMedal?: number }) => (
    <article
      data-testid={`post-${post._id}`}
      data-medal={authorMedal}
    >
      <button
        type="button"
        onClick={onHide}
      >
        Hide
      </button>
    </article>
  )
}))

vi.mock('@/components/ui/toast', () => ({ toast: vi.fn() }))

function renderPage() {
  return render(<FeedPage />)
}

beforeEach(() => {
  sessionStorage.setItem('sessionToken', 'tok')
  vi.mocked(toast).mockClear()
  mockHidePost = vi.fn(async () => {})
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

afterEach(() => {
  cleanup()
  vi.useRealTimers()
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

  // assertCanSubmitPost (convex/lib/access.ts) blocks only past_due: the feed composer stays
  // visible but Submit is disabled with the fix-payment hint, instead of a server refusal.
  it('blocks the composer for a past_due member and links to billing', () => {
    mockQueryReturns['users.getMe'] = { tier: 'growth', subscriptionStatus: 'past_due' }
    renderPage()
    fireEvent.change(screen.getByPlaceholderText(/linkedin\.com\/posts/i), {
      target: { value: 'https://www.linkedin.com/posts/jane_hello-activity-123' }
    })
    expect(screen.getByRole('button', { name: /add post/i })).toBeDisabled()
    expect(screen.getByRole('link', { name: /update payment method/i })).toHaveAttribute('href', '/billing')
  })

  // Past_due hides existing posts from the feed (isAuthorFeedEligible) even when they were never
  // hidden-flagged, so the banner must show for any post the member owns.
  it('shows the past-due banner for a member with a visible post', () => {
    mockQueryReturns['users.getMe'] = { tier: 'growth', subscriptionStatus: 'past_due' }
    mockQueryReturns['posts.getMyPosts'] = [{ _id: 'mine', hidden: false }]
    mockPaginated = { results: [{ _id: 'p1', authorId: 'a1' }], status: 'Exhausted', loadMore: vi.fn() }
    renderPage()
    expect(screen.getByText(/your post is hidden until you update your payment method/i)).toBeInTheDocument()
  })
})

// backlog/R21 — an empty page is not proof the feed is empty: handled posts are dropped per viewer.
describe('FeedPage feed hygiene (R21)', () => {
  it.each(['reacted', 'commented'] as const)(
    'removes a %s post exactly 24 hours after interaction without query updates',
    state => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-09-09T12:00:00Z'))
      mockPaginated.results = [
        {
          _id: 'handled',
          viewerState: {
            reacted: state === 'reacted',
            commented: state === 'commented',
            hidesAt: Date.now() + 86_400_000
          }
        },
        { _id: 'untouched' }
      ]
      renderPage()
      expect(screen.getByTestId('post-handled')).toBeInTheDocument()

      act(() => vi.advanceTimersByTime(86_399_999))
      expect(screen.getByTestId('post-handled')).toBeInTheDocument()
      act(() => vi.advanceTimersByTime(1))
      expect(screen.queryByTestId('post-handled')).not.toBeInTheDocument()
      expect(screen.getByTestId('post-untouched')).toBeInTheDocument()
    }
  )

  it('schedules expiry for an interaction received after the feed mounted', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-09T12:00:00Z'))
    mockPaginated.results = [{ _id: 'handled' }]
    const { rerender } = renderPage()
    act(() => vi.advanceTimersByTime(3_600_000))
    mockPaginated.results = [
      { _id: 'handled', viewerState: { reacted: true, commented: false, hidesAt: Date.now() + 86_400_000 } }
    ]
    rerender(<FeedPage />)

    act(() => vi.advanceTimersByTime(86_399_999))
    expect(screen.getByTestId('post-handled')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByTestId('post-handled')).not.toBeInTheDocument()
  })

  it('removes expired posts when the user returns from a suspended tab', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-09T12:00:00Z'))
    mockPaginated.results = [
      { _id: 'handled', viewerState: { reacted: true, commented: false, hidesAt: Date.now() + 30_000 } }
    ]
    renderPage()
    expect(screen.getByTestId('post-handled')).toBeInTheDocument()

    vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
    act(() => window.dispatchEvent(new Event('focus')))
    expect(screen.queryByTestId('post-handled')).not.toBeInTheDocument()
  })

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

describe('FeedPage hide confirmation', () => {
  beforeEach(() => {
    mockPaginated = { results: [{ _id: 'p1' }, { _id: 'p2' }], status: 'Exhausted', loadMore: vi.fn() }
  })

  it('opens the confirmation dialog from a card hide control without hiding yet', () => {
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: 'Hide' })[0])
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Hide this post?')).toBeInTheDocument()
    expect(mockHidePost).not.toHaveBeenCalled()
  })

  it('closes on Cancel without hiding', () => {
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: 'Hide' })[0])
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mockHidePost).not.toHaveBeenCalled()
  })

  it('hides the targeted post on confirm and closes the dialog', async () => {
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: 'Hide' })[1])
    fireEvent.click(screen.getByRole('button', { name: 'Hide post' }))
    await waitFor(() => expect(mockHidePost).toHaveBeenCalledWith({ sessionToken: 'tok', postId: 'p2' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

describe('FeedPage composer', () => {
  it('toasts a success confirmation once the post is added', async () => {
    renderPage()
    fireEvent.change(screen.getByPlaceholderText(/linkedin\.com\/posts/i), {
      target: { value: 'https://www.linkedin.com/posts/henri_activity-7000000000000000000-abcd' }
    })
    fireEvent.click(screen.getByRole('button', { name: /add post/i }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Post added to the feed.'))
  })
})

describe('FeedPage weekly top medals', () => {
  it('passes the medal to the card of a top-three poster and none to the rest', () => {
    mockPaginated = {
      results: [
        { _id: 'p1', authorId: 'u1' },
        { _id: 'p2', authorId: 'u2' }
      ],
      status: 'Exhausted',
      loadMore: vi.fn()
    }
    mockQueryReturns['rankings.getWeeklyTop'] = {
      generatedAt: 1,
      posters: [{ userId: 'u1', position: 2 }],
      interactors: []
    }
    renderPage()
    expect(screen.getByTestId('post-p1')).toHaveAttribute('data-medal', '2')
    expect(screen.getByTestId('post-p2')).not.toHaveAttribute('data-medal')
  })
})
