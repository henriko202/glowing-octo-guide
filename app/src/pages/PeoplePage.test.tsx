import { vi } from 'vitest'

vi.mock('../convex', () => ({
  api: {
    interactions: {
      listPeopleIInteractedWith: 'interactions.listPeopleIInteractedWith',
      listInteractionsByPost: 'interactions.listInteractionsByPost'
    },
    users: { listMembers: 'users.listMembers' },
    search: { search: 'search.search' }
  }
}))

let mockQueryReturns: Record<string, unknown> = {}
let queryCalls: Array<[string, unknown]> = []
interface PaginatedMock {
  results: unknown[]
  status: string
  loadMore: ReturnType<typeof vi.fn>
}
let mockPaginatedReturns: Record<string, PaginatedMock> = {}
vi.mock('convex/react', () => ({
  useQuery: (ref: string, args?: unknown) => {
    queryCalls.push([ref, args])
    return mockQueryReturns[ref]
  },
  usePaginatedQuery: (ref: string) =>
    mockPaginatedReturns[ref] ?? { results: [], status: 'Exhausted', loadMore: vi.fn() }
}))

import { act, fireEvent, render, screen } from '@testing-library/react'
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
      reactions: 0,
      comments: 1,
      total: 1,
      lastAt: Date.now()
    }
  ]
}

const MEMBERS = {
  page: [
    {
      _id: 'u3',
      name: 'Carla',
      headline: 'Designer',
      profilePictureUrl: undefined,
      linkedinPublicIdentifier: undefined
    }
  ],
  isDone: true,
  continueCursor: ''
}

function member(id: string, name: string, headline: string) {
  return { _id: id, name, headline, profilePictureUrl: undefined, linkedinPublicIdentifier: undefined }
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
  mockPaginatedReturns = {
    'users.listMembers': { results: MEMBERS.page, status: 'Exhausted', loadMore: vi.fn() }
  }
})

describe('PeoplePage', () => {
  it('renders the three tabs and the window toggle', () => {
    renderPage()
    expect(screen.getByRole('tab', { name: 'Interacted with you' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'You interacted with' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'All members' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Last 7 days' })).toBeInTheDocument()
  })

  it('opens the tab named by the tab query param', () => {
    renderPage(['/?tab=made'])
    expect(screen.getByRole('tab', { name: 'You interacted with' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Bruno')).toBeInTheDocument()
  })

  it('expands a received post and shows the actor', () => {
    renderPage()
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /View people/ }))
    expect(screen.getByText('Ana')).toBeInTheDocument()
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

  it('shows the made list with the interaction count', () => {
    renderPage()
    fireEvent.click(screen.getByRole('tab', { name: 'You interacted with' }))
    expect(screen.getByText('Bruno')).toBeInTheDocument()
    expect(screen.getByText('1 interaction')).toBeInTheDocument()
  })

  it('shows the members directory in the all tab', () => {
    renderPage()
    fireEvent.click(screen.getByRole('tab', { name: 'All members' }))
    expect(screen.getByText('Carla')).toBeInTheDocument()
  })

  it('sorts each loaded directory page alphabetically', () => {
    mockPaginatedReturns['users.listMembers'] = {
      results: [member('u9', 'Zara', 'Analyst'), member('u3', 'Carla', 'Designer')],
      status: 'Exhausted',
      loadMore: vi.fn()
    }
    renderPage()
    fireEvent.click(screen.getByRole('tab', { name: 'All members' }))
    const names = screen.getAllByText(/Carla|Zara/).map(el => el.textContent)
    expect(names).toEqual(['Carla', 'Zara'])
  })

  it('loads more directory members on demand', () => {
    const loadMore = vi.fn()
    mockPaginatedReturns['users.listMembers'] = { results: MEMBERS.page, status: 'CanLoadMore', loadMore }
    renderPage()
    fireEvent.click(screen.getByRole('tab', { name: 'All members' }))
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(loadMore).toHaveBeenCalledWith(50)
  })

  it('renders the directory empty state', () => {
    mockPaginatedReturns['users.listMembers'] = { results: [], status: 'Exhausted', loadMore: vi.fn() }
    renderPage()
    fireEvent.click(screen.getByRole('tab', { name: 'All members' }))
    expect(screen.getByText('No members to show yet.')).toBeInTheDocument()
  })

  it('searches members through api.search.search after a debounce and renders its people', () => {
    vi.useFakeTimers()
    try {
      mockQueryReturns['search.search'] = {
        posts: [],
        people: [
          {
            _id: 'u9',
            name: 'Zara',
            headline: 'Analyst',
            profilePictureUrl: undefined,
            linkedinPublicIdentifier: undefined
          }
        ]
      }
      renderPage()
      fireEvent.click(screen.getByRole('tab', { name: 'All members' }))
      fireEvent.change(screen.getByRole('searchbox', { name: 'Search members' }), { target: { value: 'za' } })
      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(queryCalls).toContainEqual(['search.search', { sessionToken: 'tok', queryText: 'za' }])
      expect(screen.getByText('Zara')).toBeInTheDocument()
      expect(screen.queryByText('Carla')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the paginated directory below the two-character minimum', () => {
    mockQueryReturns['search.search'] = { posts: [], people: [] }
    renderPage()
    fireEvent.click(screen.getByRole('tab', { name: 'All members' }))
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search members' }), { target: { value: 'z' } })
    expect(queryCalls.filter(([ref, args]) => ref === 'search.search' && args !== 'skip')).toHaveLength(0)
    expect(screen.getByText('Carla')).toBeInTheDocument()
  })
})
