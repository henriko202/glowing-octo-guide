import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../convex', () => ({
  api: {
    notifications: {
      listMine: 'notifications.listMine',
      markAllRead: 'notifications.markAllRead',
      markRead: 'notifications.markRead'
    }
  }
}))

interface PaginatedMock {
  results: unknown[]
  status: string
  loadMore: ReturnType<typeof vi.fn>
}

let mockPaginated: Record<string, PaginatedMock> = {}
const { markAllReadMock, markReadMock } = vi.hoisted(() => ({
  markAllReadMock: vi.fn(async () => {}),
  markReadMock: vi.fn(async () => {})
}))
vi.mock('convex/react', () => ({
  useQuery: () => undefined,
  useMutation: (ref: string) => (ref === 'notifications.markAllRead' ? markAllReadMock : markReadMock),
  usePaginatedQuery: (ref: string) => mockPaginated[ref] ?? { results: [], status: 'Exhausted', loadMore: vi.fn() }
}))

import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NotificationsPage from './NotificationsPage'

const LIST = 'notifications.listMine'

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'n1',
    kind: 'reaction',
    createdAt: Date.now(),
    unread: false,
    actorName: 'Ana',
    postExcerpt: 'hello',
    postUrn: 'urn:li:activity:1',
    removed: false,
    ...overrides
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <NotificationsPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  sessionStorage.setItem('sessionToken', 'tok')
  markAllReadMock.mockClear()
  markReadMock.mockClear()
  mockPaginated = { [LIST]: { results: [], status: 'Exhausted', loadMore: vi.fn() } }
})

describe('NotificationsPage', () => {
  it('renders the unread row under the new-since heading', () => {
    mockPaginated[LIST] = {
      results: [makeRow({ unread: true, actorName: 'Ana' }), makeRow({ id: 'n2', actorName: 'Bruno' })],
      status: 'Exhausted',
      loadMore: vi.fn()
    }
    renderPage()
    const heading = screen.getByText('New since your last visit')
    const unreadRow = screen.getByText('Ana reacted to your post')
    expect(heading.compareDocumentPosition(unreadRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('Bruno reacted to your post')).toBeInTheDocument()
  })

  it('renders no divider when no loaded row is unread', () => {
    mockPaginated[LIST] = {
      results: [makeRow(), makeRow({ id: 'n2', actorName: 'Bruno' })],
      status: 'Exhausted',
      loadMore: vi.fn()
    }
    renderPage()
    expect(screen.queryByText('New since your last visit')).not.toBeInTheDocument()
  })

  it('places the divider after the read rows and before the first unread row', () => {
    mockPaginated[LIST] = {
      results: [makeRow({ actorName: 'Ana' }), makeRow({ id: 'n2', unread: true, actorName: 'Bruno' })],
      status: 'Exhausted',
      loadMore: vi.fn()
    }
    renderPage()
    const readRow = screen.getByText('Ana reacted to your post')
    const heading = screen.getByText('New since your last visit')
    const unreadRow = screen.getByText('Bruno reacted to your post')
    expect(readRow.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(heading.compareDocumentPosition(unreadRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('wraps rows in card surfaces and marks the new-since group', () => {
    mockPaginated[LIST] = {
      results: [makeRow({ actorName: 'Ana' }), makeRow({ id: 'n2', unread: true, actorName: 'Bruno' })],
      status: 'Exhausted',
      loadMore: vi.fn()
    }
    renderPage()
    const readList = screen.getByText('Ana reacted to your post').closest('ul')
    const unreadList = screen.getByText('Bruno reacted to your post').closest('ul')
    expect(readList).toHaveClass('flex', 'flex-col', 'gap-3')
    expect(readList).toHaveClass('[&>li]:rounded-xl', '[&>li]:border-border', '[&>li]:bg-card', '[&>li]:p-4')
    expect(readList).not.toHaveClass('[&>li]:border-l-2')
    expect(unreadList).toHaveClass('[&>li]:border-l-2', '[&>li]:border-l-primary')
  })

  it('marks all as read with the session token', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }))
    expect(markAllReadMock).toHaveBeenCalledWith({ sessionToken: 'tok' })
  })

  it('marks the clicked row read with the session token', () => {
    mockPaginated[LIST] = {
      results: [makeRow({ id: 'n7', unread: true, actorName: 'Ana' })],
      status: 'Exhausted',
      loadMore: vi.fn()
    }
    renderPage()
    fireEvent.click(screen.getByRole('link', { name: /Ana reacted to your post/ }))
    expect(markReadMock).toHaveBeenCalledWith({ sessionToken: 'tok', ids: ['n7'] })
  })

  it('disables mark-all when there is no session token', () => {
    sessionStorage.removeItem('sessionToken')
    renderPage()
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeDisabled()
  })

  it('renders the empty state with a link to the feed', () => {
    renderPage()
    expect(
      screen.getByText('Nothing here yet. When someone reacts to or comments on your posts, it shows up here.')
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to the feed' })).toHaveAttribute('href', '/feed')
  })

  it('renders the removed badge for a removed row', () => {
    mockPaginated[LIST] = {
      results: [makeRow({ removed: true })],
      status: 'Exhausted',
      loadMore: vi.fn()
    }
    renderPage()
    expect(screen.getByText('Post removed')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
