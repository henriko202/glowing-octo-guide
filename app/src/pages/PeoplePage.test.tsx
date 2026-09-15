import { vi } from 'vitest'

vi.mock('../convex', () => ({
  api: {
    interactions: {
      listPeopleIInteractedWith: 'interactions.listPeopleIInteractedWith',
      listInteractionsByPost: 'interactions.listInteractionsByPost'
    }
  }
}))

let mockQueryReturns: Record<string, unknown> = {}
let queryCalls: Array<[string, unknown]> = []
vi.mock('convex/react', () => ({
  useQuery: (ref: string, args?: unknown) => {
    queryCalls.push([ref, args])
    return mockQueryReturns[ref]
  }
}))

import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import PeoplePage from './PeoplePage'

const POST = {
  postId: 'p1',
  excerpt: 'A post about SSI',
  total: 2,
  lastAt: Date.now(),
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
      lastAt: Date.now()
    }
  ]
}

const MADE = {
  window: '7d',
  since: 0,
  total: 1,
  truncated: false,
  people: [
    {
      _id: 'u2',
      userId: 'u2',
      name: 'Bruno',
      headline: 'CTO',
      profilePictureUrl: undefined,
      linkedinPublicIdentifier: undefined,
      reaction: undefined,
      reactions: 0,
      comments: 1,
      total: 1,
      lastAt: Date.now(),
      postsCount: 2
    }
  ]
}

function renderPage(initialEntries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <PeoplePage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  sessionStorage.setItem('sessionToken', 'tok')
  queryCalls = []
  mockQueryReturns = {
    'interactions.listInteractionsByPost': { window: '7d', since: 0, total: 2, truncated: false, posts: [POST] },
    'interactions.listPeopleIInteractedWith': MADE
  }
})

describe('PeoplePage', () => {
  it('renders only the two interaction tabs and the window toggle', () => {
    renderPage()
    expect(screen.getByRole('tab', { name: 'Interacted with you' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'You interacted with' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'All members' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Last 7 days' })).toBeInTheDocument()
  })

  it('opens the tab named by the tab query param', () => {
    renderPage(['/?tab=made'])
    expect(screen.getByRole('tab', { name: 'You interacted with' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Bruno')).toBeInTheDocument()
  })

  it('falls back to the received tab for an unknown tab query param', () => {
    renderPage(['/?tab=all'])
    expect(screen.getByRole('tab', { name: 'Interacted with you' })).toHaveAttribute('aria-selected', 'true')
    expect(queryCalls).toContainEqual([
      'interactions.listInteractionsByPost',
      { sessionToken: 'tok', window: '7d', now: expect.any(Number) }
    ])
  })

  it('shows the aggregate tallies on the card and expands to the actor list', () => {
    renderPage()
    expect(screen.getByText('2 reactions')).toBeInTheDocument()
    expect(screen.getByText('0 comments')).toBeInTheDocument()
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /View people/ }))
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByLabelText('Like')).toHaveTextContent('👍')
    expect(screen.queryByText('2 reactions, 0 comments')).not.toBeInTheDocument()
  })

  it('renders the empty state when no one interacted in the window', () => {
    mockQueryReturns['interactions.listInteractionsByPost'] = {
      window: '7d',
      since: 0,
      total: 0,
      truncated: false,
      posts: []
    }
    renderPage()
    expect(screen.getByText('No one interacted with your posts in this window yet.')).toBeInTheDocument()
  })

  it('offers the graph starter with the made count and a feed link when received is empty and made < 3', () => {
    mockQueryReturns['interactions.listInteractionsByPost'] = {
      window: '7d',
      since: 0,
      total: 0,
      truncated: false,
      posts: []
    }
    mockQueryReturns['interactions.listPeopleIInteractedWith'] = { ...MADE, total: 0, people: [] }
    renderPage()
    expect(screen.getByText('No one interacted with your posts in this window yet.')).toBeInTheDocument()
    expect(screen.getByText('Your graph starts with 3 interactions - 0 of 3')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to feed' })).toHaveAttribute('href', '/feed')
    expect(queryCalls).toContainEqual([
      'interactions.listPeopleIInteractedWith',
      { sessionToken: 'tok', window: '7d', now: expect.any(Number) }
    ])
  })

  it('keeps the plain received empty text once the member made 3 interactions', () => {
    mockQueryReturns['interactions.listInteractionsByPost'] = {
      window: '7d',
      since: 0,
      total: 0,
      truncated: false,
      posts: []
    }
    mockQueryReturns['interactions.listPeopleIInteractedWith'] = { ...MADE, total: 3, people: [] }
    renderPage()
    expect(screen.getByText('No one interacted with your posts in this window yet.')).toBeInTheDocument()
    expect(screen.queryByText(/Your graph starts with 3 interactions/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Go to feed' })).not.toBeInTheDocument()
  })

  it('shows the made list with the interaction count and the authored post count as the row metric', () => {
    renderPage()
    fireEvent.click(screen.getByRole('tab', { name: 'You interacted with' }))
    expect(screen.getByText('Bruno')).toBeInTheDocument()
    expect(screen.getByText('1 interaction · 2 posts')).toBeInTheDocument()
  })

  it('shows the truncated caption when a read hit the row ceiling', () => {
    mockQueryReturns['interactions.listInteractionsByPost'] = {
      window: '7d',
      since: 0,
      total: 2,
      truncated: true,
      posts: [POST]
    }
    renderPage()
    expect(screen.getByText('Showing the 2000 most recent interactions only.')).toBeInTheDocument()
  })
})
