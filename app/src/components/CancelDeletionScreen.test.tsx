import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const cancelFn = vi.fn(async () => {})
vi.mock('convex/react', () => ({ useMutation: () => cancelFn }))
vi.mock('../convex', () => ({ api: { privacy: { deletion: { cancelAccountDeletion: 'ref' } } } }))

import CancelDeletionScreen from './CancelDeletionScreen'

describe('CancelDeletionScreen', () => {
  beforeEach(() => {
    cancelFn.mockClear()
    sessionStorage.setItem('sessionToken', 'tok')
  })

  it('renders the scheduled-deletion heading', () => {
    render(<CancelDeletionScreen deletionScheduledAt={new Date('2026-06-30').getTime()} />)
    expect(screen.getByText(/scheduled for deletion/i)).toBeInTheDocument()
  })

  it('calls cancelAccountDeletion with the session token when Keep is clicked', async () => {
    render(<CancelDeletionScreen deletionScheduledAt={123} />)
    fireEvent.click(screen.getByRole('button', { name: /keep my account/i }))
    await waitFor(() => expect(cancelFn).toHaveBeenCalledWith({ sessionToken: 'tok' }))
  })
})
