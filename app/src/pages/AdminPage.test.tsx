import { render, screen, fireEvent } from '@testing-library/react'
import { vi, beforeEach } from 'vitest'
import { getFunctionName } from 'convex/server'
import { useQuery } from 'convex/react'

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn())
}))

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn())
}))

import AdminPage from './AdminPage'

// Route each query by its function reference (robust to query count / order):
//   checkIsAdmin → true, getSettings → undefined, all list* queries → []
beforeEach(() => {
  vi.mocked(useQuery).mockImplementation((ref: unknown, ..._rest: unknown[]) => {
    const name = getFunctionName(ref as Parameters<typeof getFunctionName>[0])
    if (name === 'admin:checkIsAdmin') return true as never
    if (name === 'admin:getSettings') return undefined as never
    return [] as never
  })
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

  it('renders the master and profile-scrape Apify toggles', () => {
    render(<AdminPage />)
    expect(screen.getByText(/apify \(master\)/i)).toBeInTheDocument()
    expect(screen.getByText(/apify profile scrape/i)).toBeInTheDocument()
  })
})
