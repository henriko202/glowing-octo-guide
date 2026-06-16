import { render, screen, fireEvent } from '@testing-library/react'
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
  author: { name: 'Jane Doe', headline: 'Engineer' }
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

  it('wires the Like button to onReact with the post id', () => {
    const onReact = vi.fn()
    render(
      <PostCard
        post={mockPost}
        onComment={() => {}}
        onReact={onReact}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /like/i }))
    expect(onReact).toHaveBeenCalledWith(mockPost._id)
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
    expect(screen.getByRole('button', { name: /like/i })).toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: /10.*like/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /3.*comment/i })).toBeInTheDocument()
  })
})
