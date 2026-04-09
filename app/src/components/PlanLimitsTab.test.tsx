import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

// Default mock: 4 tier defaults, 1 contact override
const mockRows = [
  { _id: 'r1', tier: 'starter', interactionsPerPost: 25, postsPerWeek: 1 },
  { _id: 'r2', tier: 'growth', interactionsPerPost: 50, postsPerWeek: 2 },
  { _id: 'r3', tier: 'pro', interactionsPerPost: 200, postsPerWeek: 5 },
  { _id: 'r4', tier: 'contact', interactionsPerPost: 200, postsPerWeek: 5 },
  { _id: 'r5', tier: 'contact', userId: 'u1', userName: 'Bob Smith', interactionsPerPost: 500, postsPerWeek: 10 },
]

vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => mockRows),
  useMutation: vi.fn(() => vi.fn()),
}))

import PlanLimitsTab from './PlanLimitsTab'

describe('PlanLimitsTab — table', () => {
  it('renders all four tier badge pills', () => {
    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    expect(screen.getByText('starter')).toBeInTheDocument()
    expect(screen.getByText('growth')).toBeInTheDocument()
    expect(screen.getByText('pro')).toBeInTheDocument()
    // 'contact' appears as both a tier badge and a row label — at least one must exist
    expect(screen.getAllByText('contact').length).toBeGreaterThan(0)
  })

  it('renders limit values for tier default rows', () => {
    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    // starter: 25 interactions, 1 post
    expect(screen.getByTestId('row-r1-interactions')).toHaveTextContent('25')
    expect(screen.getByTestId('row-r1-posts')).toHaveTextContent('1')
  })

  it('renders contact override row with user name', () => {
    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    expect(screen.getByText('Bob Smith')).toBeInTheDocument()
    expect(screen.getByTestId('row-r5-interactions')).toHaveTextContent('500')
  })

  it('shows a Reset button only on contact override rows', () => {
    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    // Only 1 contact override row (r5) should have a Reset button
    expect(screen.getAllByRole('button', { name: /reset/i })).toHaveLength(1)
  })

  it('shows loading spinner when query returns undefined', async () => {
    const { useQuery } = await import('convex/react')
    vi.mocked(useQuery).mockReturnValueOnce(undefined)
    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })
})

describe('PlanLimitsTab — edit modal', () => {
  beforeEach(async () => {
    const { useMutation } = await import('convex/react')
    vi.mocked(useMutation).mockReset()
    vi.mocked(useMutation).mockImplementation(() => vi.fn())
  })

  it('opens modal with pre-filled values when Edit is clicked on a tier row', () => {
    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    // Click Edit on the starter row
    const editBtns = screen.getAllByRole('button', { name: /^edit$/i })
    fireEvent.click(editBtns[0]) // first Edit = starter row
    expect(screen.getByText(/edit starter defaults/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('25')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1')).toBeInTheDocument()
  })

  it('disables Save when an input is set to 0', () => {
    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    fireEvent.click(screen.getAllByRole('button', { name: /^edit$/i })[0])
    const interactionsInput = screen.getByDisplayValue('25')
    fireEvent.change(interactionsInput, { target: { value: '0' } })
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })

  it('calls updateTierDefault with correct args when Save is clicked on tier row', async () => {
    const { useMutation } = await import('convex/react')
    const mockMutate = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockImplementation(() => mockMutate)

    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    fireEvent.click(screen.getAllByRole('button', { name: /^edit$/i })[0]) // starter
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionToken: 'tok',
          tier: 'starter',
          interactionsPerPost: 25,
          postsPerWeek: 1,
        })
      )
    })
    expect(screen.queryByRole('heading', { name: /edit .* defaults|edit .* limits/i })).not.toBeInTheDocument()
  })

  it('calls setContactUserLimit when Save is clicked on a contact override row', async () => {
    const { useMutation } = await import('convex/react')
    const mockMutate = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockImplementation(() => mockMutate)

    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    // Open any modal first to confirm cancel works, then open the contact override (Bob Smith)
    fireEvent.click(screen.getAllByRole('button', { name: /^edit$/i })[0])
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    const allEdits = screen.getAllByRole('button', { name: /^edit$/i })
    fireEvent.click(allEdits[allEdits.length - 1]) // last Edit = contact override

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionToken: 'tok',
          userId: 'u1',
          interactionsPerPost: 500,
          postsPerWeek: 10,
        })
      )
    })
    expect(screen.queryByRole('heading', { name: /edit .* defaults|edit .* limits/i })).not.toBeInTheDocument()
  })

  it('calls removeContactUserLimit when Reset to default is clicked in modal', async () => {
    const { useMutation } = await import('convex/react')
    const mockMutate = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockImplementation(() => mockMutate)

    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    const allEdits = screen.getAllByRole('button', { name: /^edit$/i })
    fireEvent.click(allEdits[allEdits.length - 1]) // contact override
    fireEvent.click(screen.getByRole('button', { name: /reset to default/i }))

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ sessionToken: 'tok', userId: 'u1' })
      )
    })
    expect(screen.queryByRole('heading', { name: /edit .* defaults|edit .* limits/i })).not.toBeInTheDocument()
  })
})
