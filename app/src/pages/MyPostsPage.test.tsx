// app/src/pages/MyPostsPage.test.tsx
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import MyPostsPage from './MyPostsPage'

// Mock the Convex API module so each query/action has a stable, identifiable
// reference. This lets the useQuery mock dispatch by *which* query was asked
// for, rather than by call order (which broke when a third query was added).
vi.mock('../convex', () => ({
  api: {
    users: { getMe: 'users.getMe' },
    posts: {
      getMyPosts: 'posts.getMyPosts',
      getWeeklyUsage: 'posts.getWeeklyUsage',
      submitPost: 'posts.submitPost',
      setPostHidden: 'posts.setPostHidden',
      deletePost: 'posts.deletePost'
    }
  }
}))

// Per-test return values keyed by the refs above. Must be `mock`-prefixed so
// Vitest allows it inside the hoisted vi.mock factory.
let mockQueryReturns: Record<string, unknown> = {}

vi.mock('convex/react', () => ({
  useQuery: vi.fn((ref: string) => mockQueryReturns[ref]),
  useAction: vi.fn(() => async () => {}),
  useMutation: vi.fn(() => async () => {})
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
    mockQueryReturns = {
      'users.getMe': { name: 'Henri Durand', tier: 'starter' },
      'posts.getMyPosts': [],
      'posts.getWeeklyUsage': { postsThisWeek: 2, postsPerWeek: 5 }
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
    expect(screen.getByText(/weekly limit reached/i)).toBeInTheDocument()
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
})
