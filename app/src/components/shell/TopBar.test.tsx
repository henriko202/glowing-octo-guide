import { vi } from 'vitest'

// Stable string refs so the useQuery mock can dispatch by WHICH function was asked for.
vi.mock('../../convex', () => ({
  api: {
    users: {
      getMe: 'users.getMe',
      getTrialProgress: 'users.getTrialProgress'
    },
    notifications: {
      getUnreadCount: 'notifications.getUnreadCount',
      listMine: 'notifications.listMine',
      getLatest: 'notifications.getLatest',
      markAllRead: 'notifications.markAllRead'
    },
    rankings: { getWeeklyTop: 'rankings.getWeeklyTop' }
  }
}))

let mockQueryReturns: Record<string, unknown> = {}
vi.mock('convex/react', () => ({
  useQuery: (ref: string) => mockQueryReturns[ref],
  useMutation: () => vi.fn(async () => {}),
  usePaginatedQuery: () => ({ results: [], status: 'Exhausted', loadMore: vi.fn() })
}))

import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { ThemeProvider } from '../ThemeProvider'
import TopBar, { getModifierKey } from './TopBar'

const mockOnOpenSidebar = vi.fn()
const mockOnOpenSearch = vi.fn()

function renderTopBar(
  userOverride: Record<string, unknown> = {},
  progressOverride: Record<string, unknown> | null = null
) {
  mockQueryReturns['users.getMe'] = { _id: 'u1', subscriptionStatus: 'none', ...userOverride }
  mockQueryReturns['users.getTrialProgress'] = progressOverride
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <TopBar
          onOpenSidebar={mockOnOpenSidebar}
          onOpenSearch={mockOnOpenSearch}
        />
      </ThemeProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  mockOnOpenSidebar.mockClear()
  mockOnOpenSearch.mockClear()
  mockQueryReturns = {}
  mockQueryReturns['notifications.getUnreadCount'] = 0
  mockQueryReturns['notifications.getLatest'] = null
})

describe('TopBar', () => {
  it('renders the search button and theme/language controls', () => {
    renderTopBar()
    expect(screen.getByRole('button', { name: /search posts, people/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /language/i })).toBeInTheDocument()
  })
  it('calls onOpenSidebar when the hamburger is clicked', () => {
    renderTopBar()
    fireEvent.click(screen.getByRole('button', { name: /open navigation/i }))
    expect(mockOnOpenSidebar).toHaveBeenCalled()
  })
  it('calls onOpenSearch when the search button is clicked', () => {
    renderTopBar()
    fireEvent.click(screen.getByRole('button', { name: /search posts, people/i }))
    expect(mockOnOpenSearch).toHaveBeenCalled()
  })
})

describe('TopBar trial pill (R06)', () => {
  // The pill now carries an aria-label (F13), which becomes its accessible name — so these query by
  // the plain "link" role (the pill is the only <Link> in TopBar) and check the visible ratio text
  // separately, rather than matching the ratio against the role's `name`.
  it('shows a trial pill linking to billing, hidden on large screens', () => {
    renderTopBar({ subscriptionStatus: 'trialing' }, { combined: 12, threshold: 50 })
    expect(screen.getByText(/12\s*\/\s*50/)).toBeInTheDocument()
    const pill = screen.getByRole('link')
    expect(pill).toHaveAttribute('href', '/billing')
    expect(pill.className).toContain('lg:hidden')
  })

  it('renders no pill when the member is not trialing', () => {
    renderTopBar({ subscriptionStatus: 'active' })
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  // F6: the tooltip used to hardcode "50 interactions" regardless of the actual threshold — an
  // admin override of the trial interaction cap would then show a number that doesn't match reality.
  it('names the real threshold in the tooltip, not a hardcoded 50 (F6)', () => {
    renderTopBar(
      { subscriptionStatus: 'trialing' },
      { combined: 12, threshold: 75, trialEndsAt: new Date('2026-01-01').getTime() }
    )
    const pill = screen.getByRole('link')
    expect(pill).toHaveAttribute('title', expect.stringContaining('75'))
    expect(pill.getAttribute('title')).not.toContain('50 interactions')
  })

  // F13: the pill's only visible text is a bare ratio ("12/50") with no accessible-name context —
  // an aria-label spells out what it means for screen readers, independent of the hover-only title.
  it('carries an aria-label spelling out the ratio for assistive tech (F13)', () => {
    renderTopBar({ subscriptionStatus: 'trialing' }, { combined: 12, threshold: 50 })
    const pill = screen.getByRole('link')
    expect(pill.getAttribute('aria-label')).toMatch(/12/)
    expect(pill.getAttribute('aria-label')).toMatch(/50/)
  })
})

describe('getModifierKey', () => {
  it('returns ⌘ on macOS / iOS platforms', () => {
    expect(getModifierKey('MacIntel')).toBe('⌘')
    expect(getModifierKey('iPhone')).toBe('⌘')
    expect(getModifierKey('iPad')).toBe('⌘')
  })
  it('returns Ctrl on Windows / Linux / anything else', () => {
    expect(getModifierKey('Win32')).toBe('Ctrl')
    expect(getModifierKey('Linux x86_64')).toBe('Ctrl')
    expect(getModifierKey('')).toBe('Ctrl')
  })
})
