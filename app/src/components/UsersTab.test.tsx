import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { vi } from 'vitest'
import { getFunctionName } from 'convex/server'
import { useMutation, useQuery } from 'convex/react'
import UsersTab from './UsersTab'

const mockUsers = [
  {
    _id: 'u1',
    name: 'Jordan Maxwell',
    headline: 'Growth marketer',
    tier: 'growth',
    subscriptionStatus: 'active',
    isBanned: false,
    createdAt: 0,
    linkedinPublicIdentifier: 'jordan-maxwell'
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
    // No linkedinPublicIdentifier → per-row sync actions are disabled for this user.
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
  removeContactUserLimit: vi.fn(),
  syncUserPosts: vi.fn(),
  syncUserProfile: vi.fn()
}

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn()
}))

// Default both Apify feature flags on; individual tests override to exercise gating.
function renderTab(overrides: { postSyncOn?: boolean; profileScrapeOn?: boolean } = {}) {
  return render(
    <UsersTab
      sessionToken="tok"
      isAdmin={true}
      postSyncOn={overrides.postSyncOn ?? true}
      profileScrapeOn={overrides.profileScrapeOn ?? true}
    />
  )
}

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
    renderTab()
    expect(screen.getByText('Banned')).toBeInTheDocument()
  })

  it('offers "Ban user…" for an active user and calls banUser with the reason', async () => {
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: /actions for jordan maxwell/i }))
    fireEvent.click(screen.getByText('Ban user…'))
    fireEvent.change(screen.getByPlaceholderText(/spam/i), { target: { value: 'Spam' } })
    fireEvent.click(screen.getByRole('button', { name: /^ban user$/i }))
    await waitFor(() => {
      expect(mocks.banUser).toHaveBeenCalledWith({ sessionToken: 'tok', userId: 'u1', reason: 'Spam' })
    })
  })

  it('offers "Unban" for a banned user and calls unbanUser after confirm', async () => {
    renderTab()
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
    renderTab()
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
    renderTab()
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
    renderTab()
    // Contact-tier user → action present
    fireEvent.click(screen.getByRole('button', { name: /actions for dana lee/i }))
    expect(screen.getByText('Edit limits…')).toBeInTheDocument()
  })

  it('does not offer "Edit limits…" for non-contact users', () => {
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: /actions for jordan maxwell/i }))
    expect(screen.queryByText('Edit limits…')).not.toBeInTheDocument()
  })
})

describe('UsersTab — manual sync actions', () => {
  it('offers "Sync posts" and "Sync profile" in the row menu', () => {
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: /actions for jordan maxwell/i }))
    expect(screen.getByRole('button', { name: 'Sync posts' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sync profile' })).toBeInTheDocument()
  })

  it('disables the sync actions when the user has no LinkedIn URL on file', () => {
    renderTab() // Dana Lee (u3) has no linkedinPublicIdentifier
    fireEvent.click(screen.getByRole('button', { name: /actions for dana lee/i }))
    expect(screen.getByRole('button', { name: 'Sync posts' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Sync profile' })).toBeDisabled()
  })

  it('disables the matching action when its Apify feature is off', () => {
    renderTab({ postSyncOn: false, profileScrapeOn: true }) // Jordan has a LinkedIn URL
    fireEvent.click(screen.getByRole('button', { name: /actions for jordan maxwell/i }))
    expect(screen.getByRole('button', { name: 'Sync posts' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Sync profile' })).toBeEnabled()
  })

  it('calls syncUserPosts when enabled and the user has a LinkedIn URL', async () => {
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: /actions for jordan maxwell/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Sync posts' }))
    await waitFor(() => {
      expect(mocks.syncUserPosts).toHaveBeenCalledWith({ sessionToken: 'tok', userId: 'u1' })
    })
  })

  it('calls syncUserProfile when enabled and the user has a LinkedIn URL', async () => {
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: /actions for jordan maxwell/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Sync profile' }))
    await waitFor(() => {
      expect(mocks.syncUserProfile).toHaveBeenCalledWith({ sessionToken: 'tok', userId: 'u1' })
    })
  })
})
