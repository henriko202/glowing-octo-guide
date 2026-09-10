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

const mockNavigate = vi.fn((_props: unknown) => null)

vi.mock('react-router-dom', () => ({
  Navigate: (props: unknown) => mockNavigate(props),
  useSearchParams: vi.fn(() => [mockSearchParams, mockSetSearchParams])
}))

import AdminPage from './AdminPage'

const SURVIVAL_FIXTURE = {
  days: 7,
  since: 0,
  generatedAt: 0,
  cohort: {
    signups: 1,
    startedTrial: 0,
    activated: 0,
    medianMinutesToFirstInteraction: null,
    returnedDay1: 0,
    returnedDays2to7: 0,
    trialsEnded: 0,
    converted: 0,
    canceled: 0,
    activatedEligible: 1,
    returnedDay1Eligible: 0,
    returnedDays2to7Eligible: 0
  },
  payingByTier: { starter: 0, growth: 0, pro: 0, contact: 0 }
}

// Route each query by its function reference (robust to query count / order):
//   checkIsAdmin → true, getSettings → undefined, all list* queries → []
beforeEach(() => {
  mockSearchParams.delete('tab')
  mockSetSearchParams.mockClear()
  mockNavigate.mockClear()
  vi.mocked(useQuery).mockImplementation((ref: unknown, ..._rest: unknown[]) => {
    const name = getFunctionName(ref as Parameters<typeof getFunctionName>[0])
    if (name === 'admin:checkIsAdmin') return true as never
    if (name === 'admin:getSettings') return undefined as never
    if (name === 'admin:survivalMetrics') return SURVIVAL_FIXTURE as never
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

  it('renders the Survival tab and reads ?tab=survival', () => {
    mockSearchParams.set('tab', 'survival')
    render(<AdminPage />)
    expect(screen.getByRole('tab', { name: /survival/i })).toBeInTheDocument()
    expect(screen.getByText(/paying by tier/i)).toBeInTheDocument()
    expect(screen.queryByText(/apify post sync/i)).not.toBeInTheDocument()
  })
})

describe('AdminPage admin guard', () => {
  // Non-admins must be redirected declaratively (<Navigate>), not via a navigate() side effect
  // during render, and the admin JSX must never render for them — not even for one paint.
  it('redirects to / and renders no admin content when the user is not an admin', () => {
    vi.mocked(useQuery).mockImplementation((ref: unknown, ..._rest: unknown[]) => {
      const name = getFunctionName(ref as Parameters<typeof getFunctionName>[0])
      if (name === 'admin:checkIsAdmin') return false as never
      if (name === 'admin:getSettings') return undefined as never
      return [] as never
    })
    render(<AdminPage />)
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/', replace: true })
    expect(screen.queryByText(/apify post sync/i)).not.toBeInTheDocument()
  })
})
