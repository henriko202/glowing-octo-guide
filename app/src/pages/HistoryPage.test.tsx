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
import { TooltipProvider } from '@/components/ui/tooltip'
import i18n from '@/i18n'
import HistoryPage from './HistoryPage'

const DAY = 86_400_000
const POST_A = { id: 'pA', linkedinPostUrn: 'urn:li:share:a', excerpt: 'Post A', authorName: 'Ana', removed: false }
const POST_B = { id: 'pB', linkedinPostUrn: 'urn:li:share:b', excerpt: 'Post B', authorName: 'Bo', removed: false }
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

// The Tooltip primitive needs a provider (mounted in main.tsx in the app).
function renderPage() {
  return render(
    <TooltipProvider>
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>
    </TooltipProvider>
  )
}

beforeEach(() => {
  sessionStorage.setItem('sessionToken', 'tok')
  vi.mocked(usePaginatedQuery).mockClear()
  mockPaginated = { results: ROWS, status: 'Exhausted', loadMore: vi.fn() }
})

describe('HistoryPage', () => {
  it('renders first-person action labels, comments verbatim, author, removed badges and post links', () => {
    renderPage()
    expect(screen.getByText('You reacted with Celebrate')).toBeInTheDocument()
    expect(screen.getByText('You commented')).toBeInTheDocument()
    expect(screen.getByText(/Great point/)).toBeInTheDocument()
    expect(screen.getByText('by Ana')).toBeInTheDocument()
    expect(screen.getAllByText('Post removed')).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: /View on LinkedIn/ })).toHaveLength(2)
    expect(screen.getByText('2 days ago')).toBeInTheDocument()
    const card = screen.getByText('by Ana').closest('li')
    expect(card).toHaveClass('rounded-xl', 'border', 'border-border', 'bg-card', 'p-4', 'shadow-xs')
    expect(card?.parentElement).toHaveClass('flex', 'flex-col', 'gap-3')
  })

  it('folds consecutive rows on the same post into one card with one chip per action and the text once', () => {
    mockPaginated = {
      results: [
        { id: 'g1', kind: 'comment', comment: 'Shared body', createdAt: Date.now(), post: POST_A },
        { id: 'g2', kind: 'reaction', reaction: 'LIKE', createdAt: Date.now() - 1000, post: POST_A },
        { id: 'g3', kind: 'ai_draft', comment: 'Shared body', createdAt: Date.now() - 2000, post: POST_A }
      ],
      status: 'Exhausted',
      loadMore: vi.fn()
    }
    renderPage()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('You commented')).toBeInTheDocument()
    expect(screen.getByText('You reacted with Like')).toBeInTheDocument()
    expect(screen.getByText('You used an AI draft')).toBeInTheDocument()
    expect(screen.getAllByText('Shared body')).toHaveLength(1)
    expect(screen.getByText('by Ana')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /View on LinkedIn/ })).toHaveLength(1)
  })

  it('shows the exact localized date and time in a tooltip on focus', async () => {
    renderPage()
    const time = screen.getByText('2 days ago')
    expect(time).not.toHaveAttribute('title')
    fireEvent.focus(time)
    const expected = new Date(ROWS[0]!.createdAt).toLocaleString(i18n.language)
    expect(await screen.findByRole('tooltip')).toHaveTextContent(expected)
  })

  it('keeps the newest timestamp for a group whose rows are not perfectly ordered', () => {
    const newest = Date.now()
    mockPaginated = {
      results: [
        { id: 't1', kind: 'reaction', reaction: 'LIKE', createdAt: newest - 5000, post: POST_A },
        { id: 't2', kind: 'comment', comment: 'Later text', createdAt: newest, post: POST_A }
      ],
      status: 'Exhausted',
      loadMore: vi.fn()
    }
    renderPage()
    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('renders two cards when the same post is separated by another post', () => {
    mockPaginated = {
      results: [
        { id: 's1', kind: 'reaction', reaction: 'LIKE', createdAt: Date.now(), post: POST_A },
        { id: 's2', kind: 'reaction', reaction: 'PRAISE', createdAt: Date.now() - 1000, post: POST_B },
        { id: 's3', kind: 'reaction', reaction: 'LIKE', createdAt: Date.now() - 2000, post: POST_A }
      ],
      status: 'Exhausted',
      loadMore: vi.fn()
    }
    renderPage()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getAllByText('by Ana')).toHaveLength(2)
    expect(screen.getAllByText('You reacted with Like')).toHaveLength(2)
  })

  it('keeps the removed badge once on a grouped removed post', () => {
    mockPaginated = {
      results: [
        { id: 'r1', kind: 'reaction', reaction: 'LIKE', createdAt: Date.now(), post: { ...POST_A, removed: true } },
        {
          id: 'r2',
          kind: 'comment',
          comment: 'Still here',
          createdAt: Date.now() - 1000,
          post: { ...POST_A, removed: true }
        }
      ],
      status: 'Exhausted',
      loadMore: vi.fn()
    }
    renderPage()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getAllByText('Post removed')).toHaveLength(1)
  })

  it('holds the card height with skeleton cards while the first page loads', () => {
    mockPaginated = { results: [], status: 'LoadingFirstPage', loadMore: vi.fn() }
    const { container } = renderPage()
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons).toHaveLength(3)
    skeletons.forEach(card => expect(card).toHaveClass('h-32'))
  })

  it('loads more while the cursor is open', () => {
    mockPaginated = { results: ROWS, status: 'CanLoadMore', loadMore: vi.fn() }
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(mockPaginated.loadMore).toHaveBeenCalledWith(20)
  })

  it('renders an AI draft row with its first-person label and the draft text', () => {
    mockPaginated = {
      results: [
        {
          id: 'i4',
          kind: 'ai_draft',
          comment: 'A drafted comment.',
          createdAt: Date.now(),
          post: { id: 'p3', linkedinPostUrn: 'urn:li:share:3', excerpt: 'Target', authorName: 'Cy', removed: false }
        }
      ],
      status: 'Exhausted',
      loadMore: vi.fn()
    }
    renderPage()
    expect(screen.getByText('You used an AI draft')).toBeInTheDocument()
    expect(screen.getByText('A drafted comment.')).toBeInTheDocument()
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
