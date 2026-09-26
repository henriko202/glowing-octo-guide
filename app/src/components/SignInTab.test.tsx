import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SignInTab, { type AuthMetrics } from './SignInTab'
import type { LandingMetrics } from './LandingTab'

vi.mock('../convex', () => ({
  api: {
    landingMetrics: { getMetrics: 'landingMetrics.getMetrics' },
    authMetrics: { getMetrics: 'authMetrics.getMetrics' }
  }
}))
const mockUseQuery = vi.fn()
vi.mock('convex/react', () => ({ useQuery: (...args: unknown[]) => mockUseQuery(...args) }))

// Only ctaClicks feeds this tab; the rest keeps the landing query's shape.
const LANDING: LandingMetrics = {
  days: 28,
  sinceDay: '2026-08-25',
  pricingViews: 40,
  ctaClicks: 6,
  uniquePricingViewers: 20,
  uniqueCtaClickers: 5,
  uniqueTrackingEnabled: true,
  byPlacement: [],
  daily: []
}

const NO_SIGN_INS: AuthMetrics = {
  days: 28,
  sinceDay: '2026-08-25',
  totals: {
    started: 0,
    linkedin_ok_new: 0,
    linkedin_ok_returning: 0,
    signed_in_new: 0,
    signed_in_returning: 0,
    denied: 0,
    linkedin_error: 0,
    lost_cookie: 0,
    rejected: 0,
    error: 0
  },
  daily: [{ day: '2026-09-20', started: 0, linkedinOk: 0, signedIn: 0, failed: 0 }]
}

const SIGN_INS: AuthMetrics = {
  ...NO_SIGN_INS,
  totals: {
    ...NO_SIGN_INS.totals,
    started: 9,
    linkedin_ok_new: 3,
    linkedin_ok_returning: 4,
    signed_in_new: 2,
    signed_in_returning: 4,
    denied: 1,
    lost_cookie: 1
  },
  daily: [
    { day: '2026-09-20', started: 5, linkedinOk: 4, signedIn: 4, failed: 1 },
    { day: '2026-09-19', started: 4, linkedinOk: 3, signedIn: 2, failed: 1 }
  ]
}

// Each query answers from its own fixture; a test swaps one before rendering.
let landing: LandingMetrics | null | undefined
let signIns: AuthMetrics | undefined

beforeEach(() => {
  landing = LANDING
  signIns = SIGN_INS
  mockUseQuery.mockReset()
  mockUseQuery.mockImplementation((ref: string) => (ref === 'authMetrics.getMetrics' ? signIns : landing))
})

function renderTab() {
  return render(
    <SignInTab
      sessionToken="tok"
      isAdmin
    />
  )
}

function lastArgs(ref: string) {
  const calls = mockUseQuery.mock.calls.filter(([called]) => called === ref)
  return calls[calls.length - 1]?.[1]
}

function cells(name: RegExp) {
  return within(screen.getByRole('row', { name }))
    .getAllByRole('cell')
    .map(c => c.textContent)
}

describe('SignInTab', () => {
  it('follows the landing clicks through LinkedIn, split into new and returning members', () => {
    renderTab()
    expect(cells(/landing cta clicks/i)).toEqual(['6', '–', '–'])
    expect(cells(/sent to linkedin/i)).toEqual(['9', '–', '–'])
    expect(cells(/back from linkedin/i)).toEqual(['7', '3', '4'])
    expect(cells(/^signed in/i)).toEqual(['6', '2', '4'])
  })

  it('lists every failure reason with its count', () => {
    renderTab()
    expect(cells(/canceled on linkedin/i)).toEqual(['1'])
    expect(cells(/linkedin returned an error/i)).toEqual(['0'])
    expect(cells(/cookie missing/i)).toEqual(['1'])
    expect(cells(/callback rejected/i)).toEqual(['0'])
    expect(cells(/error after linkedin/i)).toEqual(['0'])
  })

  it('renders each day with sent, back, signed in and failed', () => {
    renderTab()
    expect(cells(/2026-09-20/)).toEqual(['5', '4', '4', '1'])
    expect(cells(/2026-09-19/)).toEqual(['4', '3', '2', '1'])
  })

  it('explains the gaps between the steps', () => {
    renderTab()
    expect(screen.getByText(/starts on its own when a session expires/i)).toBeInTheDocument()
    expect(screen.getByText(/stopped on the last step/i)).toBeInTheDocument()
  })

  it('counts no landing clicks when the landing query has nothing', () => {
    landing = null
    renderTab()
    expect(cells(/landing cta clicks/i)).toEqual(['0', '–', '–'])
    expect(cells(/sent to linkedin/i)).toEqual(['9', '–', '–'])
  })

  it('says so when nobody tried to sign in, without tables', () => {
    signIns = NO_SIGN_INS
    renderTab()
    expect(screen.getByText('No sign-in attempts in the last 28 days.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('defaults both queries to the 28-day window and re-queries both when the toggle changes', () => {
    renderTab()
    expect(lastArgs('authMetrics.getMetrics')).toEqual({ sessionToken: 'tok', days: 28 })
    expect(lastArgs('landingMetrics.getMetrics')).toEqual({ sessionToken: 'tok', days: 28 })
    expect(screen.getByRole('button', { name: '28 days' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: '7 days' }))
    expect(lastArgs('authMetrics.getMetrics')).toEqual({ sessionToken: 'tok', days: 7 })
    expect(lastArgs('landingMetrics.getMetrics')).toEqual({ sessionToken: 'tok', days: 7 })
    expect(screen.getByRole('button', { name: '7 days' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('skips both queries and shows the spinner while loading', () => {
    landing = undefined
    signIns = undefined
    render(
      <SignInTab
        sessionToken={undefined}
        isAdmin
      />
    )
    expect(mockUseQuery).toHaveBeenCalledWith('authMetrics.getMetrics', 'skip')
    expect(mockUseQuery).toHaveBeenCalledWith('landingMetrics.getMetrics', 'skip')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('keeps the spinner until the landing clicks arrive too', () => {
    landing = undefined
    renderTab()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
