import { render, screen } from '@testing-library/react'
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
