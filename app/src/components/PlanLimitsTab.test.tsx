import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { getFunctionName } from 'convex/server'
import { useQuery } from 'convex/react'

// 4 tier default rows (no userId)
const mockRows = [
  { _id: 'r1', tier: 'starter', interactionsPerPost: 25, postsPerWeek: 1 },
  { _id: 'r2', tier: 'growth', interactionsPerPost: 50, postsPerWeek: 2 },
  { _id: 'r3', tier: 'pro', interactionsPerPost: 200, postsPerWeek: 5 },
  { _id: 'r4', tier: 'contact', interactionsPerPost: 200, postsPerWeek: 5 }
]

// Contact users with effective limits — Bob has an override, Alice falls back to the default
const mockContactUsers = [
  { _id: 'u1', name: 'Bob Smith', interactionsPerPost: 500, postsPerWeek: 10, hasOverride: true },
  { _id: 'u2', name: 'Alice Johnson', interactionsPerPost: 200, postsPerWeek: 5, hasOverride: false }
]

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn())
}))

import PlanLimitsTab from './PlanLimitsTab'

function routeQueries() {
  vi.mocked(useQuery).mockImplementation((ref: unknown, ..._rest: unknown[]) => {
    const name = getFunctionName(ref as Parameters<typeof getFunctionName>[0])
    if (name === 'admin:listContactUsersWithLimits') return mockContactUsers as never
    return mockRows as never
  })
}

beforeEach(() => {
  routeQueries()
})

describe('PlanLimitsTab — read-only', () => {
  it('renders all four tier default rows', () => {
    render(
      <PlanLimitsTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    expect(screen.getByText('starter')).toBeInTheDocument()
    expect(screen.getByText('growth')).toBeInTheDocument()
    expect(screen.getByText('pro')).toBeInTheDocument()
    expect(screen.getAllByText('contact').length).toBeGreaterThan(0)
    expect(screen.getByTestId('row-r1-interactions')).toHaveTextContent('25')
    expect(screen.getByTestId('row-r1-posts')).toHaveTextContent('1')
  })

  it('lists contact users with their effective limits', () => {
    render(
      <PlanLimitsTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    expect(screen.getByText('Bob Smith')).toBeInTheDocument()
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
    expect(screen.getByTestId('contact-u1-interactions')).toHaveTextContent('500')
    expect(screen.getByTestId('contact-u2-interactions')).toHaveTextContent('200')
  })

  it('shows an "override" tag only for users with a custom override', () => {
    render(
      <PlanLimitsTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    expect(screen.getAllByText('override')).toHaveLength(1)
  })

  it('has no edit / reset / search controls', () => {
    render(
      <PlanLimitsTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    expect(screen.queryByPlaceholderText(/search contact users/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^reset$/i })).not.toBeInTheDocument()
  })

  it('shows an empty state when there are no contact users', () => {
    vi.mocked(useQuery).mockImplementation((ref: unknown, ..._rest: unknown[]) => {
      const name = getFunctionName(ref as Parameters<typeof getFunctionName>[0])
      if (name === 'admin:listContactUsersWithLimits') return [] as never
      return mockRows as never
    })
    render(
      <PlanLimitsTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    expect(screen.getByText(/no contact-tier users/i)).toBeInTheDocument()
  })

  it('shows a loading spinner while queries are undefined', () => {
    vi.mocked(useQuery).mockReturnValue(undefined)
    render(
      <PlanLimitsTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })
})
