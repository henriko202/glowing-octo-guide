import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LandingTab, { type LandingMetrics } from './LandingTab'

vi.mock('../convex', () => ({ api: { landingMetrics: { getMetrics: 'landingMetrics.getMetrics' } } }))
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

beforeEach(() => {
  mockUseQuery.mockReset()
  mockUseQuery.mockReturnValue(FIXTURE)
})

describe('LandingTab', () => {
  it('renders the unique headline figures, the share computed from uniques, and every placement', () => {
    render(
      <LandingTab
        sessionToken="tok"
        isAdmin
      />
    )
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
    render(
      <LandingTab
        sessionToken="tok"
        isAdmin
      />
    )
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
    render(
      <LandingTab
        sessionToken="tok"
        isAdmin
      />
    )
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
    render(
      <LandingTab
        sessionToken="tok"
        isAdmin
      />
    )
    expect(screen.getByText(/uniques reset each UTC day/i)).toBeInTheDocument()
    expect(screen.getByText(/sums daily uniques/i)).toBeInTheDocument()
  })

  it('warns when unique counting is disabled', () => {
    mockUseQuery.mockReturnValue({ ...FIXTURE, uniqueTrackingEnabled: false })
    render(
      <LandingTab
        sessionToken="tok"
        isAdmin
      />
    )
    const warning = screen.getByText(/unique counting is off/i)
    expect(warning).toHaveTextContent('LANDING_METRICS_SECRET')
    expect(warning).toHaveTextContent('UNSUBSCRIBE_SECRET')
  })

  it('shows – rather than 0% when nothing has been viewed', () => {
    mockUseQuery.mockReturnValue({
      ...FIXTURE,
      pricingViews: 0,
      ctaClicks: 1,
      uniquePricingViewers: 0,
      uniqueCtaClickers: 0
    })
    render(
      <LandingTab
        sessionToken="tok"
        isAdmin
      />
    )
    expect(screen.getByText('– click-through')).toBeInTheDocument()
    expect(screen.queryByText('0% click-through')).not.toBeInTheDocument()
  })

  it('renders the empty state and no table when the window has no events', () => {
    mockUseQuery.mockReturnValue({
      ...FIXTURE,
      pricingViews: 0,
      ctaClicks: 0,
      byPlacement: FIXTURE.byPlacement.map(row => ({ ...row, clicks: 0 }))
    })
    render(
      <LandingTab
        sessionToken="tok"
        isAdmin
      />
    )
    expect(screen.getByText('No landing events in the last 28 days.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('defaults to the 28-day window and re-queries when the toggle changes', () => {
    render(
      <LandingTab
        sessionToken="tok"
        isAdmin
      />
    )
    expect(mockUseQuery).toHaveBeenLastCalledWith('landingMetrics.getMetrics', { sessionToken: 'tok', days: 28 })
    expect(screen.getByRole('button', { name: '28 days' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: '7 days' }))
    expect(mockUseQuery).toHaveBeenLastCalledWith('landingMetrics.getMetrics', { sessionToken: 'tok', days: 7 })

    fireEvent.click(screen.getByRole('button', { name: '28 days' }))
    expect(mockUseQuery).toHaveBeenLastCalledWith('landingMetrics.getMetrics', { sessionToken: 'tok', days: 28 })
    expect(screen.getByRole('button', { name: '28 days' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('skips the query and shows the spinner while loading', () => {
    mockUseQuery.mockReturnValue(undefined)
    render(
      <LandingTab
        sessionToken={undefined}
        isAdmin
      />
    )
    expect(mockUseQuery).toHaveBeenCalledWith('landingMetrics.getMetrics', 'skip')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
