import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PostCard, { type PostWithAuthor } from './PostCard'

const mockPost: PostWithAuthor = {
  _id: 'post123' as never,
  linkedinPostUrn: 'urn:li:activity:7234567890123456789',
  content: 'Hello LinkedIn world',
  publishedAt: Date.now(),
  likeCount: 10,
  commentCount: 3,
  mediaUrls: [],
  isFeatured: false,
  author: { name: 'Jane Doe', headline: 'Engineer' },
  sourceUrl: ''
}

describe('PostCard', () => {
  it('renders the LinkedIn embed iframe for the post URN', () => {
    render(
      <PostCard
        post={mockPost}
        onComment={() => {}}
        onReact={() => {}}
      />
    )
    const iframe = screen.getByTitle('LinkedIn post')
    expect(iframe).toHaveAttribute(
      'src',
      'https://www.linkedin.com/embed/feed/update/urn:li:activity:7234567890123456789/'
    )
  })

  it('renders the author name but not the raw post body text', () => {
    render(
      <PostCard
        post={mockPost}
        onComment={() => {}}
        onReact={() => {}}
      />
    )
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.queryByText('Hello LinkedIn world')).not.toBeInTheDocument()
  })

  it('shows the FEATURED badge when isFeatured is true', () => {
    render(
      <PostCard
        post={{ ...mockPost, isFeatured: true }}
        onComment={() => {}}
        onReact={() => {}}
      />
    )
    expect(screen.getByText(/featured/i)).toBeInTheDocument()
  })

  it('reacts with the suggested reaction when the trigger is clicked', () => {
    const onReact = vi.fn()
    render(
      <PostCard
        post={{ ...mockPost, suggestedReaction: 'PRAISE' }}
        onComment={() => {}}
        onReact={onReact}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /react/i }))
    expect(onReact).toHaveBeenCalledWith(mockPost._id, 'PRAISE')
  })

  it('wires the Comment button to onComment with the post id', () => {
    const onComment = vi.fn()
    render(
      <PostCard
        post={mockPost}
        onComment={onComment}
        onReact={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /comment/i }))
    expect(onComment).toHaveBeenCalledWith(mockPost._id)
  })

  it('still renders the embed and action buttons when author is null', () => {
    render(
      <PostCard
        post={{ ...mockPost, author: null }}
        onComment={() => {}}
        onReact={() => {}}
      />
    )
    expect(screen.getByTitle('LinkedIn post')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /react/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /comment/i })).toBeInTheDocument()
  })

  it('shows the like and comment counts in the action bar', () => {
    render(
      <PostCard
        post={mockPost}
        onComment={() => {}}
        onReact={() => {}}
      />
    )
    expect(screen.getByRole('button', { name: /react/i })).toHaveTextContent('10')
    expect(screen.getByRole('button', { name: /3.*comment/i })).toBeInTheDocument()
  })

  // The "View on LinkedIn" link must point to the exact URL the user submitted
  // (sourceUrl). Reconstructing from the URN is lossy: LinkedIn's ugcPost / activity /
  // share IDs differ for the same post, so a reconstructed /feed/update/ link can
  // resolve to the wrong place (or nowhere).
  it('links "View on LinkedIn" to the stored sourceUrl when present', () => {
    const sourceUrl = 'https://www.linkedin.com/posts/test'
    render(
      <PostCard
        post={{ ...mockPost, sourceUrl }}
        onComment={() => {}}
        onReact={() => {}}
      />
    )
    expect(screen.getByRole('link', { name: /view on linkedin/i })).toHaveAttribute('href', sourceUrl)
  })

  // The stored value is a LinkedIn industry code; the card shows its label, never the raw number.
  it('falls back to the author industry label when there is no headline', () => {
    render(
      <PostCard
        post={{ ...mockPost, author: { name: 'Léo Martins', industry: '4' } }}
        onComment={() => {}}
        onReact={() => {}}
      />
    )
    expect(screen.getByText('Software Development')).toBeInTheDocument()
  })

  it('calls onGated with source "react" instead of onReact when the member is card-gated', () => {
    const onReact = vi.fn()
    const onGated = vi.fn()
    render(
      <PostCard
        post={mockPost}
        gated
        onGated={onGated}
        onComment={() => {}}
        onReact={onReact}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /react/i }))
    expect(onGated).toHaveBeenCalledExactlyOnceWith('react')
    expect(onReact).not.toHaveBeenCalled()
  })

  it('calls onGated with source "comment" instead of onComment when the member is card-gated', () => {
    const onComment = vi.fn()
    const onGated = vi.fn()
    render(
      <PostCard
        post={mockPost}
        gated
        onGated={onGated}
        onComment={onComment}
        onReact={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /comment/i }))
    expect(onGated).toHaveBeenCalledExactlyOnceWith('comment')
    expect(onComment).not.toHaveBeenCalled()
  })

  it('calls onGated with source "linkedin" instead of navigating when "View on LinkedIn" is tapped while gated', () => {
    const onGated = vi.fn()
    render(
      <PostCard
        post={{ ...mockPost, sourceUrl: 'https://www.linkedin.com/posts/test' }}
        gated
        onGated={onGated}
        onComment={() => {}}
        onReact={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('link', { name: /view on linkedin/i }))
    expect(onGated).toHaveBeenCalledExactlyOnceWith('linkedin')
  })

  it('leaves the engagement buttons enabled while gated so the tap is never dead', () => {
    render(
      <PostCard
        post={mockPost}
        gated
        onGated={() => {}}
        onComment={() => {}}
        onReact={() => {}}
      />
    )
    expect(screen.getByRole('button', { name: /react/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /comment/i })).toBeEnabled()
  })

  it('calls the real handlers when not gated', () => {
    const onReact = vi.fn()
    const onGated = vi.fn()
    render(
      <PostCard
        post={mockPost}
        onGated={onGated}
        onComment={() => {}}
        onReact={onReact}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /react/i }))
    expect(onReact).toHaveBeenCalledOnce()
    expect(onGated).not.toHaveBeenCalled()
  })

  it('rings and labels the author avatar for a top-three medal, and neither without one', () => {
    const { container, rerender } = render(
      <PostCard
        post={mockPost}
        authorMedal={1}
        onComment={() => {}}
        onReact={() => {}}
      />
    )
    expect(screen.getByRole('img', { name: 'Top 1 this week' })).toBeInTheDocument()
    expect(container.querySelector('.ring-amber-400')).toBeInTheDocument()
    rerender(
      <PostCard
        post={mockPost}
        onComment={() => {}}
        onReact={() => {}}
      />
    )
    expect(screen.queryByRole('img', { name: /Top .* this week/ })).not.toBeInTheDocument()
    expect(container.querySelector('.ring-2')).not.toBeInTheDocument()
  })
})

// backlog/R21 — a post the viewer already handled shows what they did, keeps only the action they
// have not taken yet, says when it leaves their feed, and offers Hide now.
describe('PostCard done footer (R21)', () => {
  const inFiveHours = Date.now() + 5 * 3_600_000

  it('names what was done, keeps the remaining action and says when the post leaves', () => {
    render(
      <PostCard
        post={{ ...mockPost, viewerState: { reacted: true, commented: false, hidesAt: inFiveHours } }}
        onComment={() => {}}
        onReact={() => {}}
        onHide={() => {}}
      />
    )
    expect(screen.getByText(/reacted/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /react/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /comment/i })).toBeInTheDocument()
    expect(screen.getByText(/leaves in 5 h/i)).toBeInTheDocument()
  })

  it('offers the saved comment once the viewer reacted and commented', () => {
    const onComment = vi.fn()
    render(
      <PostCard
        post={{ ...mockPost, viewerState: { reacted: true, commented: true, hidesAt: inFiveHours } }}
        onComment={onComment}
        onReact={() => {}}
        onHide={() => {}}
      />
    )
    expect(screen.getByText(/reacted · commented/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /react/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /view comment/i }))
    expect(onComment).toHaveBeenCalledWith(mockPost._id)
  })

  // The react button keeps its place as the leftmost action when the viewer commented without
  // reacting, so the footer does not reshape around the reaction.
  it('keeps the react button first when the viewer commented without reacting', () => {
    render(
      <PostCard
        post={{ ...mockPost, viewerState: { reacted: false, commented: true, hidesAt: inFiveHours } }}
        onComment={() => {}}
        onReact={() => {}}
        onHide={() => {}}
      />
    )
    const [first, second] = screen.getAllByRole('button')
    expect(first).toHaveAccessibleName(/react/i)
    expect(second).toHaveAccessibleName(/view comment/i)
    expect(second).toHaveAttribute('title', 'Commented')
  })

  it('shows at most 24 hours when an interaction arrives after the card mounted', () => {
    const mountedAt = Date.now()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(mountedAt)
    try {
      const onComment = vi.fn()
      const onReact = vi.fn()
      const { rerender } = render(
        <PostCard
          post={mockPost}
          onComment={onComment}
          onReact={onReact}
        />
      )
      clock.mockReturnValue(mountedAt + 3_600_000)
      rerender(
        <PostCard
          post={{ ...mockPost, viewerState: { reacted: true, commented: false, hidesAt: Date.now() + 24 * 3_600_000 } }}
          onComment={onComment}
          onReact={onReact}
        />
      )
      expect(screen.getByText(/leaves in 24 h/i)).toBeInTheDocument()
    } finally {
      clock.mockRestore()
    }
  })

  it('rounds the remaining time up so it never says 0 h', () => {
    render(
      <PostCard
        post={{ ...mockPost, viewerState: { reacted: false, commented: true, hidesAt: Date.now() + 1000 } }}
        onComment={() => {}}
        onReact={() => {}}
        onHide={() => {}}
      />
    )
    expect(screen.getByText(/leaves in 1 h/i)).toBeInTheDocument()
  })

  it('calls onHide from the Hide now button', () => {
    const onHide = vi.fn()
    render(
      <PostCard
        post={{ ...mockPost, viewerState: { reacted: true, commented: false, hidesAt: inFiveHours } }}
        onComment={() => {}}
        onReact={() => {}}
        onHide={onHide}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /hide now/i }))
    expect(onHide).toHaveBeenCalledOnce()
  })

  // Mobile layout: row 1 = chips + Hide, row 2 = countdown + View on LinkedIn. The mobile grid is
  // deterministic (and keeps the same two-row height) in every viewer state; the order-* classes
  // put the countdown back before Hide at `sm`+.
  it('lays out a done card as a mobile grid with Hide beside the chips and the countdown below', () => {
    render(
      <PostCard
        post={{
          ...mockPost,
          sourceUrl: 'https://www.linkedin.com/posts/test',
          viewerState: { reacted: true, commented: false, hidesAt: inFiveHours }
        }}
        onComment={() => {}}
        onReact={() => {}}
        onHide={() => {}}
      />
    )
    const actions = screen.getByTestId('post-footer-actions')
    const footer = actions.parentElement as HTMLElement
    const hide = screen.getByRole('button', { name: /hide now/i })
    const countdown = screen.getByText(/leaves in 5 h/i)
    const link = screen.getByRole('link', { name: /view on linkedin/i })

    expect(footer).toHaveClass('max-sm:grid', 'max-sm:grid-cols-[minmax(0,1fr)_auto]')
    expect(actions).toHaveClass('order-1')
    expect(hide).toHaveClass('order-2', 'sm:order-3')
    expect(countdown).toHaveClass('order-3', 'sm:order-2', 'whitespace-nowrap')
    expect(link).toHaveClass('order-4', 'max-sm:ml-auto')
    // Hide, the countdown and the link are direct siblings of the chips, not nested in a trailing
    // cluster wrapper.
    expect(hide.parentElement).toBe(footer)
    expect(countdown.parentElement).toBe(footer)
    expect(link.parentElement).toBe(footer)
    expect(actions).not.toContainElement(hide)
  })

  // An untouched card has no countdown; the link still owns the mobile second row (and the footer
  // keeps its two-row height) instead of drifting under the chips.
  it('keeps the LinkedIn link on the mobile second row when there is no countdown', () => {
    render(
      <PostCard
        post={{ ...mockPost, sourceUrl: 'https://www.linkedin.com/posts/test' }}
        onComment={() => {}}
        onReact={() => {}}
        onHide={() => {}}
      />
    )
    const link = screen.getByRole('link', { name: /view on linkedin/i })
    expect(link).toHaveClass('max-sm:col-start-2', 'max-sm:row-start-2', 'max-sm:justify-self-end')
    expect(screen.queryByText(/leaves in/i)).not.toBeInTheDocument()
  })

  it('keeps the react button first in the normal state', () => {
    render(
      <PostCard
        post={{ ...mockPost, viewerState: null }}
        onComment={() => {}}
        onReact={() => {}}
        onHide={() => {}}
      />
    )
    const [first] = screen.getAllByRole('button')
    expect(first).toHaveAccessibleName(/react/i)
  })

  it('offers Hide instead of Hide now on an untouched post, and calls onHide', () => {
    const onHide = vi.fn()
    render(
      <PostCard
        post={{ ...mockPost, viewerState: null }}
        onComment={() => {}}
        onReact={() => {}}
        onHide={onHide}
      />
    )
    expect(screen.getByRole('button', { name: /react/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /comment/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /hide now/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }))
    expect(onHide).toHaveBeenCalledOnce()
  })
})
