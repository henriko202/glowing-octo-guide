import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { getFunctionName } from 'convex/server'
import { useQuery, useMutation } from 'convex/react'
import type { Id } from '../../../convex/_generated/dataModel'

// listPlanLimits result: contact default row + one per-user override (for u1)
const mockRows = [
  { _id: 'r4', tier: 'contact', interactionsPerPost: 200, postsPerWeek: 5 },
  { _id: 'r5', tier: 'contact', userId: 'u1', interactionsPerPost: 500, postsPerWeek: 10 }
]

const mocks = {
  setContactUserLimit: vi.fn(),
  removeContactUserLimit: vi.fn()
}

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn()
}))

import ContactLimitsModal from './ContactLimitsModal'

const user = (id: string, name: string) => ({ _id: id as Id<'users'>, name })

beforeEach(() => {
  Object.values(mocks).forEach(m => {
    m.mockReset()
    m.mockResolvedValue(undefined)
  })
  vi.mocked(useQuery).mockReturnValue(mockRows)
  vi.mocked(useMutation).mockImplementation((ref: unknown) => {
    const name =
      getFunctionName(ref as Parameters<typeof getFunctionName>[0])
        .split(':')
        .pop() ?? ''
    return (mocks[name as keyof typeof mocks] ?? vi.fn()) as never
  })
})

describe('ContactLimitsModal', () => {
  it('prefills the existing override and titles "Edit … limits"', () => {
    render(
      <ContactLimitsModal
        user={user('u1', 'Bob Smith')}
        sessionToken="tok"
        onClose={() => {}}
      />
    )
    expect(screen.getByText(/edit bob smith limits/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('500')).toBeInTheDocument()
    expect(screen.getByDisplayValue('10')).toBeInTheDocument()
  })

  it('prefills the contact default and titles "Add override" when no override exists', () => {
    render(
      <ContactLimitsModal
        user={user('u2', 'Alice Johnson')}
        sessionToken="tok"
        onClose={() => {}}
      />
    )
    expect(screen.getByText(/add override for alice johnson/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('200')).toBeInTheDocument()
    expect(screen.getByDisplayValue('5')).toBeInTheDocument()
  })

  it('disables Save when interactions is 0', () => {
    render(
      <ContactLimitsModal
        user={user('u1', 'Bob Smith')}
        sessionToken="tok"
        onClose={() => {}}
      />
    )
    fireEvent.change(screen.getByDisplayValue('500'), { target: { value: '0' } })
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })

  it('calls setContactUserLimit and closes on Save', async () => {
    const onClose = vi.fn()
    render(
      <ContactLimitsModal
        user={user('u1', 'Bob Smith')}
        sessionToken="tok"
        onClose={onClose}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => {
      expect(mocks.setContactUserLimit).toHaveBeenCalledWith({
        sessionToken: 'tok',
        userId: 'u1',
        interactionsPerPost: 500,
        postsPerWeek: 10
      })
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('calls removeContactUserLimit on "Reset to default" for an existing override', async () => {
    const onClose = vi.fn()
    render(
      <ContactLimitsModal
        user={user('u1', 'Bob Smith')}
        sessionToken="tok"
        onClose={onClose}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /reset to default/i }))
    await waitFor(() => {
      expect(mocks.removeContactUserLimit).toHaveBeenCalledWith({ sessionToken: 'tok', userId: 'u1' })
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('hides "Reset to default" for a brand-new override', () => {
    render(
      <ContactLimitsModal
        user={user('u2', 'Alice Johnson')}
        sessionToken="tok"
        onClose={() => {}}
      />
    )
    expect(screen.queryByRole('button', { name: /reset to default/i })).not.toBeInTheDocument()
  })
})
