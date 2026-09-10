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

  it('falls back to the author industry when there is no headline', () => {
    render(
      <PostCard
        post={{ ...mockPost, author: { name: 'Léo Martins', industry: 'Fintech' } }}
        onComment={() => {}}
        onReact={() => {}}
      />
    )
    expect(screen.getByText('Fintech')).toBeInTheDocument()
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
    expect(screen.getByText(/leaves your feed within 5 h/i)).toBeInTheDocument()
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
    fireEvent.click(screen.getByRole('button', { name: /view generated comment/i }))
    expect(onComment).toHaveBeenCalledWith(mockPost._id)
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
      expect(screen.getByText(/leaves your feed within 24 h/i)).toBeInTheDocument()
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
    expect(screen.getByText(/leaves your feed within 1 h/i)).toBeInTheDocument()
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

  it('renders the normal footer, with no Hide now, for an untouched post', () => {
    render(
      <PostCard
        post={{ ...mockPost, viewerState: null }}
        onComment={() => {}}
        onReact={() => {}}
        onHide={() => {}}
      />
    )
    expect(screen.getByRole('button', { name: /react/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /comment/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /hide now/i })).not.toBeInTheDocument()
  })
})
