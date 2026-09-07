// app/src/pages/MyPostsPage.test.tsx
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import MyPostsPage from './MyPostsPage'

// Mock the Convex API module so each query/action has a stable, identifiable
// reference. This lets the useQuery mock dispatch by *which* query was asked
// for, rather than by call order (which broke when a third query was added).
vi.mock('../convex', () => ({
  api: {
    users: { getMe: 'users.getMe', getSubscriptionInfo: 'users.getSubscriptionInfo' },
    posts: {
      getMyPosts: 'posts.getMyPosts',
      getWeeklyUsage: 'posts.getWeeklyUsage',
      getFeaturedUsage: 'posts.getFeaturedUsage',
      getTierLimits: 'posts.getTierLimits',
      submitPost: 'posts.submitPost',
      setPostHidden: 'posts.setPostHidden',
      deletePost: 'posts.deletePost',
      featurePost: 'posts.featurePost',
      unfeaturePost: 'posts.unfeaturePost'
    }
  }
}))

// Per-test return values keyed by the refs above. Must be `mock`-prefixed so
// Vitest allows it inside the hoisted vi.mock factory.
let mockQueryReturns: Record<string, unknown> = {}
let mockMutations: Record<string, ReturnType<typeof vi.fn>> = {}

vi.mock('convex/react', () => ({
  useQuery: vi.fn((ref: string) => mockQueryReturns[ref]),
  useAction: vi.fn(() => async () => {}),
  useMutation: vi.fn((ref: string) => {
    mockMutations[ref] ||= vi.fn(async () => {})
    return mockMutations[ref]
  })
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <MyPostsPage />
    </MemoryRouter>
  )
}

describe('MyPostsPage', () => {
  beforeEach(() => {
    sessionStorage.setItem('sessionToken', 'tok')
    mockMutations = {}
    mockQueryReturns = {
      // subscriptionStatus: 'active' keeps UpgradeAtLimit's useCardGate() ungated here — its
      // own gated-member branch is covered by UpgradeAtLimit.test.tsx (F2), not this page's tests.
      'users.getMe': { name: 'Henri Durand', tier: 'starter', subscriptionStatus: 'active' },
      'users.getSubscriptionInfo': { priceInterval: 'year' },
      'posts.getMyPosts': [],
      'posts.getWeeklyUsage': { postsThisWeek: 2, postsPerWeek: 5 },
      'posts.getFeaturedUsage': { usedCount: 0, featuredPerMonth: 3 },
      // Backs UpgradeAtLimit (backlog/R08), rendered at the weekly/featured/interaction caps below.
      'posts.getTierLimits': {
        starter: { interactionsPerPost: 25, postsPerWeek: 5, featuredPerMonth: 0 },
        growth: { interactionsPerPost: 50, postsPerWeek: 7, featuredPerMonth: 1 },
        pro: { interactionsPerPost: 200, postsPerWeek: 14, featuredPerMonth: 3 },
        contact: { interactionsPerPost: 200, postsPerWeek: 14, featuredPerMonth: 9999 }
      }
    }
  })

  it('shows the page heading and user name', () => {
    renderPage()
    expect(screen.getByText('My Posts')).toBeInTheDocument()
    expect(screen.getByText('Henri Durand')).toBeInTheDocument()
  })

  it('shows empty state when no posts', () => {
    renderPage()
    expect(screen.getByText(/share your first post/i)).toBeInTheDocument()
  })

  it('shows the weekly usage pill', () => {
    renderPage()
    expect(screen.getByText(/2 of 5 posts this week/i)).toBeInTheDocument()
  })

  it('renders the share composer', () => {
    renderPage()
    expect(screen.getByPlaceholderText(/linkedin\.com\/posts/i)).toBeInTheDocument()
  })

  it('turns the pill amber and disables submit at the weekly limit', () => {
    mockQueryReturns['posts.getWeeklyUsage'] = { postsThisWeek: 5, postsPerWeek: 5 }
    renderPage()
    expect(screen.getByText(/5 of 5 posts this week/i)).toBeInTheDocument()
    // UpgradeAtLimit (backlog/R08) replaces the old static "weekly limit reached" copy.
    expect(screen.getByText(/weekly post cap/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /upgrade to growth/i })).toHaveAttribute(
      'href',
      '/billing?plan=growth&interval=annual'
    )
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled()
  })

  it('shows Hide + Delete controls and a "Visible in feed" state for a visible post', () => {
    mockQueryReturns['posts.getMyPosts'] = [
      {
        _id: 'p1',
        linkedinPostUrn: 'urn:li:activity:1',
        content: 'Hi',
        publishedAt: Date.now(),
        likeCount: 3,
        commentCount: 1,
        hidden: false
      }
    ]
    renderPage()
    expect(screen.getByText(/visible in feed/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^hide$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
  })

  it('shows an Unhide control and a "Hidden from feed" badge for a hidden post', () => {
    mockQueryReturns['posts.getMyPosts'] = [
      {
        _id: 'p2',
        linkedinPostUrn: 'urn:li:activity:2',
        content: 'Hi',
        publishedAt: Date.now(),
        likeCount: 0,
        commentCount: 0,
        hidden: true
      }
    ]
    renderPage()
    expect(screen.getByText(/hidden from feed/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /unhide/i })).toBeInTheDocument()
  })

  it('shows the featured usage pill', () => {
    renderPage()
    expect(screen.getByText(/0 of 3 featured this month/i)).toBeInTheDocument()
  })

  it('shows "unlimited" instead of the raw 9999 sentinel for a contact-tier cap', () => {
    mockQueryReturns['posts.getFeaturedUsage'] = { usedCount: 2, featuredPerMonth: 9999 }
    renderPage()
    expect(screen.getByText(/2 featured this month.*unlimited/i)).toBeInTheDocument()
    expect(screen.queryByText(/9999/)).not.toBeInTheDocument()
  })

  it('shows an enabled Feature control for a non-featured post', () => {
    mockQueryReturns['posts.getMyPosts'] = [
      {
        _id: 'p3',
        linkedinPostUrn: 'urn:li:activity:3',
        content: 'Hi',
        publishedAt: Date.now(),
        likeCount: 0,
        commentCount: 0,
        hidden: false,
        isFeatured: false
      }
    ]
    renderPage()
    const featureButton = screen.getByRole('button', { name: /^feature$/i })
    expect(featureButton).toBeInTheDocument()
    expect(featureButton).not.toBeDisabled()
  })

  it('shows a "★ Featured" badge and an Unfeature control for a featured post', () => {
    mockQueryReturns['posts.getMyPosts'] = [
      {
        _id: 'p4',
        linkedinPostUrn: 'urn:li:activity:4',
        content: 'Hi',
        publishedAt: Date.now(),
        likeCount: 0,
        commentCount: 0,
        hidden: false,
        isFeatured: true
      }
    ]
    renderPage()
    expect(screen.getByText('★ Featured')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^unfeature$/i })).toBeInTheDocument()
  })

  // Starter includes 0 featured posts, so `usedCount >= featuredPerMonth` is 0 >= 0 on every visit —
  // the upgrade ask must not fire on page load for a cap the plan never had (R08: at the limit,
  // never by interruption). The Feature button's own disabled state is where Starter meets it.
  it('shows no featured upgrade ask on load for a plan with zero featured posts', () => {
    mockQueryReturns['posts.getFeaturedUsage'] = { usedCount: 0, featuredPerMonth: 0 }
    renderPage()
    expect(screen.queryByText(/featured posts/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /upgrade to/i })).not.toBeInTheDocument()
  })

  it('asks for the upgrade at the featured cap when the plan does include featured posts', () => {
    mockQueryReturns['posts.getFeaturedUsage'] = { usedCount: 3, featuredPerMonth: 3 }
    renderPage()
    expect(screen.getByText(/used all your featured posts/i)).toBeInTheDocument()
  })

  it('disables Feature and explains why once the monthly cap is reached', () => {
    mockQueryReturns['posts.getFeaturedUsage'] = { usedCount: 3, featuredPerMonth: 3 }
    mockQueryReturns['posts.getMyPosts'] = [
      {
        _id: 'p5',
        linkedinPostUrn: 'urn:li:activity:5',
        content: 'Hi',
        publishedAt: Date.now(),
        likeCount: 0,
        commentCount: 0,
        hidden: false,
        isFeatured: false
      }
    ]
    renderPage()
    const featureButton = screen.getByRole('button', { name: /^feature$/i })
    expect(featureButton).toBeDisabled()
    expect(featureButton).toHaveAttribute('title', 'Monthly featured limit reached')
  })

  it('keeps Unfeature enabled for an already-featured post even at the monthly cap', () => {
    mockQueryReturns['posts.getFeaturedUsage'] = { usedCount: 3, featuredPerMonth: 3 }
    mockQueryReturns['posts.getMyPosts'] = [
      {
        _id: 'p6',
        linkedinPostUrn: 'urn:li:activity:6',
        content: 'Hi',
        publishedAt: Date.now(),
        likeCount: 0,
        commentCount: 0,
        hidden: false,
        isFeatured: true
      }
    ]
    renderPage()
    expect(screen.getByRole('button', { name: /^unfeature$/i })).not.toBeDisabled()
  })

  it('opens a themed confirm dialog on Delete (not window.confirm), and Cancel closes it', () => {
    mockQueryReturns['posts.getMyPosts'] = [
      {
        _id: 'p7',
        linkedinPostUrn: 'urn:li:activity:7',
        content: 'Hi',
        publishedAt: Date.now(),
        likeCount: 0,
        commentCount: 0,
        hidden: false
      }
    ]
    renderPage()

    // Before confirming, only the row's own Delete button exists — no dialog yet.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/removed from the feed/i)).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: /^cancel$/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('confirming the delete dialog runs the delete and closes the dialog', () => {
    mockQueryReturns['posts.getMyPosts'] = [
      {
        _id: 'p8',
        linkedinPostUrn: 'urn:li:activity:8',
        content: 'Hi',
        publishedAt: Date.now(),
        likeCount: 0,
        commentCount: 0,
        hidden: false
      }
    ]
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /^delete$/i }))

    expect(mockMutations['posts.deletePost']).toHaveBeenCalledWith({ sessionToken: 'tok', postId: 'p8' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
