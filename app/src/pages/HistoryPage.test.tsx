import { vi } from 'vitest'

vi.mock('../convex', () => ({
  api: { interactions: { listMyInteractions: 'interactions.listMyInteractions' } }
}))

let mockPaginated: { results: unknown[]; status: string; loadMore: ReturnType<typeof vi.fn> } = {
  results: [],
  status: 'Exhausted',
  loadMore: vi.fn()
}
vi.mock('convex/react', () => ({
  usePaginatedQuery: vi.fn(() => mockPaginated)
}))

import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { usePaginatedQuery } from 'convex/react'
import { beforeEach, describe, expect, it } from 'vitest'
import HistoryPage from './HistoryPage'

const DAY = 86_400_000
const ROWS = [
  {
    id: 'i1',
    kind: 'reaction',
    reaction: 'PRAISE',
    createdAt: Date.now() - 2 * DAY,
    post: { id: 'p1', linkedinPostUrn: 'urn:li:share:1', excerpt: 'A post', authorName: 'Ana', removed: false }
  },
  {
    id: 'i2',
    kind: 'comment',
    comment: 'Great point,\nthanks',
    createdAt: Date.now(),
    post: { id: 'p2', linkedinPostUrn: 'urn:li:share:2', excerpt: 'Gone', authorName: 'Bo', removed: true }
  },
  { id: 'i3', kind: 'reaction', reaction: 'LIKE', createdAt: Date.now(), post: null }
]

function renderPage() {
  return render(
    <MemoryRouter>
      <HistoryPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  sessionStorage.setItem('sessionToken', 'tok')
  vi.mocked(usePaginatedQuery).mockClear()
  mockPaginated = { results: ROWS, status: 'Exhausted', loadMore: vi.fn() }
})

describe('HistoryPage', () => {
  it('renders reactions by label, comments verbatim, author, removed badges and post links', () => {
    renderPage()
    expect(screen.getByText('Celebrate')).toBeInTheDocument()
    expect(screen.getByText(/Great point/)).toBeInTheDocument()
    expect(screen.getByText('by Ana')).toBeInTheDocument()
    expect(screen.getAllByText('Post removed')).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: /View on LinkedIn/ })).toHaveLength(2)
    expect(screen.getByText('2 days ago')).toBeInTheDocument()
  })

  it('loads more while the cursor is open', () => {
    mockPaginated = { results: ROWS, status: 'CanLoadMore', loadMore: vi.fn() }
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(mockPaginated.loadMore).toHaveBeenCalledWith(20)
  })

  it('expands a long comment on demand', () => {
    mockPaginated = {
      results: [{ ...ROWS[1], comment: 'x'.repeat(300) }],
      status: 'Exhausted',
      loadMore: vi.fn()
    }
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }))
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument()
  })

  it('shows the empty state and queries all time when asked', () => {
    mockPaginated = { results: [], status: 'Exhausted', loadMore: vi.fn() }
    renderPage()
    expect(screen.getByText('No interactions in this window.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to the feed' })).toHaveAttribute('href', '/feed')
    fireEvent.click(screen.getByRole('button', { name: 'All time' }))
    const askedAll = vi
      .mocked(usePaginatedQuery)
      .mock.calls.some(([, args]) => (args as { since?: number })?.since === 0)
    expect(askedAll).toBe(true)
  })
})
