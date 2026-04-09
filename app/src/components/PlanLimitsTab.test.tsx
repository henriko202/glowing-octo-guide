import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { useQuery, useMutation } from 'convex/react'

// Default mock data: 4 tier defaults + 1 contact override
const mockRows = [
  { _id: 'r1', tier: 'starter', interactionsPerPost: 25, postsPerWeek: 1 },
  { _id: 'r2', tier: 'growth', interactionsPerPost: 50, postsPerWeek: 2 },
  { _id: 'r3', tier: 'pro', interactionsPerPost: 200, postsPerWeek: 5 },
  { _id: 'r4', tier: 'contact', interactionsPerPost: 200, postsPerWeek: 5 },
  { _id: 'r5', tier: 'contact', userId: 'u1', userName: 'Bob Smith', interactionsPerPost: 500, postsPerWeek: 10 },
]

// useMutation is called TWICE in PlanLimitsTab (setContactUserLimit, removeContactUserLimit)
vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => mockRows),
  useMutation: vi.fn(() => Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() })),
}))

import PlanLimitsTab from './PlanLimitsTab'

describe('PlanLimitsTab — table', () => {
  it('renders all four tier badge pills', () => {
    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    expect(screen.getByText('starter')).toBeInTheDocument()
    expect(screen.getByText('growth')).toBeInTheDocument()
    expect(screen.getByText('pro')).toBeInTheDocument()
    expect(screen.getAllByText('contact').length).toBeGreaterThan(0)
  })

  it('renders limit values for tier default rows', () => {
    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    expect(screen.getByTestId('row-r1-interactions')).toHaveTextContent('25')
    expect(screen.getByTestId('row-r1-posts')).toHaveTextContent('1')
  })

  it('renders contact override row with user name', () => {
    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    expect(screen.getByText('Bob Smith')).toBeInTheDocument()
    expect(screen.getByTestId('row-r5-interactions')).toHaveTextContent('500')
  })

  it('shows no Edit button on tier default rows — only one Edit button total (contact override)', () => {
    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    expect(screen.getAllByRole('button', { name: /^edit$/i })).toHaveLength(1)
  })

  it('shows a Reset button only on the contact override row', () => {
    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    expect(screen.getAllByRole('button', { name: /^reset$/i })).toHaveLength(1)
  })

  it('shows loading spinner when query returns undefined', () => {
    vi.mocked(useQuery).mockReturnValueOnce(undefined)
    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('renders the search input for adding contact overrides', () => {
    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    expect(screen.getByPlaceholderText(/search contact users/i)).toBeInTheDocument()
  })

  it('shows search results when searchResults are returned by the query', () => {
    const mockSearchResults = [{ _id: 'u2', name: 'Alice Johnson' }]
    // Use mockImplementation to differentiate between listPlanLimits and searchContactUsers calls.
    // The component calls useQuery twice per render: first for listPlanLimits, second for searchContactUsers.
    // We track call order within each render cycle by resetting a counter on each test action.
    let callCount = 0
    vi.mocked(useQuery).mockImplementation(() => {
      callCount++
      // odd calls = listPlanLimits, even calls = searchContactUsers
      return callCount % 2 === 1 ? mockRows : mockSearchResults
    })

    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    callCount = 0 // reset before the re-render triggered by change
    fireEvent.change(screen.getByPlaceholderText(/search contact users/i), {
      target: { value: 'alice' },
    })
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
  })

  it('opens modal titled "Add override for [name]" when a search result is clicked', () => {
    const mockSearchResults = [{ _id: 'u2', name: 'Alice Johnson' }]
    let callCount = 0
    vi.mocked(useQuery).mockImplementation(() => {
      callCount++
      return callCount % 2 === 1 ? mockRows : mockSearchResults
    })

    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    callCount = 0
    fireEvent.change(screen.getByPlaceholderText(/search contact users/i), {
      target: { value: 'alice' },
    })
    fireEvent.click(screen.getByText('Alice Johnson'))
    expect(screen.getByText(/add override for alice johnson/i)).toBeInTheDocument()
  })
})

describe('PlanLimitsTab — edit modal (contact override)', () => {
  beforeEach(() => {
    vi.mocked(useMutation).mockReset()
    vi.mocked(useMutation).mockImplementation(
      () => Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() })
    )
    vi.mocked(useQuery).mockReturnValue(mockRows)
  })

  it('opens modal with pre-filled values when Edit is clicked on the contact override row', () => {
    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    expect(screen.getByText(/edit bob smith limits/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('500')).toBeInTheDocument()
    expect(screen.getByDisplayValue('10')).toBeInTheDocument()
  })

  it('disables Save when interactions is set to 0', () => {
    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    fireEvent.change(screen.getByDisplayValue('500'), { target: { value: '0' } })
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })

  it('calls setContactUserLimit with correct args when Save is clicked on override row', async () => {
    const mockMutate = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockImplementation(
      () => Object.assign(mockMutate, { withOptimisticUpdate: vi.fn() })
    )

    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
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
    expect(screen.queryByText(/edit bob smith limits/i)).not.toBeInTheDocument()
  })

  it('calls removeContactUserLimit when Reset to default is clicked in modal', async () => {
    const mockMutate = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockImplementation(
      () => Object.assign(mockMutate, { withOptimisticUpdate: vi.fn() })
    )

    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    fireEvent.click(screen.getByRole('button', { name: /reset to default/i }))

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ sessionToken: 'tok', userId: 'u1' })
      )
    })
    expect(screen.queryByText(/edit bob smith limits/i)).not.toBeInTheDocument()
  })

  it('calls setContactUserLimit when Save clicked on new-override modal (from search)', async () => {
    const mockMutate = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockImplementation(
      () => Object.assign(mockMutate, { withOptimisticUpdate: vi.fn() })
    )

    const mockSearchResults = [{ _id: 'u2', name: 'Alice Johnson' }]
    let callCount = 0
    vi.mocked(useQuery).mockImplementation(() => {
      callCount++
      return callCount % 2 === 1 ? mockRows : mockSearchResults
    })

    render(<PlanLimitsTab sessionToken="tok" isAdmin={true} />)
    callCount = 0
    fireEvent.change(screen.getByPlaceholderText(/search contact users/i), {
      target: { value: 'alice' },
    })
    fireEvent.click(screen.getByText('Alice Johnson'))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionToken: 'tok',
          userId: 'u2',
        })
      )
    })
  })
})
