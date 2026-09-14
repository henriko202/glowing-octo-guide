import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../convex', () => ({
  api: {
    notifications: {
      getUnreadCount: 'notifications.getUnreadCount',
      listMine: 'notifications.listMine',
      getLatest: 'notifications.getLatest',
      markAllRead: 'notifications.markAllRead',
      markRead: 'notifications.markRead'
    }
  }
}))

let mockQueryReturns: Record<string, unknown> = {}
const { markAllReadMock, markReadMock } = vi.hoisted(() => ({
  markAllReadMock: vi.fn(async () => {}),
  markReadMock: vi.fn(async () => {})
}))
vi.mock('convex/react', () => ({
  useQuery: (ref: string) => mockQueryReturns[ref],
  useMutation: (ref: string) => (ref === 'notifications.markAllRead' ? markAllReadMock : markReadMock),
  usePaginatedQuery: (ref: string) => {
    const value = mockQueryReturns[ref] as { page?: unknown[] } | undefined
    return { results: value?.page ?? [], status: 'CanLoadMore', loadMore: vi.fn() }
  }
}))
vi.mock('react-router-dom', () => ({ Link: ({ children }: { children: ReactNode }) => <span>{children}</span> }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => `${key}${opts ? JSON.stringify(opts) : ''}`
  })
}))
const { toastSpy } = vi.hoisted(() => ({ toastSpy: vi.fn() }))
vi.mock('@/components/ui/toast', () => ({
  toast: (m: string, opts?: unknown) => (opts ? toastSpy(m, opts) : toastSpy(m))
}))

import NotificationBell from './NotificationBell'

beforeEach(() => {
  sessionStorage.setItem('sessionToken', 'tok')
  mockQueryReturns = {}
  toastSpy.mockClear()
  markAllReadMock.mockClear()
  markReadMock.mockClear()
})

describe('NotificationBell', () => {
  it('shows the unread badge and the popover rows', () => {
    mockQueryReturns['notifications.getUnreadCount'] = 3
    mockQueryReturns['notifications.listMine'] = {
      page: [
        {
          id: 'n1',
          kind: 'comment',
          excerpt: 'nice',
          createdAt: Date.now(),
          unread: true,
          actorName: 'Ana',
          postExcerpt: 'hello',
          postUrn: 'urn:1',
          removed: false
        }
      ],
      status: 'CanLoadMore',
      loadMore: vi.fn()
    }
    mockQueryReturns['notifications.getLatest'] = null
    render(<NotificationBell />)
    expect(screen.getByRole('button', { name: /notifications\.bellLabel.*3/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /notifications\.bellLabel.*3/ }))
    expect(screen.getByText(/Ana/)).toBeInTheDocument()
  })

  it('marks a preview row read when it is opened', () => {
    mockQueryReturns['notifications.getUnreadCount'] = 3
    mockQueryReturns['notifications.listMine'] = {
      page: [
        {
          id: 'n1',
          kind: 'comment',
          excerpt: 'nice',
          createdAt: Date.now(),
          unread: true,
          actorName: 'Ana',
          postExcerpt: 'hello',
          postUrn: 'urn:1',
          removed: false
        }
      ],
      status: 'CanLoadMore',
      loadMore: vi.fn()
    }
    mockQueryReturns['notifications.getLatest'] = null
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notifications\.bellLabel.*3/ }))
    fireEvent.click(screen.getByRole('link', { name: /Ana/ }))
    expect(markReadMock).toHaveBeenCalledWith({ sessionToken: 'tok', ids: ['n1'] })
  })

  it('toasts only when a newer notification id appears after mount', () => {
    mockQueryReturns['notifications.getUnreadCount'] = 0
    mockQueryReturns['notifications.listMine'] = { page: [], status: 'CanLoadMore', loadMore: vi.fn() }
    mockQueryReturns['notifications.getLatest'] = { _id: 'n1', actorName: 'Ana', kind: 'comment' }
    const { rerender } = render(<NotificationBell />)
    expect(toastSpy).not.toHaveBeenCalled() // first sighting seeds the id, never toasts
    mockQueryReturns['notifications.getLatest'] = { _id: 'n2', actorName: 'Bruno', kind: 'reaction' }
    rerender(<NotificationBell />)
    expect(toastSpy).toHaveBeenCalledTimes(1)
    expect(toastSpy).toHaveBeenCalledWith('notifications.toastReaction{"name":"Bruno"}')
  })

  it('opens the post when the new-notification toast is clicked', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    try {
      mockQueryReturns['notifications.getUnreadCount'] = 0
      mockQueryReturns['notifications.listMine'] = { page: [], status: 'CanLoadMore', loadMore: vi.fn() }
      mockQueryReturns['notifications.getLatest'] = {
        _id: 'n1',
        actorName: 'Ana',
        kind: 'comment',
        postUrn: 'urn:li:activity:1',
        removed: false
      }
      const { rerender } = render(<NotificationBell />)
      mockQueryReturns['notifications.getLatest'] = {
        _id: 'n2',
        actorName: 'Ana',
        kind: 'comment',
        postUrn: 'urn:li:activity:2',
        removed: false
      }
      rerender(<NotificationBell />)
      const options = toastSpy.mock.calls[0]?.[1] as { onClick?: () => void } | undefined
      expect(options?.onClick).toBeTypeOf('function')
      options?.onClick?.()
      expect(openSpy).toHaveBeenCalledWith(
        'https://www.linkedin.com/feed/update/urn:li:activity:2/',
        '_blank',
        'noopener,noreferrer'
      )
    } finally {
      openSpy.mockRestore()
    }
  })

  it('toasts without a clickable opener when the latest post is removed', () => {
    mockQueryReturns['notifications.getUnreadCount'] = 0
    mockQueryReturns['notifications.listMine'] = { page: [], status: 'CanLoadMore', loadMore: vi.fn() }
    mockQueryReturns['notifications.getLatest'] = { _id: 'n1', actorName: 'Ana', kind: 'comment' }
    const { rerender } = render(<NotificationBell />)
    mockQueryReturns['notifications.getLatest'] = {
      _id: 'n2',
      actorName: 'Ana',
      kind: 'comment',
      postUrn: 'urn:li:activity:2',
      removed: true
    }
    rerender(<NotificationBell />)
    expect(toastSpy).toHaveBeenCalledTimes(1)
    expect(toastSpy).toHaveBeenCalledWith('notifications.toastComment{"name":"Ana"}')
  })

  it('toasts the first notification when the inbox resolves empty at mount (null -> first id)', () => {
    mockQueryReturns['notifications.getUnreadCount'] = 0
    mockQueryReturns['notifications.listMine'] = { page: [], status: 'CanLoadMore', loadMore: vi.fn() }
    mockQueryReturns['notifications.getLatest'] = null
    const { rerender } = render(<NotificationBell />)
    expect(toastSpy).not.toHaveBeenCalled() // resolved-null seeds too, it never toasts
    mockQueryReturns['notifications.getLatest'] = { _id: 'n1', actorName: 'Ana', kind: 'comment' }
    rerender(<NotificationBell />)
    expect(toastSpy).toHaveBeenCalledTimes(1)
    expect(toastSpy).toHaveBeenCalledWith('notifications.toastComment{"name":"Ana"}')
    rerender(<NotificationBell />)
    expect(toastSpy).toHaveBeenCalledTimes(1)
  })
})
