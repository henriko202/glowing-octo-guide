import { render, screen, fireEvent } from '@testing-library/react'
import { vi, beforeEach } from 'vitest'

// Track call order: first useQuery call = checkIsAdmin, subsequent = getSettings (skipped)
let queryCallCount = 0

// NOTE: This mock assumes exactly 2 useQuery calls per render (checkIsAdmin + getSettings).
// When the PlanLimitsTab stub is replaced with the real component in Task 3, update this mock to handle 3 calls.
vi.mock('convex/react', () => ({
  useQuery: vi.fn((query: unknown, args: unknown) => {
    queryCallCount += 1
    if (queryCallCount % 2 === 1) {
      // Odd calls = checkIsAdmin → true
      return true
    }
    // Even calls = getSettings (args === 'skip' because sessionToken is null in jsdom)
    return undefined
  }),
  useMutation: vi.fn(() => vi.fn()),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
}))

import AdminPage from './AdminPage'

beforeEach(() => {
  queryCallCount = 0
})

describe('AdminPage tabs', () => {
  it('renders Settings and Plan Limits tab buttons', () => {
    render(<AdminPage />)
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /plan limits/i })).toBeInTheDocument()
  })

  it('defaults to Settings tab', () => {
    render(<AdminPage />)
    expect(screen.getByText(/apify post sync/i)).toBeInTheDocument()
  })

  it('switches to Plan Limits tab on click', () => {
    render(<AdminPage />)
    fireEvent.click(screen.getByRole('button', { name: /plan limits/i }))
    expect(screen.queryByText(/apify post sync/i)).not.toBeInTheDocument()
  })
})
