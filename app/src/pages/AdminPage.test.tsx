import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, vi } from 'vitest'
import { getFunctionName } from 'convex/server'
import { useMutation, useQuery } from 'convex/react'
import AdminPage from './AdminPage'

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn()
}))

// Mock useSearchParams with a stateful in-memory implementation.
// Tab state is URL-driven (§8D): clicking a tab calls setSearchParams({ tab: value }) and the
// hook's state update re-renders the page, so tests can click a tab and then assert its content.
const mockSetSearchParams = vi.fn()
const mockSearchParams = new URLSearchParams()

const mockNavigate = vi.fn((_props: unknown) => null)

vi.mock('react-router-dom', async () => {
  const { useState } = await import('react')
  return {
    Navigate: (props: unknown) => mockNavigate(props),
    useSearchParams: () => {
      const [params, setParams] = useState(() => mockSearchParams)
      return [
        params,
        (next: Record<string, string>, options?: { replace?: boolean }) => {
          mockSetSearchParams(next, options)
          setParams(new URLSearchParams(next))
        }
      ]
    }
  }
})

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

const mockRebuildRankings = vi.fn()

const DAY = 86_400_000

// One row per reason group: a received_no_reply member with both facts set, and a cooling member
// with neither (whose row must omit the fact line entirely — never print "none yet").
const CHURN_FIXTURE = [
  {
    userId: 'u1',
    name: 'Nadia',
    headline: 'Founder',
    profilePictureUrl: undefined,
    made7d: 0,
    made30d: 0,
    received7d: 3,
    lastInteractionAt: Date.now() - 3 * DAY,
    lastPostAt: Date.now() - 2 * DAY,
    reasons: ['received_no_reply'],
    hook: '3 reactions on your post, no reply'
  },
  {
    userId: 'u2',
    name: 'Omar',
    headline: undefined,
    profilePictureUrl: undefined,
    made7d: 0,
    made30d: 4,
    received7d: 0,
    lastInteractionAt: null,
    lastPostAt: null,
    reasons: ['cooling'],
    hook: '0 interactions this week, down from 4 in 30 days'
  }
]

// Route each query by its function reference (robust to query count / order):
//   checkIsAdmin → true, getSettings → undefined, all list* queries → []
beforeEach(() => {
  sessionStorage.clear()
  mockSearchParams.delete('tab')
  mockSetSearchParams.mockClear()
  mockNavigate.mockClear()
  mockRebuildRankings.mockClear()
  vi.mocked(useQuery).mockImplementation((ref: unknown, ..._rest: unknown[]) => {
    const name = getFunctionName(ref as Parameters<typeof getFunctionName>[0])
    if (name === 'admin:checkIsAdmin') return true as never
    if (name === 'admin:getSettings') return undefined as never
    if (name === 'admin:survivalMetrics') return SURVIVAL_FIXTURE as never
    if (name === 'admin:getChurnRisk') return [] as never
    return [] as never
  })
  vi.mocked(useMutation).mockImplementation((ref: unknown) => {
    const name = getFunctionName(ref as Parameters<typeof getFunctionName>[0])
    if (name === 'admin:rebuildRankingSnapshotsNow') return mockRebuildRankings as never
    return vi.fn() as never
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

  it('starts a ranking-snapshot rebuild', async () => {
    sessionStorage.setItem('sessionToken', 'tok')
    render(<AdminPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Rebuild rankings' }))
    await waitFor(() => expect(mockRebuildRankings).toHaveBeenCalledWith({ sessionToken: 'tok' }))
  })

  it('renders the Survival tab and reads ?tab=survival', () => {
    mockSearchParams.set('tab', 'survival')
    render(<AdminPage />)
    expect(screen.getByRole('tab', { name: /survival/i })).toBeInTheDocument()
    expect(screen.getByText(/paying by tier/i)).toBeInTheDocument()
    expect(screen.queryByText(/apify post sync/i)).not.toBeInTheDocument()
  })

  it('renders the Sign-in tab and reads ?tab=signIn', () => {
    vi.mocked(useQuery).mockImplementation((ref: unknown, ..._rest: unknown[]) => {
      const name = getFunctionName(ref as Parameters<typeof getFunctionName>[0])
      if (name === 'admin:checkIsAdmin') return true as never
      if (name === 'authMetrics:getMetrics' || name === 'landingMetrics:getMetrics') return null as never
      return [] as never
    })
    mockSearchParams.set('tab', 'signIn')
    render(<AdminPage />)
    expect(screen.getByRole('tab', { name: 'Sign-in' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('No sign-in attempts in the last 28 days.')).toBeInTheDocument()
  })
})

describe('AdminPage attention tab', () => {
  // Radix Tabs triggers activate on mousedown. The stateful useSearchParams mock re-renders the
  // page, so the tab's content is rendered after this call.
  function openAttentionTab() {
    fireEvent.mouseDown(screen.getByRole('tab', { name: /attention/i }))
  }

  it('keeps the attention list off the default tab', () => {
    render(<AdminPage />)
    expect(screen.queryByText('No one needs attention right now.')).not.toBeInTheDocument()
  })

  it('shows the empty state when nobody needs attention', () => {
    render(<AdminPage />)
    openAttentionTab()
    expect(screen.getByText('No one needs attention right now.')).toBeInTheDocument()
  })

  it('groups flagged members by reason and shows only the facts that exist', () => {
    vi.mocked(useQuery).mockImplementation((ref: unknown, ..._rest: unknown[]) => {
      const name = getFunctionName(ref as Parameters<typeof getFunctionName>[0])
      if (name === 'admin:checkIsAdmin') return true as never
      if (name === 'admin:getSettings') return undefined as never
      if (name === 'admin:getChurnRisk') return CHURN_FIXTURE as never
      return [] as never
    })
    render(<AdminPage />)
    openAttentionTab()
    expect(screen.getByText('2 members flagged by the interaction graph. Read-only.')).toBeInTheDocument()
    expect(screen.getByText('Needs a reply (1)')).toBeInTheDocument()
    expect(screen.getByText('Cooling off (1)')).toBeInTheDocument()
    expect(screen.getByText('Nadia')).toBeInTheDocument()
    expect(screen.getByText('3 reactions on your post, no reply')).toBeInTheDocument()
    expect(screen.getByText('Last post: 2 days ago · Last interaction: 3 days ago')).toBeInTheDocument()
    expect(screen.getByText('Omar')).toBeInTheDocument()
    expect(screen.queryByText(/none yet/i)).not.toBeInTheDocument()
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
