import { render, screen, fireEvent } from '@testing-library/react'
import { vi, beforeEach } from 'vitest'

// Track call order: 3 useQuery calls per render cycle:
//   1 = checkIsAdmin, 2 = getSettings (skipped), 3 = listPlanLimits
let queryCallCount = 0

vi.mock('convex/react', () => ({
  useQuery: vi.fn((_query: unknown, _args: unknown) => {
    queryCallCount += 1
    const mod = queryCallCount % 3
    if (mod === 1) {
      // checkIsAdmin → true
      return true
    }
    if (mod === 2) {
      // getSettings (args === 'skip' because sessionToken is null in jsdom)
      return undefined
    }
    // mod === 0: listPlanLimits → empty array
    return []
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
