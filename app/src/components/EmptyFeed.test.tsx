// app/src/components/EmptyFeed.test.tsx
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import EmptyFeed from './EmptyFeed'

// EmptyFeed's CTA focuses the real composer input by id (no ref plumbing) — stand in for it here
// with a plain DOM node, the same way the real PostComposer's <Input id="post-url-input"> does on
// FeedPage. CardGateBanner (rendered for a gated member with a hidden post) needs `react-router-dom`
// for its Link/useSearchParams; mock it the same minimal way BillingPage.test.tsx does so `render`
// stays a bare `<EmptyFeed />` with no wrapper, as called out in the brief.
vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useSearchParams: () => [new URLSearchParams(), vi.fn()]
}))

// CardGateBanner also calls useCardGate() (F5's past_due branching), which needs a Convex query
// mock — there is no <ConvexProvider> in these bare `render(<EmptyFeed />)` calls.
vi.mock('../convex', () => ({
  api: { users: { getMe: 'users.getMe' } }
}))
vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => undefined)
}))

beforeEach(() => {
  const input = document.createElement('input')
  input.id = 'post-url-input'
  document.body.appendChild(input)
})

afterEach(() => {
  document.getElementById('post-url-input')?.remove()
})

describe('EmptyFeed', () => {
  it('offers one action that focuses the composer', () => {
    render(
      <EmptyFeed
        gated={false}
        hasOwnPost={false}
        made={0}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /share your first post/i }))
    expect(document.activeElement).toBe(document.getElementById('post-url-input'))
  })

  it('opens the checklist at 1 of 3', () => {
    render(
      <EmptyFeed
        gated={false}
        hasOwnPost={false}
        made={0}
        trialStatus="trialing"
      />
    )
    expect(screen.getByText(/1 \/ 3|1 of 3/i)).toBeInTheDocument()
  })

  it('hides the checklist once every step is done', () => {
    render(
      <EmptyFeed
        gated={false}
        hasOwnPost
        made={2}
        trialStatus="trialing"
      />
    )
    expect(screen.queryByTestId('activation-checklist')).not.toBeInTheDocument()
  })

  // spec §7.2: a member who has not started a trial has every step ahead of them — the checklist is
  // the open loop that makes starting worth it, so `none` shows it; only converted/lapsed hide it.
  it('shows the checklist for a member who has not started a trial yet', () => {
    render(
      <EmptyFeed
        gated
        hasOwnPost={false}
        made={0}
        trialStatus="none"
      />
    )
    expect(screen.getByText(/1 \/ 3|1 of 3/i)).toBeInTheDocument()
  })

  it('drops the "share your first post" action once the member has a post', () => {
    render(
      <EmptyFeed
        gated={false}
        hasOwnPost
        made={0}
        trialStatus="trialing"
      />
    )
    expect(screen.queryByRole('button', { name: /share your first post/i })).not.toBeInTheDocument()
    expect(screen.getByText(/other members' posts/i)).toBeInTheDocument()
  })

  // F12: trialInteractionsMade freezes the moment subscriptionStatus stops being 'trialing' (convex/
  // interactions.ts's bumpTrialInteraction) — a member who already converted or lapsed can never
  // move `made` again, so the "react twice" step must not be shown as a still-achievable step.
  it('hides the checklist for a converted or lapsed member even with steps left undone', () => {
    render(
      <EmptyFeed
        gated={false}
        hasOwnPost={false}
        made={0}
        trialStatus="active"
      />
    )
    expect(screen.queryByTestId('activation-checklist')).not.toBeInTheDocument()
  })

  it('hides the checklist while trialStatus has not loaded yet', () => {
    render(
      <EmptyFeed
        gated={false}
        hasOwnPost={false}
        made={0}
      />
    )
    expect(screen.queryByTestId('activation-checklist')).not.toBeInTheDocument()
  })

  it('shows the card-gate banner instead of the checklist for a gated member with a hidden post', () => {
    render(
      <EmptyFeed
        gated
        hasOwnPost
        made={0}
      />
    )
    expect(screen.getByText(/saved and hidden/i)).toBeInTheDocument()
    expect(screen.queryByTestId('activation-checklist')).not.toBeInTheDocument()
  })
})
