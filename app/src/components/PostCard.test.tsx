import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PostCard, { ReactionOptions, type PostWithAuthor } from './PostCard'

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

  it('renders all six reactions and calls onSelect with the chosen value', () => {
    const onSelect = vi.fn()
    render(
      <ReactionOptions
        suggested="LIKE"
        onSelect={onSelect}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /celebrate/i }))
    expect(onSelect).toHaveBeenCalledWith('PRAISE')
  })

  it('pre-highlights the suggested reaction', () => {
    render(
      <ReactionOptions
        suggested="INTEREST"
        onSelect={() => {}}
      />
    )
    expect(screen.getByRole('button', { name: /insightful/i })).toHaveAttribute('aria-pressed', 'true')
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
})
