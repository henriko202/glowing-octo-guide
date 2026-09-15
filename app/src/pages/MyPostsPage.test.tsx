// app/src/pages/MyPostsPage.test.tsx
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConvexError } from 'convex/values'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
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
    },
    billingNode: { purchaseFeaturedPost: 'billingNode.purchaseFeaturedPost' }
  }
}))

// Per-test return values keyed by the refs above. Must be `mock`-prefixed so
// Vitest allows it inside the hoisted vi.mock factory.
let mockQueryReturns: Record<string, unknown> = {}
let mockMutations: Record<string, ReturnType<typeof vi.fn>> = {}
let mockActions: Record<string, ReturnType<typeof vi.fn>> = {}

vi.mock('convex/react', () => ({
  useQuery: vi.fn((ref: string) => mockQueryReturns[ref]),
  useAction: vi.fn((ref: string) => {
    mockActions[ref] ||= vi.fn(async () => ({}))
    return mockActions[ref]
  }),
  useMutation: vi.fn((ref: string) => {
    mockMutations[ref] ||= vi.fn(async () => {})
    return mockMutations[ref]
  })
}))
vi.mock('@/components/ui/toast', () => ({ toast: vi.fn() }))
vi.mock('@/lib/observability/analytics', () => ({ captureEvent: vi.fn() }))

import { toast } from '@/components/ui/toast'
import { captureEvent } from '@/lib/observability/analytics'

// The page strips its one-shot params; this shows what is left in the URL.
function SearchProbe() {
  const { search } = useLocation()
  return <div data-testid="search">{search}</div>
}

function renderPage(path = '/my-posts') {
  return render(
    <TooltipProvider>
      <MemoryRouter initialEntries={[path]}>
        <MyPostsPage />
        <SearchProbe />
      </MemoryRouter>
    </TooltipProvider>
  )
}

// Top-level (not nested in a describe) so it resets state before EVERY test in this file,
// including the featured-post add-on describe block below (backlog/R17) — without this, mock
// state set by one test leaks into the next (there is no per-describe isolation for module-level
// `let`s).
beforeEach(() => {
  sessionStorage.setItem('sessionToken', 'tok')
  mockMutations = {}
  mockActions = {}
  vi.mocked(toast).mockClear()
  vi.mocked(captureEvent).mockClear()
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
      contact: { interactionsPerPost: 200, postsPerWeek: 14, featuredPerMonth: 5 }
    }
  }
})

describe('MyPostsPage', () => {
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
    expect(screen.getByText(/2 of 5 posts in the last 7 days/i)).toBeInTheDocument()
  })

  it('renders the share composer', () => {
    renderPage()
    expect(screen.getByPlaceholderText(/linkedin\.com\/posts/i)).toBeInTheDocument()
  })

  it('turns the pill amber and disables submit at the weekly limit', () => {
    mockQueryReturns['posts.getWeeklyUsage'] = { postsThisWeek: 5, postsPerWeek: 5 }
    renderPage()
    expect(screen.getByText(/5 of 5 posts in the last 7 days/i)).toBeInTheDocument()
    // UpgradeAtLimit (backlog/R08) replaces the old static "weekly limit reached" copy.
    expect(screen.getByText(/weekly post cap/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /upgrade to growth/i })).toHaveAttribute(
      'href',
      '/billing?plan=growth&interval=annual'
    )
    expect(screen.getByRole('button', { name: /add post/i })).toBeDisabled()
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

  it('shows the finite contact default cap in the featured usage pill', () => {
    mockQueryReturns['posts.getFeaturedUsage'] = { usedCount: 2, featuredPerMonth: 5 }
    renderPage()
    expect(screen.getByText(/2 of 5 featured this month/i)).toBeInTheDocument()
    expect(screen.queryByText(/unlimited/i)).not.toBeInTheDocument()
  })

  it('still shows "unlimited" instead of the raw 9999 sentinel for an explicit admin override', () => {
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

  it('confirms Unfeature and explains that the permanent entitlement can be reused', async () => {
    mockQueryReturns['posts.getMyPosts'] = [
      {
        _id: 'p4',
        linkedinPostUrn: 'urn:li:activity:4',
        content: 'Hi',
        publishedAt: Date.now(),
        likeCount: 0,
        commentCount: 0,
        hidden: false,
        isFeatured: true,
        featuredAt: 42
      }
    ]
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /^unfeature$/i }))

    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByText(/feature it again later without using another plan allowance or paying again/i)
    ).toBeInTheDocument()
    expect(mockMutations['posts.unfeaturePost']).not.toHaveBeenCalled()

    const confirmButton = within(dialog).getByRole('button', { name: /^unfeature$/i })
    expect(confirmButton).toHaveAttribute('data-variant', 'destructive')
    fireEvent.click(confirmButton)
    await waitFor(() =>
      expect(mockMutations['posts.unfeaturePost']).toHaveBeenCalledWith({ sessionToken: 'tok', postId: 'p4' })
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
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
    // backlog/R17 — at the cap the slot offers the $5 add-on instead of a disabled Feature button.
    expect(screen.getByRole('button', { name: /feature for US\$5/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^feature$/i })).not.toBeInTheDocument()
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

describe('MyPostsPage — featured post add-on (backlog/R17)', () => {
  const unfeatured = {
    _id: 'p2',
    linkedinPostUrn: 'urn:li:activity:2',
    content: 'Hi',
    publishedAt: Date.now(),
    likeCount: 0,
    commentCount: 0,
    hidden: false,
    isFeatured: false
  }
  const purchase = { checkoutSessionId: 'cs_1', amountCents: 500, paidAt: 1 }

  it('offers the $5 slot with the bought cap and its details in a shadcn tooltip', async () => {
    mockQueryReturns['posts.getFeaturedUsage'] = { usedCount: 3, featuredPerMonth: 3 }
    mockQueryReturns['posts.getMyPosts'] = [unfeatured]
    renderPage()
    expect(screen.getByRole('button', { name: /feature for US\$5/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^feature$/i })).not.toBeInTheDocument()
    const buyButton = screen.getByRole('button', { name: /feature for US\$5/i })
    expect(buyButton).toHaveAttribute('data-variant', 'default')
    expect(buyButton).not.toHaveAttribute('title')
    expect(screen.queryByText(/raises its limit to 50 interactions/i)).not.toBeInTheDocument()
    fireEvent.pointerMove(buyButton, { pointerType: 'mouse' })
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/raises its limit to 50 interactions.*no refund/i)
  })

  it('uses the remaining plan allowance for a new post even when opened from the paid-feature link', () => {
    mockQueryReturns['posts.getFeaturedUsage'] = { usedCount: 0, featuredPerMonth: 3 }
    mockQueryReturns['posts.getMyPosts'] = [unfeatured]
    renderPage('/my-posts?feature=buy')
    expect(screen.getByRole('button', { name: /^feature$/i })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /feature for US\$5/i })).not.toBeInTheDocument()
  })

  it('re-features a plan-entitled post without consuming or buying another slot', () => {
    mockQueryReturns['posts.getFeaturedUsage'] = { usedCount: 3, featuredPerMonth: 3 }
    mockQueryReturns['posts.getMyPosts'] = [{ ...unfeatured, featuredAt: 42 }]
    renderPage()
    expect(screen.getByRole('button', { name: /^feature$/i })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /feature for US\$5/i })).not.toBeInTheDocument()
  })

  it('puts the upgrade first and the add-on second on a post that left the feed', () => {
    mockQueryReturns['posts.getMyPosts'] = [{ ...unfeatured, interactionLimitReached: true }]
    renderPage()
    expect(screen.getByText(/reached 25 and left the feed/i)).toBeInTheDocument()
    const upgrade = screen.getByRole('link', { name: /upgrade to/i })
    const buy = screen.getByRole('button', { name: /feature for US\$5/i })
    expect(upgrade.compareDocumentPosition(buy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // One control per card: the Feature slot keeps its plain button on a capped post.
    expect(screen.getAllByRole('button', { name: /feature for US\$5/i })).toHaveLength(1)
  })

  // G4 — the exact state G1/G2 fix: already featured for free AND capped, with no purchase. The
  // cap row must sell the cap, not re-promise a feature the post already has, and the buy button
  // must offer to add room rather than to feature it again.
  it('sells room, not a feature the post already has, on an already-featured capped post', () => {
    mockQueryReturns['posts.getMyPosts'] = [{ ...unfeatured, isFeatured: true, interactionLimitReached: true }]
    renderPage()
    const cappedLine = screen.getByText(/reached 25 and left the feed/i)
    expect(cappedLine.textContent).not.toMatch(/featured/i)
    const upgradeLine = screen.getByText(/left the feed after reaching its interaction cap/i)
    expect(upgradeLine.textContent).not.toMatch(/featured/i)
    expect(screen.getByRole('button', { name: /raise limit for US\$5/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^feature for US\$5$/i })).not.toBeInTheDocument()
  })

  it('tells a trialing member in the tooltip that the charge is separate from the trial', async () => {
    mockQueryReturns['users.getMe'] = { name: 'Henri Durand', tier: 'starter', subscriptionStatus: 'trialing' }
    mockQueryReturns['posts.getMyPosts'] = [{ ...unfeatured, interactionLimitReached: true }]
    renderPage()
    fireEvent.focus(screen.getByRole('button', { name: /feature for US\$5/i }))
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/separate from your trial/i)
  })

  it('hides the control for an unlimited tier, a bought post and a card-gated member', () => {
    const capped = { ...unfeatured, interactionLimitReached: true }

    mockQueryReturns['users.getMe'] = { name: 'Henri Durand', tier: 'contact', subscriptionStatus: 'active' }
    // 9999 is an explicit admin-granted override now that contact's tier default is a finite 5 —
    // this sub-case is about the unlimited guard, not the default.
    mockQueryReturns['posts.getFeaturedUsage'] = { usedCount: 0, featuredPerMonth: 9999 }
    mockQueryReturns['posts.getMyPosts'] = [capped]
    const contact = renderPage()
    expect(screen.queryByRole('button', { name: /feature for/i })).not.toBeInTheDocument()
    contact.unmount()

    mockQueryReturns['users.getMe'] = { name: 'Henri Durand', tier: 'starter', subscriptionStatus: 'active' }
    mockQueryReturns['posts.getFeaturedUsage'] = { usedCount: 3, featuredPerMonth: 3 }
    // Not `capped`: this sub-case is about the monthly-quota exemption a bought post gets, not F6's
    // separate per-post cap exemption (which it has none of) — the two must not be conflated here.
    mockQueryReturns['posts.getMyPosts'] = [{ ...unfeatured, featuredPurchase: purchase, interactionCapBonus: 25 }]
    const bought = renderPage()
    expect(screen.queryByRole('button', { name: /feature for/i })).not.toBeInTheDocument()
    // A bought post re-features for free, even at the monthly cap.
    expect(screen.getByRole('button', { name: /^feature$/i })).toBeEnabled()
    bought.unmount()

    mockQueryReturns['users.getMe'] = { name: 'Henri Durand', tier: 'starter', subscriptionStatus: 'none' }
    mockQueryReturns['posts.getFeaturedUsage'] = { usedCount: 0, featuredPerMonth: 3 }
    mockQueryReturns['posts.getMyPosts'] = [capped]
    renderPage()
    expect(screen.queryByRole('button', { name: /feature for/i })).not.toBeInTheDocument()
  })

  // The old guard hid the add-on for contact via isUnlimitedFeatured. Contact's finite 5 default no
  // longer trips that, but the server still refuses the purchase (featuredPurchaseBlocker keys
  // NOTHING_TO_BUY on the 0 cap bonus), so the UI must keep hiding the control at the cap.
  it('hides the $5 control for a finite contact cap, whose tier has nothing to buy', () => {
    mockQueryReturns['users.getMe'] = { name: 'Henri Durand', tier: 'contact', subscriptionStatus: 'active' }
    mockQueryReturns['posts.getFeaturedUsage'] = { usedCount: 5, featuredPerMonth: 5 }
    mockQueryReturns['posts.getMyPosts'] = [unfeatured]
    renderPage()
    expect(screen.getByText(/5 of 5 featured this month/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /feature for US\$5/i })).not.toBeInTheDocument()
    // No cap bonus to sell, so even the plain Feature button stays disabled at the monthly cap.
    expect(screen.getByRole('button', { name: /^feature$/i })).toBeDisabled()
  })

  it('does not order-bump the $5 purchase for a finite contact cap', async () => {
    mockQueryReturns['users.getMe'] = { name: 'Henri Durand', tier: 'contact', subscriptionStatus: 'active' }
    mockQueryReturns['posts.getFeaturedUsage'] = { usedCount: 5, featuredPerMonth: 5 }
    renderPage()
    fireEvent.change(screen.getByPlaceholderText(/linkedin\.com\/posts/i), {
      target: { value: 'https://www.linkedin.com/posts/henri_activity-7000000000000000000-abcd' }
    })
    fireEvent.click(screen.getByRole('button', { name: /add post/i }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.stringMatching(/feature it below/i)))
    expect(toast).not.toHaveBeenCalledWith(expect.stringMatching(/US\$5 below/i))
  })

  // F6/F8 — the plain Feature button still exists once a card-gated member can't buy the $5 slot
  // (the monthly reason, unchanged) and, new here, once the post itself is capped: featuring a
  // post that already left the feed for hitting its interaction cap wastes the monthly slot for
  // nothing, so it must read as disabled too, with its own reason in the title.
  it('disables the plain Feature button and explains why, at the monthly cap and once the post itself is capped', () => {
    mockQueryReturns['users.getMe'] = { name: 'Henri Durand', tier: 'starter', subscriptionStatus: 'none' }
    mockQueryReturns['posts.getFeaturedUsage'] = { usedCount: 3, featuredPerMonth: 3 }
    mockQueryReturns['posts.getMyPosts'] = [unfeatured]
    const atMonthlyCap = renderPage()
    const monthlyCapButton = screen.getByRole('button', { name: /^feature$/i })
    expect(monthlyCapButton).toBeDisabled()
    expect(monthlyCapButton).toHaveAttribute('title', 'Monthly featured limit reached')
    atMonthlyCap.unmount()

    mockQueryReturns['users.getMe'] = { name: 'Henri Durand', tier: 'starter', subscriptionStatus: 'active' }
    mockQueryReturns['posts.getFeaturedUsage'] = { usedCount: 0, featuredPerMonth: 3 }
    mockQueryReturns['posts.getMyPosts'] = [{ ...unfeatured, interactionLimitReached: true }]
    renderPage()
    const cappedButton = screen.getByRole('button', { name: /^feature$/i })
    expect(cappedButton).toBeDisabled()
    expect(cappedButton).toHaveAttribute(
      'title',
      "This post reached its interaction cap. Featuring it won't bring it back to the feed."
    )
  })

  // The reviewer's missing intersection: a bought post whose own (bigger) cap is ALSO exhausted.
  // There is deliberately no purchase exemption on the per-post cap disable — a bought post that
  // already left the feed for hitting its own cap can't be brought back by featuring it, so the
  // plain Feature button reads disabled here too. The monthly quota is explicitly not exhausted, so
  // a regression that let the monthly reason take priority (or read featuredPurchase first) would
  // show the wrong disabled state or the wrong title.
  it('disables the plain Feature button for a bought post whose own bigger cap is also exhausted', () => {
    mockQueryReturns['posts.getFeaturedUsage'] = { usedCount: 0, featuredPerMonth: 3 }
    mockQueryReturns['posts.getMyPosts'] = [
      { ...unfeatured, featuredPurchase: purchase, interactionCapBonus: 25, interactionLimitReached: true }
    ]
    renderPage()
    const button = screen.getByRole('button', { name: /^feature$/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute(
      'title',
      "This post reached its interaction cap. Featuring it won't bring it back to the feed."
    )
  })

  // backlog/R17 amendment A2 — assertCanEngage lets a canceled member (still inside their paid
  // window) reach the purchase server-side; the UI is what actually keeps them from buying a
  // feature for a post that leaves the feed once the window ends.
  it('hides the control for a canceled member even though the card gate would still let them engage', () => {
    mockQueryReturns['users.getMe'] = { name: 'Henri Durand', tier: 'starter', subscriptionStatus: 'canceled' }
    mockQueryReturns['posts.getMyPosts'] = [{ ...unfeatured, interactionLimitReached: true }]
    renderPage()
    expect(screen.queryByRole('button', { name: /feature for/i })).not.toBeInTheDocument()
  })

  it('names the effective cap on a bought post’s badge and on its cap badge', () => {
    mockQueryReturns['posts.getMyPosts'] = [
      {
        ...unfeatured,
        isFeatured: true,
        interactionCapBonus: 25,
        featuredPurchase: purchase,
        interactionLimitReached: true
      }
    ]
    renderPage()
    expect(screen.getByText(/featured · paid · cap 50/i)).toBeInTheDocument()
    expect(screen.getByText(/reached 50 interactions and left the feed/i)).toBeInTheDocument()
  })

  it('?feature=buy shows the control after plan allowances are exhausted and strips the param', () => {
    mockQueryReturns['posts.getFeaturedUsage'] = { usedCount: 3, featuredPerMonth: 3 }
    mockQueryReturns['posts.getMyPosts'] = [unfeatured]
    renderPage('/my-posts?feature=buy')
    expect(screen.getByRole('button', { name: /feature for US\$5/i })).toBeInTheDocument()
    expect(screen.getByTestId('search').textContent).toBe('')
  })

  it('?featured=paid&post=<id> toasts once, shows "Confirming…" on that card and strips the params', () => {
    mockQueryReturns['posts.getMyPosts'] = [unfeatured]
    renderPage('/my-posts?featured=paid&post=p2')
    expect(screen.getByText(/confirming your payment/i)).toBeInTheDocument()
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/limit to 50 interactions/i))
    expect(captureEvent).toHaveBeenCalledWith('featured_purchase_completed')
    expect(screen.getByTestId('search').textContent).toBe('')
  })

  // F1 — the double-charge window. On the return leg, before the webhook writes `featuredPurchase`,
  // `canBuy` used to still read true: the Feature slot showed "Confirming your payment…" while the
  // cap row below it kept a live $5 button. A second click there opens a second Checkout Session and
  // the server cannot refuse it — assertFeaturedPurchasable's ALREADY_PURCHASED keys on the very
  // field that has not arrived yet. Both placements are live in this state, hence the bare $5 matcher.
  it('shows no buy control anywhere on a card that is confirming a payment', () => {
    mockQueryReturns['posts.getFeaturedUsage'] = { usedCount: 3, featuredPerMonth: 3 }
    mockQueryReturns['posts.getMyPosts'] = [{ ...unfeatured, interactionLimitReached: true }]
    renderPage('/my-posts?featured=paid&post=p2')
    expect(screen.getByText(/confirming your payment/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /US\$5/ })).not.toBeInTheDocument()
  })

  // F11 — spec §4.12's orphaned case: the post was deleted between Checkout and the webhook, so it
  // is gone from this list and will never be featured. The toast promises room on one specific post,
  // so it must not fire for a post that is not there; the event still does — the member did pay.
  it('does not promise room on a post that is no longer in the list', () => {
    mockQueryReturns['posts.getMyPosts'] = []
    renderPage('/my-posts?featured=paid&post=p_gone')
    expect(toast).not.toHaveBeenCalled()
    expect(captureEvent).toHaveBeenCalledWith('featured_purchase_completed')
  })

  it('fires featured_purchase_started with the placement and calls the action with the post id', async () => {
    mockQueryReturns['posts.getMyPosts'] = [{ ...unfeatured, interactionLimitReached: true }]
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /feature for US\$5/i }))
    expect(captureEvent).toHaveBeenCalledWith('featured_purchase_started', { source: 'cap' })
    await waitFor(() =>
      expect(mockActions['billingNode.purchaseFeaturedPost']).toHaveBeenCalledWith({
        sessionToken: 'tok',
        postId: 'p2'
      })
    )
  })

  it('order-bumps the add-on after a submit only at the featured cap', async () => {
    mockQueryReturns['posts.getFeaturedUsage'] = { usedCount: 3, featuredPerMonth: 3 }
    renderPage()
    fireEvent.change(screen.getByPlaceholderText(/linkedin\.com\/posts/i), {
      target: { value: 'https://www.linkedin.com/posts/henri_activity-7000000000000000000-abcd' }
    })
    fireEvent.click(screen.getByRole('button', { name: /add post/i }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.stringMatching(/feature it for US\$5 below/i)))
  })

  // F3/C3 — every failure path (a thrown ConvexError, or a resolved-but-empty checkout url) collapses
  // to the same generic, localized message and re-enables the button; the raw server code must never
  // reach the buyer. On a real success the button must NOT reset back to live while the browser is
  // still navigating to Stripe — that would invite a second Checkout Session on a money path — so
  // `setBuyingPostId(null)` lives only in the `catch`, never a `finally`. Part (d) below is the case
  // that actually exercises that success redirect; (a)-(c) are all failure paths.
  it('shows the localized error on failure, and never re-enables through a successful redirect', async () => {
    const capped = { ...unfeatured, interactionLimitReached: true }

    // a. launch-day case: the Stripe Price doesn't exist yet, so every buyer hits this.
    mockActions['billingNode.purchaseFeaturedPost'] = vi.fn(async () => {
      throw new ConvexError('FEATURED_PRICE_UNSET')
    })
    mockQueryReturns['posts.getMyPosts'] = [capped]
    const rejected = renderPage()
    fireEvent.click(screen.getByRole('button', { name: /feature for US\$5/i }))
    await waitFor(() => expect(screen.getByText(/couldn't start that purchase/i)).toBeInTheDocument())
    expect(document.body.textContent).not.toMatch(/FEATURED_PRICE_UNSET/)
    rejected.unmount()

    // b. no thrown error, but no Checkout url either — must not be read as a silent success.
    mockActions['billingNode.purchaseFeaturedPost'] = vi.fn(async () => ({ url: null }))
    mockQueryReturns['posts.getMyPosts'] = [capped]
    const noUrl = renderPage()
    fireEvent.click(screen.getByRole('button', { name: /feature for US\$5/i }))
    await waitFor(() => expect(screen.getByText(/couldn't start that purchase/i)).toBeInTheDocument())
    noUrl.unmount()

    // c. still pending — disabled so a second click can't fire a second purchase. This resolves via
    // the same missing-url failure as (b), so it proves the FAILURE path re-enables the button; the
    // success path never reaches this resolution — see (d).
    let resolvePurchase!: (value: { url: string | null }) => void
    mockActions['billingNode.purchaseFeaturedPost'] = vi.fn(
      () =>
        new Promise<{ url: string | null }>(resolve => {
          resolvePurchase = resolve
        })
    )
    mockQueryReturns['posts.getMyPosts'] = [capped]
    const stillPending = renderPage()
    const buyButton = screen.getByRole('button', { name: /feature for US\$5/i })
    fireEvent.click(buyButton)
    expect(buyButton).toBeDisabled()
    resolvePurchase({ url: null })
    await waitFor(() => expect(buyButton).not.toBeDisabled())
    stillPending.unmount()

    // d. C3 — the actual success path: a real checkout url redirects the browser, and the button
    // must stay disabled while that navigation is in flight.
    const originalLocation = window.location
    // jsdom's window.location isn't directly assignable; swap it for a spyable stand-in.
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: '' },
      writable: true,
      configurable: true
    })
    mockActions['billingNode.purchaseFeaturedPost'] = vi.fn(async () => ({ url: 'https://stripe.test/cs_1' }))
    mockQueryReturns['posts.getMyPosts'] = [capped]
    renderPage()
    const successButton = screen.getByRole('button', { name: /feature for US\$5/i })
    fireEvent.click(successButton)
    await waitFor(() => expect(window.location.href).toBe('https://stripe.test/cs_1'))
    expect(successButton).toBeDisabled()
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true })
  })
})
