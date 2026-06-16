import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { vi } from 'vitest'
import { getFunctionName } from 'convex/server'
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
  },
  {
    _id: 'u3',
    name: 'Dana Lee',
    headline: 'Enterprise',
    tier: 'contact',
    subscriptionStatus: 'active',
    isBanned: false,
    createdAt: 0
  }
]

// One mock fn per admin mutation, routed by the function reference passed to useMutation.
// This replaces the old call-order-position mapping, which breaks whenever mutations are added.
const mocks = {
  setUserTier: vi.fn(),
  setUserSubscriptionStatus: vi.fn(),
  banUser: vi.fn(),
  unbanUser: vi.fn(),
  setContactUserLimit: vi.fn(),
  removeContactUserLimit: vi.fn()
}

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn()
}))

import UsersTab from './UsersTab'

beforeEach(() => {
  Object.values(mocks).forEach(m => {
    m.mockReset()
    m.mockResolvedValue(undefined)
  })
  vi.mocked(useQuery).mockReturnValue(mockUsers)
  vi.mocked(useMutation).mockImplementation((ref: unknown) => {
    const name =
      getFunctionName(ref as Parameters<typeof getFunctionName>[0])
        .split(':')
        .pop() ?? ''
    return (mocks[name as keyof typeof mocks] ?? vi.fn()) as never
  })
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
      expect(mocks.banUser).toHaveBeenCalledWith({ sessionToken: 'tok', userId: 'u1', reason: 'Spam' })
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
      expect(mocks.unbanUser).toHaveBeenCalledWith({ sessionToken: 'tok', userId: 'u2' })
    })
  })
})

describe('UsersTab — change tier', () => {
  it('opens the tier modal and calls setUserTier with the chosen tier', async () => {
    render(
      <UsersTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /actions for jordan maxwell/i }))
    fireEvent.click(screen.getByText('Change tier…'))

    const modal = screen.getByTestId('modal-backdrop')
    fireEvent.click(within(modal).getByRole('button', { name: /^pro$/i }))
    fireEvent.click(within(modal).getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(mocks.setUserTier).toHaveBeenCalledWith({ sessionToken: 'tok', userId: 'u1', tier: 'pro' })
    })
  })
})

describe('UsersTab — change status', () => {
  it('opens the status modal and calls setUserSubscriptionStatus with the chosen status', async () => {
    render(
      <UsersTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /actions for jordan maxwell/i }))
    fireEvent.click(screen.getByText('Change status…'))

    const modal = screen.getByTestId('modal-backdrop')
    fireEvent.change(within(modal).getByRole('combobox'), { target: { value: 'none' } })
    fireEvent.click(within(modal).getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(mocks.setUserSubscriptionStatus).toHaveBeenCalledWith({
        sessionToken: 'tok',
        userId: 'u1',
        status: 'none'
      })
    })
  })
})

describe('UsersTab — edit contact limits action', () => {
  it('offers "Edit limits…" only for contact-tier users', () => {
    render(
      <UsersTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    // Contact-tier user → action present
    fireEvent.click(screen.getByRole('button', { name: /actions for dana lee/i }))
    expect(screen.getByText('Edit limits…')).toBeInTheDocument()
  })

  it('does not offer "Edit limits…" for non-contact users', () => {
    render(
      <UsersTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /actions for jordan maxwell/i }))
    expect(screen.queryByText('Edit limits…')).not.toBeInTheDocument()
  })
})
