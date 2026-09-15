import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import NotificationRow, { type NotificationRowData } from './NotificationRow'

function makeRow(overrides: Partial<NotificationRowData> = {}): NotificationRowData {
  return {
    id: 'n1',
    kind: 'reaction',
    unread: false,
    actorName: 'Ana',
    postExcerpt: 'hello',
    postUrn: 'urn:li:activity:1',
    removed: false,
    ...overrides
  }
}

describe('NotificationRow', () => {
  it('styles unread rows and links to the post', () => {
    render(
      <ul>
        <NotificationRow
          row={makeRow({ unread: true })}
          timeLabel="just now"
        />
      </ul>
    )
    expect(screen.getByText('Ana reacted to your post').closest('li')).toHaveClass('bg-muted/60')
    expect(screen.getByRole('link', { name: /Ana reacted/ })).toHaveAttribute(
      'href',
      'https://www.linkedin.com/feed/update/urn:li:activity:1/'
    )
  })

  it('renders removed rows without a link', () => {
    render(
      <ul>
        <NotificationRow
          row={makeRow({ removed: true })}
          timeLabel="just now"
        />
      </ul>
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('Ana reacted to your post').closest('li')).not.toHaveClass('bg-muted/60')
  })

  it('shows the View on LinkedIn affordance on live rows and never on removed rows', () => {
    const { rerender } = render(
      <ul>
        <NotificationRow
          row={makeRow()}
          timeLabel="just now"
        />
      </ul>
    )
    const link = screen.getByRole('link', { name: /Ana reacted/ })
    expect(link).toHaveTextContent('View on LinkedIn ↗')
    expect(link.querySelector('svg')).toBeInTheDocument()
    rerender(
      <ul>
        <NotificationRow
          row={makeRow({ removed: true })}
          timeLabel="just now"
        />
      </ul>
    )
    expect(screen.queryByText('View on LinkedIn ↗')).not.toBeInTheDocument()
  })

  it('renders the unread dot only for unread rows', () => {
    const { rerender } = render(
      <ul>
        <NotificationRow
          row={makeRow({ unread: true })}
          timeLabel="just now"
        />
      </ul>
    )
    expect(screen.getByTestId('notification-unread-dot')).toBeInTheDocument()
    rerender(
      <ul>
        <NotificationRow
          row={makeRow({ unread: false })}
          timeLabel="just now"
        />
      </ul>
    )
    expect(screen.queryByTestId('notification-unread-dot')).not.toBeInTheDocument()
  })

  it('renders the actor avatar image with the initials fallback', () => {
    const { container, rerender } = render(
      <ul>
        <NotificationRow
          row={makeRow({ actorPictureUrl: 'https://example.com/a.png' })}
          timeLabel="just now"
        />
      </ul>
    )
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/a.png')
    rerender(
      <ul>
        <NotificationRow
          row={makeRow()}
          timeLabel="just now"
        />
      </ul>
    )
    expect(container.querySelector('img')).not.toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('calls onOpen with the row id when a live row is activated', () => {
    const onOpen = vi.fn()
    render(
      <ul>
        <NotificationRow
          row={makeRow()}
          timeLabel="just now"
          onOpen={onOpen}
        />
      </ul>
    )
    fireEvent.click(screen.getByRole('link', { name: /Ana reacted/ }))
    expect(onOpen).toHaveBeenCalledWith('n1')
  })

  it('renders the record copy with the total and no actor name', () => {
    render(
      <ul>
        <NotificationRow
          row={makeRow({ kind: 'record', total: 5, actorName: 'Ana' })}
          timeLabel="just now"
        />
      </ul>
    )
    expect(screen.getByText('Your post set a new record with 5 interactions.')).toBeInTheDocument()
    expect(screen.queryByText(/Ana reacted/)).not.toBeInTheDocument()
    expect(screen.getByText('just now')).toBeInTheDocument()
  })

  it('falls back to zero interactions on a record row without a total', () => {
    render(
      <ul>
        <NotificationRow
          row={makeRow({ kind: 'record' })}
          timeLabel="just now"
        />
      </ul>
    )
    expect(screen.getByText('Your post set a new record with 0 interactions.')).toBeInTheDocument()
  })
})
