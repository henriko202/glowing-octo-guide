import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PeopleAccordion from './PeopleAccordion'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => `${key}${opts ? JSON.stringify(opts) : ''}`
  })
}))
vi.mock('@/components/LinkedInEmbed', () => ({ buildPostUrl: (urn: string) => `https://ln/${urn}` }))

const post = {
  postId: 'p1',
  excerpt: 'A post about SSI',
  linkedinPostUrn: 'urn:li:activity:1',
  total: 4,
  lastAt: 2,
  removed: false,
  actors: [
    {
      userId: 'u1',
      name: 'Ana',
      headline: 'Founder',
      profilePictureUrl: undefined,
      reaction: 'LIKE' as const,
      reactions: 2,
      comments: 0,
      total: 2,
      lastAt: 1
    },
    {
      userId: 'u2',
      name: 'Bea',
      headline: 'CTO',
      profilePictureUrl: undefined,
      reaction: undefined,
      reactions: 2,
      comments: 0,
      total: 2,
      lastAt: 2
    }
  ]
}

describe('PeopleAccordion', () => {
  it('renders the post as a card surface and toggles the actor panel', () => {
    const { container } = render(<PeopleAccordion posts={[post]} />)
    expect(container.querySelector('li')).toHaveClass('rounded-xl', 'border', 'border-border', 'bg-card', 'shadow-xs')
    const toggle = screen.getByRole('button', { name: /people\.accordionToggle/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Ana')).toBeInTheDocument()
    fireEvent.click(toggle)
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
  })

  it('renders the aggregate reaction and comment chips summed over the actors', () => {
    render(<PeopleAccordion posts={[post]} />)
    expect(screen.getByText('people.tallyReactions{"count":4}')).toBeInTheDocument()
    expect(screen.getByText('people.tallyComments{"count":0}')).toBeInTheDocument()
    expect(screen.queryByText('people.count{"count":4}')).not.toBeInTheDocument()
  })

  it('does not render per-user reaction or comment tallies in the expanded actor rows', () => {
    render(<PeopleAccordion posts={[post]} />)
    fireEvent.click(screen.getByRole('button', { name: /people\.accordionToggle/ }))
    expect(screen.getByText('people.tallyReactions{"count":4}')).toBeInTheDocument()
    expect(screen.queryByText('people.tallyReactions{"count":2}')).not.toBeInTheDocument()
  })

  it('stacks at most four actors and collapses the rest into a +N chip', () => {
    const stackPost = {
      ...post,
      postId: 'p3',
      total: 6,
      actors: ['Ana', 'Bea', 'Caio', 'Duda', 'Eva', 'Fabio'].map((name, index) => ({
        userId: `u${index}`,
        name,
        reactions: 1,
        comments: 0,
        total: 1,
        lastAt: index
      }))
    }
    const { container } = render(<PeopleAccordion posts={[stackPost]} />)
    for (const initial of ['A', 'B', 'C', 'D']) {
      expect(screen.getByText(initial)).toBeInTheDocument()
    }
    expect(container.querySelectorAll('.size-8')).toHaveLength(4)
    expect(screen.queryByText('E')).not.toBeInTheDocument()
    expect(screen.getByText('people.morePeople{"count":2}')).toBeInTheDocument()
  })

  it('renders the reaction emoji and the LinkedIn link in the expanded panel', () => {
    render(<PeopleAccordion posts={[post]} />)
    fireEvent.click(screen.getByRole('button', { name: /people\.accordionToggle/ }))
    expect(screen.getByLabelText('reactions.like')).toHaveTextContent('👍')
    expect(screen.getByRole('link', { name: 'feed.viewOnLinkedIn' })).toHaveAttribute(
      'href',
      'https://ln/urn:li:activity:1'
    )
  })

  it('shows the comment glyph in an actor row only when that actor commented', () => {
    const commentPost = {
      ...post,
      postId: 'p2',
      total: 1,
      actors: [
        { ...post.actors[0]!, userId: 'u2', name: 'Bea', reaction: undefined, reactions: 0, comments: 1, total: 1 }
      ]
    }
    const { container } = render(<PeopleAccordion posts={[commentPost]} />)
    expect(container.querySelectorAll('.lucide-message-square')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /people\.accordionToggle/ }))
    expect(container.querySelectorAll('.lucide-message-square')).toHaveLength(2)
  })
})
