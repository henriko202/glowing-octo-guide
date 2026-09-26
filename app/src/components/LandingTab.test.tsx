import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LandingTab, { type AuthMetrics, type LandingMetrics } from './LandingTab'

vi.mock('../convex', () => ({
  api: {
    landingMetrics: { getMetrics: 'landingMetrics.getMetrics' },
    authMetrics: { getMetrics: 'authMetrics.getMetrics' }
  }
}))
const mockUseQuery = vi.fn()
vi.mock('convex/react', () => ({ useQuery: (...args: unknown[]) => mockUseQuery(...args) }))

const FIXTURE: LandingMetrics = {
  days: 28,
  sinceDay: '2026-08-25',
  pricingViews: 40,
  ctaClicks: 6,
  uniquePricingViewers: 20,
  uniqueCtaClickers: 5,
  uniqueTrackingEnabled: true,
  byPlacement: [
    { placement: 'hero', clicks: 3, uniqueClicks: 2 },
    { placement: 'nav', clicks: 0, uniqueClicks: 0 },
    { placement: 'pricing', clicks: 2, uniqueClicks: 2 },
    { placement: 'final', clicks: 1, uniqueClicks: 1 }
  ],
  daily: [
    { day: '2026-09-20', pricingViews: 12, uniquePricingViewers: 8, ctaClicks: 2, uniqueCtaClickers: 2 },
    { day: '2026-09-19', pricingViews: 28, uniquePricingViewers: 12, ctaClicks: 4, uniqueCtaClickers: 3 },
    { day: '2026-09-18', pricingViews: 0, uniquePricingViewers: 0, ctaClicks: 0, uniqueCtaClickers: 0 }
  ]
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
let landing: LandingMetrics | undefined
let signIns: AuthMetrics | undefined

beforeEach(() => {
  landing = FIXTURE
  signIns = NO_SIGN_INS
  mockUseQuery.mockReset()
  mockUseQuery.mockImplementation((ref: string) => (ref === 'authMetrics.getMetrics' ? signIns : landing))
})

function renderTab() {
  return render(
    <LandingTab
      sessionToken="tok"
      isAdmin
    />
  )
}

function lastArgs(ref: string) {
  const calls = mockUseQuery.mock.calls.filter(([called]) => called === ref)
  return calls[calls.length - 1]?.[1]
}

function signInCells(name: RegExp) {
  const section = screen.getByRole('region', { name: 'Sign-in' })
  return within(within(section).getByRole('row', { name }))
    .getAllByRole('cell')
    .map(c => c.textContent)
}

describe('LandingTab', () => {
  it('renders the unique headline figures, the share computed from uniques, and every placement', () => {
    renderTab()
    expect(screen.getByText('Unique pricing viewers')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('40 total views')).toBeInTheDocument()
    expect(screen.getByText('Unique trial CTA clickers')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('6 total clicks')).toBeInTheDocument()
    expect(screen.getByText('25% click-through')).toBeInTheDocument()
    expect(screen.queryByText(/unique counting is off/i)).not.toBeInTheDocument()

    expect(screen.getByRole('columnheader', { name: 'Unique' })).toBeInTheDocument()
    expect(
      within(screen.getByRole('row', { name: /hero/i }))
        .getAllByRole('cell')
        .map(c => c.textContent)
    ).toEqual(['3', '2'])
    expect(
      within(screen.getByRole('row', { name: /nav/i }))
        .getAllByRole('cell')
        .map(c => c.textContent)
    ).toEqual(['0', '0'])
    expect(
      within(screen.getByRole('row', { name: /pricing/i }))
        .getAllByRole('cell')
        .map(c => c.textContent)
    ).toEqual(['2', '2'])
    expect(
      within(screen.getByRole('row', { name: /final cta/i }))
        .getAllByRole('cell')
        .map(c => c.textContent)
    ).toEqual(['1', '1'])
  })

  it('renders each daily row with its four figures', () => {
    renderTab()
    expect(screen.getByRole('columnheader', { name: 'Day' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Unique views' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Unique clicks' })).toBeInTheDocument()
    expect(
      within(screen.getByRole('row', { name: /2026-09-20/ }))
        .getAllByRole('cell')
        .map(c => c.textContent)
    ).toEqual(['12', '8', '2', '2'])
    expect(
      within(screen.getByRole('row', { name: /2026-09-19/ }))
        .getAllByRole('cell')
        .map(c => c.textContent)
    ).toEqual(['28', '12', '4', '3'])
  })

  it('renders the days in the order the server sent them, including an all-zero day', () => {
    renderTab()
    expect(screen.getAllByRole('rowheader').map(cell => cell.textContent)).toEqual([
      'Hero',
      'Nav',
      'Pricing',
      'Final CTA',
      '2026-09-20',
      '2026-09-19',
      '2026-09-18'
    ])
    expect(
      within(screen.getByRole('row', { name: /2026-09-18/ }))
        .getAllByRole('cell')
        .map(c => c.textContent)
    ).toEqual(['0', '0', '0', '0'])
  })

  it('states the daily-reset rule in the footer', () => {
    renderTab()
    expect(screen.getByText(/uniques reset each UTC day/i)).toBeInTheDocument()
    expect(screen.getByText(/sums daily uniques/i)).toBeInTheDocument()
  })

  it('warns when unique counting is disabled', () => {
    landing = { ...FIXTURE, uniqueTrackingEnabled: false }
    renderTab()
    const warning = screen.getByText(/unique counting is off/i)
    expect(warning).toHaveTextContent('LANDING_METRICS_SECRET')
    expect(warning).toHaveTextContent('UNSUBSCRIBE_SECRET')
  })

  it('shows – rather than 0% when nothing has been viewed', () => {
    landing = {
      ...FIXTURE,
      pricingViews: 0,
      ctaClicks: 1,
      uniquePricingViewers: 0,
      uniqueCtaClickers: 0
    }
    renderTab()
    expect(screen.getByText('– click-through')).toBeInTheDocument()
    expect(screen.queryByText('0% click-through')).not.toBeInTheDocument()
  })

  it('renders the empty state and no table when the window has no events', () => {
    landing = {
      ...FIXTURE,
      pricingViews: 0,
      ctaClicks: 0,
      byPlacement: FIXTURE.byPlacement.map(row => ({ ...row, clicks: 0 }))
    }
    renderTab()
    expect(screen.getByText('No landing events in the last 28 days.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('defaults both queries to the 28-day window and re-queries both when the toggle changes', () => {
    renderTab()
    expect(lastArgs('landingMetrics.getMetrics')).toEqual({ sessionToken: 'tok', days: 28 })
    expect(lastArgs('authMetrics.getMetrics')).toEqual({ sessionToken: 'tok', days: 28 })
    expect(screen.getByRole('button', { name: '28 days' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: '7 days' }))
    expect(lastArgs('landingMetrics.getMetrics')).toEqual({ sessionToken: 'tok', days: 7 })
    expect(lastArgs('authMetrics.getMetrics')).toEqual({ sessionToken: 'tok', days: 7 })

    fireEvent.click(screen.getByRole('button', { name: '28 days' }))
    expect(lastArgs('landingMetrics.getMetrics')).toEqual({ sessionToken: 'tok', days: 28 })
    expect(lastArgs('authMetrics.getMetrics')).toEqual({ sessionToken: 'tok', days: 28 })
    expect(screen.getByRole('button', { name: '28 days' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('skips both queries and shows the spinner while loading', () => {
    landing = undefined
    signIns = undefined
    render(
      <LandingTab
        sessionToken={undefined}
        isAdmin
      />
    )
    expect(mockUseQuery).toHaveBeenCalledWith('landingMetrics.getMetrics', 'skip')
    expect(mockUseQuery).toHaveBeenCalledWith('authMetrics.getMetrics', 'skip')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('keeps the spinner until the sign-in numbers arrive too', () => {
    signIns = undefined
    renderTab()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Sign-in' })).not.toBeInTheDocument()
  })
})

describe('LandingTab sign-in funnel', () => {
  it('follows the landing clicks through LinkedIn, split into new and returning members', () => {
    signIns = SIGN_INS
    renderTab()
    expect(signInCells(/landing cta clicks/i)).toEqual(['6', '–', '–'])
    expect(signInCells(/sent to linkedin/i)).toEqual(['9', '–', '–'])
    expect(signInCells(/back from linkedin/i)).toEqual(['7', '3', '4'])
    expect(signInCells(/^signed in/i)).toEqual(['6', '2', '4'])
  })

  it('lists every failure reason with its count', () => {
    signIns = SIGN_INS
    renderTab()
    expect(signInCells(/canceled on linkedin/i)).toEqual(['1'])
    expect(signInCells(/linkedin returned an error/i)).toEqual(['0'])
    expect(signInCells(/cookie missing/i)).toEqual(['1'])
    expect(signInCells(/callback rejected/i)).toEqual(['0'])
    expect(signInCells(/error after linkedin/i)).toEqual(['0'])
  })

  it('renders each sign-in day with sent, back, signed in and failed', () => {
    signIns = SIGN_INS
    renderTab()
    expect(signInCells(/2026-09-20/)).toEqual(['5', '4', '4', '1'])
    expect(signInCells(/2026-09-19/)).toEqual(['4', '3', '2', '1'])
  })

  it('explains the gaps between the steps', () => {
    signIns = SIGN_INS
    renderTab()
    const section = screen.getByRole('region', { name: 'Sign-in' })
    expect(within(section).getByText(/starts on its own when a session expires/i)).toBeInTheDocument()
    expect(within(section).getByText(/stopped on the last step/i)).toBeInTheDocument()
  })

  it('keeps the sign-in funnel when the landing window is empty', () => {
    landing = { ...FIXTURE, pricingViews: 0, ctaClicks: 0 }
    signIns = SIGN_INS
    renderTab()
    expect(screen.getByText('No landing events in the last 28 days.')).toBeInTheDocument()
    expect(signInCells(/landing cta clicks/i)).toEqual(['0', '–', '–'])
    expect(signInCells(/sent to linkedin/i)).toEqual(['9', '–', '–'])
  })

  it('says so when nobody tried to sign in, without tables', () => {
    renderTab()
    const section = screen.getByRole('region', { name: 'Sign-in' })
    expect(within(section).getByText('No sign-in attempts in the last 28 days.')).toBeInTheDocument()
    expect(within(section).queryByRole('table')).not.toBeInTheDocument()
  })
})
