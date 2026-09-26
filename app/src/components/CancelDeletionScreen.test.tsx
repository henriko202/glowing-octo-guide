import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CancelDeletionScreen from './CancelDeletionScreen'

const cancelFn = vi.fn(async () => {})
vi.mock('convex/react', () => ({ useMutation: () => cancelFn }))
vi.mock('../convex', () => ({ api: { privacy: { deletion: { cancelAccountDeletion: 'ref' } } } }))

describe('CancelDeletionScreen', () => {
  beforeEach(() => {
    cancelFn.mockClear()
    sessionStorage.setItem('sessionToken', 'tok')
    // jsdom has no navigation; stub reload so the handler's refresh doesn't log "Not implemented".
    Object.defineProperty(window, 'location', { configurable: true, value: { reload: vi.fn() } })
  })

  it('renders the scheduled-deletion heading', () => {
    render(<CancelDeletionScreen deletionScheduledAt={new Date('2026-06-30').getTime()} />)
    expect(screen.getByText(/scheduled for deletion/i)).toBeInTheDocument()
  })

  it('calls cancelAccountDeletion with the session token when Keep is clicked', async () => {
    render(<CancelDeletionScreen deletionScheduledAt={123} />)
    fireEvent.click(screen.getByRole('button', { name: /keep my account/i }))
    await waitFor(() => expect(window.location.reload).toHaveBeenCalledOnce())
    expect(cancelFn).toHaveBeenCalledWith({ sessionToken: 'tok' })
  })
})
