import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => `${key}${opts ? JSON.stringify(opts) : ''}`
  })
}))
vi.mock('@/components/LinkedInEmbed', () => ({ buildPostUrl: (urn: string) => `https://ln/${urn}` }))

import PeopleAccordion from './PeopleAccordion'

const post = {
  postId: 'p1',
  excerpt: 'A post about SSI',
  linkedinPostUrn: 'urn:li:activity:1',
  total: 2,
  lastAt: Date.now(),
  removed: false,
  actors: [
    {
      userId: 'u1',
      name: 'Ana',
      headline: 'Founder',
      profilePictureUrl: undefined,
      reactions: 2,
      comments: 0,
      total: 2,
      lastAt: Date.now()
    }
  ]
}

describe('PeopleAccordion', () => {
  it('starts collapsed and expands to the actor rows', () => {
    render(<PeopleAccordion posts={[post]} />)
    expect(screen.queryByText(/Ana/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /people\.accordionToggle/ }))
    expect(screen.getByText(/Ana/)).toBeInTheDocument()
  })

  it('renders the post total in the header', () => {
    render(<PeopleAccordion posts={[post]} />)
    expect(screen.getByText('people.count{"count":2}')).toBeInTheDocument()
  })

  it('renders a comment glyph for commenters and a reaction glyph otherwise', () => {
    const commentPost = {
      ...post,
      postId: 'p2',
      total: 1,
      actors: [{ ...post.actors[0]!, userId: 'u2', name: 'Bea', reactions: 0, comments: 1, total: 1 }]
    }
    const { container } = render(<PeopleAccordion posts={[post, commentPost]} />)
    for (const button of screen.getAllByRole('button', { name: /people\.accordionToggle/ })) fireEvent.click(button)
    expect(container.querySelector('.lucide-thumbs-up')).toBeInTheDocument()
    expect(container.querySelector('.lucide-message-square')).toBeInTheDocument()
  })
})
