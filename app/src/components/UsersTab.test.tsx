import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { useQuery, useMutation } from 'convex/react'

const mockUsers = [
  {
    _id: 'u1',
    name: 'Jordan Maxwell',
    headline: 'Growth marketer',
    tier: 'growth',
    subscriptionStatus: 'active',
    isBanned: false,
    createdAt: 0
  },
  {
    _id: 'u2',
    name: 'Priya Nayar',
    headline: 'Founder',
    tier: 'starter',
    subscriptionStatus: 'trialing',
    isBanned: true,
    createdAt: 0
  }
]

let mockBan: ReturnType<typeof vi.fn>
let mockUnban: ReturnType<typeof vi.fn>
let mockSetTier: ReturnType<typeof vi.fn>

vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => mockUsers),
  useMutation: vi.fn()
}))

import UsersTab from './UsersTab'

beforeEach(() => {
  mockBan = vi.fn().mockResolvedValue(undefined)
  mockUnban = vi.fn().mockResolvedValue(undefined)
  mockSetTier = vi.fn().mockResolvedValue(undefined)
  // UsersTab calls useMutation 3x per render in a fixed order: setUserTier, banUser, unbanUser.
  // Map by position-within-render (modulo 3) so the mapping stays correct across re-renders.
  let n = 0
  vi.mocked(useMutation).mockImplementation(() => {
    const slot = n % 3
    n++
    return (slot === 0 ? mockSetTier : slot === 1 ? mockBan : mockUnban) as never
  })
  vi.mocked(useQuery).mockReturnValue(mockUsers)
})

describe('UsersTab — ban/unban', () => {
  it('shows a Banned badge for banned users only', () => {
    render(
      <UsersTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    expect(screen.getByText('Banned')).toBeInTheDocument()
  })

  it('offers "Ban user…" for an active user and calls banUser with the reason', async () => {
    render(
      <UsersTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /actions for jordan maxwell/i }))
    fireEvent.click(screen.getByText('Ban user…'))
    fireEvent.change(screen.getByPlaceholderText(/spam/i), { target: { value: 'Spam' } })
    fireEvent.click(screen.getByRole('button', { name: /^ban user$/i }))
    await waitFor(() => {
      expect(mockBan).toHaveBeenCalledWith({ sessionToken: 'tok', userId: 'u1', reason: 'Spam' })
    })
  })

  it('offers "Unban" for a banned user and calls unbanUser after confirm', async () => {
    render(
      <UsersTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /actions for priya nayar/i }))
    fireEvent.click(screen.getByText('Unban'))
    fireEvent.click(screen.getByRole('button', { name: /^unban$/i }))
    await waitFor(() => {
      expect(mockUnban).toHaveBeenCalledWith({ sessionToken: 'tok', userId: 'u2' })
    })
  })
})
