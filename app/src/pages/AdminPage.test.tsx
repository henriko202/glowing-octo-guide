import { render, screen, fireEvent } from '@testing-library/react'
import { vi, beforeEach } from 'vitest'
import { getFunctionName } from 'convex/server'
import { useQuery } from 'convex/react'

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn())
}))

// Mock useSearchParams with a simple in-memory implementation.
// Tab state is now URL-driven (§8D structural change): clicking a tab calls
// setSearchParams({ tab: value }), which is the observable behavior we test.
const mockSetSearchParams = vi.fn()
const mockSearchParams = new URLSearchParams()

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
  useSearchParams: vi.fn(() => [mockSearchParams, mockSetSearchParams])
}))

import AdminPage from './AdminPage'

// Route each query by its function reference (robust to query count / order):
//   checkIsAdmin → true, getSettings → undefined, all list* queries → []
beforeEach(() => {
  mockSearchParams.delete('tab')
  mockSetSearchParams.mockClear()
  vi.mocked(useQuery).mockImplementation((ref: unknown, ..._rest: unknown[]) => {
    const name = getFunctionName(ref as Parameters<typeof getFunctionName>[0])
    if (name === 'admin:checkIsAdmin') return true as never
    if (name === 'admin:getSettings') return undefined as never
    return [] as never
  })
})

describe('AdminPage tabs', () => {
  // Tab bar now uses the Tabs primitive: triggers have role="tab" (§8D structural change).
  it('renders Settings and Plan Limits tab buttons', () => {
    render(<AdminPage />)
    expect(screen.getByRole('tab', { name: /settings/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /plan limits/i })).toBeInTheDocument()
  })

  it('defaults to Settings tab', () => {
    render(<AdminPage />)
    expect(screen.getByText(/apify post sync/i)).toBeInTheDocument()
  })

  // With URL-driven tab state (§8D), clicking a tab calls setSearchParams({ tab: value }, { replace: true })
  // rather than directly hiding DOM content. We verify the URL setter is invoked with the correct value.
  // Radix Tabs triggers onValueChange on mousedown (not click), so we fire mousedown.
  it('switches to Plan Limits tab on click', () => {
    render(<AdminPage />)
    fireEvent.mouseDown(screen.getByRole('tab', { name: /plan limits/i }))
    expect(mockSetSearchParams).toHaveBeenCalledWith({ tab: 'planLimits' }, { replace: true })
  })

  it('renders the master and profile-scrape Apify toggles', () => {
    render(<AdminPage />)
    expect(screen.getByText(/apify \(master\)/i)).toBeInTheDocument()
    expect(screen.getByText(/apify profile scrape/i)).toBeInTheDocument()
  })
})
