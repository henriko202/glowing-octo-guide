import { vi } from 'vitest'

vi.mock('../convex', () => ({
  api: {
    rankings: {
      getMyRankings: 'rankings.getMyRankings',
      getSiteRankings: 'rankings.getSiteRankings'
    },
    users: { setLeaderboardOptOut: 'users.setLeaderboardOptOut' }
  }
}))

let mockQueryReturns: Record<string, unknown> = {}
const mockSetLeaderboardOptOut = vi.fn()
vi.mock('convex/react', () => ({
  useQuery: (ref: string) => mockQueryReturns[ref],
  useMutation: () => mockSetLeaderboardOptOut
}))

import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import RankingsPage from './RankingsPage'

function person(userId: string, name: string, total: number, postsCount = 2) {
  return {
    userId,
    name,
    headline: undefined,
    profilePictureUrl: undefined,
    reactions: total,
    comments: 0,
    total,
    lastAt: 1,
    postsCount
  }
}

const MINE = {
  window: '7d',
  since: 0,
  truncated: false,
  received: [
    person('r1', 'Ana', 6),
    person('r2', 'Receive Two', 5),
    person('r3', 'Receive Three', 4),
    person('r4', 'Receive Four', 3),
    person('r5', 'Receive Five', 2),
    person('r6', 'Receive Six', 1)
  ],
  made: [
    person('m1', 'Bruno', 6),
    person('m2', 'Made Two', 5),
    person('m3', 'Made Three', 4),
    person('m4', 'Made Four', 3),
    person('m5', 'Made Five', 2),
    person('m6', 'Made Six', 1)
  ]
}

const SITE = {
  window: '7d',
  generatedAt: 123,
  partial: true,
  interactors: [
    {
      userId: 'u3',
      name: 'Carla',
      count: 5,
      lastAt: 3,
      postsTouched: 2,
      position: 1,
      _id: 'u3',
      linkedinPublicIdentifier: undefined
    }
  ],
  posters: [
    {
      userId: 'u4',
      name: 'Diego',
      count: 2,
      lastAt: 4,
      reactionsReceived: 3,
      position: 1,
      _id: 'u4',
      linkedinPublicIdentifier: undefined
    }
  ],
  me: { id: 'me', count: 3, position: 7, movement: 1, optedOut: false }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <RankingsPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  sessionStorage.setItem('sessionToken', 'tok')
  mockSetLeaderboardOptOut.mockClear()
  mockQueryReturns = {
    'rankings.getMyRankings': MINE,
    'rankings.getSiteRankings': SITE
  }
})

describe('RankingsPage', () => {
  it('renders the personal and site boards, the position line and the snapshot caption', () => {
    renderPage()
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('Bruno')).toBeInTheDocument()
    expect(screen.getByText('Diego')).toBeInTheDocument()
    expect(screen.getByText('Carla')).toBeInTheDocument()
    expect(screen.getByText(/You are #7/)).toBeInTheDocument()
    expect(screen.getByText(/Up 1 since yesterday/)).toBeInTheDocument()
    expect(screen.getByText('Window: Last 7 days. The board is a daily snapshot.')).toBeInTheDocument()
    expect(screen.getByText('5 interactions · across 2 posts')).toBeInTheDocument()
    expect(screen.getByText('2 posts · 3 reactions')).toBeInTheDocument()
    expect(screen.getAllByText('5 interactions · 2 posts')).toHaveLength(2)
    expect(screen.getByText(/Next update/)).toBeInTheDocument()
    expect(screen.getByText('Partial data: some activity may be missing from this snapshot.')).toBeInTheDocument()
  })

  it('shows only the top 5 of each personal list and links both titles to the matching /people tab', () => {
    renderPage()
    expect(screen.getByText('Receive Five')).toBeInTheDocument()
    expect(screen.queryByText('Receive Six')).not.toBeInTheDocument()
    expect(screen.getByText('Made Five')).toBeInTheDocument()
    expect(screen.queryByText('Made Six')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Interacted with your posts' })).toHaveAttribute(
      'href',
      '/people?tab=received'
    )
    expect(screen.getByRole('link', { name: 'You interacted with' })).toHaveAttribute('href', '/people?tab=made')
  })

  it('renders the partial line only when the snapshot was truncated', () => {
    mockQueryReturns['rankings.getSiteRankings'] = { ...SITE, partial: false }
    renderPage()
    expect(screen.getByText('Window: Last 7 days. The board is a daily snapshot.')).toBeInTheDocument()
    expect(screen.queryByText('Partial data: some activity may be missing from this snapshot.')).not.toBeInTheDocument()
  })

  it('opts the member out with the inverted current value', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Do not show me in rankings' }))
    expect(mockSetLeaderboardOptOut).toHaveBeenCalledWith({ sessionToken: 'tok', optOut: true })
  })

  it('renders the opt-out as an outline button with an eye-off icon and trailing page padding', () => {
    const { container } = renderPage()
    const button = screen.getByRole('button', { name: 'Do not show me in rankings' })
    expect(button).toHaveAttribute('data-variant', 'outline')
    expect(button).toHaveClass('cursor-pointer', 'w-full', 'sm:w-auto')
    expect(button.querySelector('.lucide-eye-off')).toBeInTheDocument()
    expect(container.firstElementChild).toHaveClass('pb-6')
    expect(container.querySelector('.gap-3')).toBeInTheDocument()
  })

  it('surfaces the personal truncated caption when the read ceiling was hit', () => {
    mockQueryReturns['rankings.getMyRankings'] = { ...MINE, truncated: true }
    renderPage()
    expect(screen.getByText('Showing the 2000 most recent interactions only.')).toBeInTheDocument()
  })

  it('shows the fresh-member line and a feed link at count 0 while keeping the board rendered', () => {
    mockQueryReturns['rankings.getSiteRankings'] = {
      ...SITE,
      me: { id: 'me', count: 0, position: null, movement: null, optedOut: false }
    }
    renderPage()
    expect(screen.getByText('One interaction puts you on this board.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to feed' })).toHaveAttribute('href', '/feed')
    expect(screen.queryByText(/No position in this window yet/)).not.toBeInTheDocument()
    expect(screen.getByText('Carla')).toBeInTheDocument()
    expect(screen.getByText('Diego')).toBeInTheDocument()
  })
})
