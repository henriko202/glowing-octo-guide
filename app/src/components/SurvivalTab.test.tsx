import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../convex', () => ({ api: { admin: { survivalMetrics: 'admin.survivalMetrics' } } }))
const mockUseQuery = vi.fn()
vi.mock('convex/react', () => ({ useQuery: (...args: unknown[]) => mockUseQuery(...args) }))

import SurvivalTab, { share, type SurvivalMetrics } from './SurvivalTab'

const FIXTURE: SurvivalMetrics = {
  days: 7,
  since: 0,
  generatedAt: 0,
  cohort: {
    signups: 10,
    startedTrial: 6,
    activated: 4,
    medianMinutesToFirstInteraction: 12,
    returnedDay1: 3,
    returnedDays2to7: 5,
    trialsEnded: 4,
    converted: 2,
    canceled: 1,
    // Not every signup has aged past every window — the shares below divide by these, not by 10.
    activatedEligible: 8,
    returnedDay1Eligible: 6,
    returnedDays2to7Eligible: 5
  },
  payingByTier: { starter: 1, growth: 2, pro: 0, contact: 0 }
}

beforeEach(() => {
  mockUseQuery.mockReset()
  mockUseQuery.mockReturnValue(FIXTURE)
})

describe('share', () => {
  it('rounds to a whole percent and renders – on a zero base', () => {
    expect(share(1, 3)).toBe('33%')
    expect(share(2, 4)).toBe('50%')
    expect(share(0, 0)).toBe('–')
  })
})

describe('SurvivalTab', () => {
  it('renders every metric with its count and, where defined, its share of the right base', () => {
    render(
      <SurvivalTab
        sessionToken="tok"
        isAdmin
      />
    )
    expect(screen.getByRole('row', { name: /signed up/i })).toHaveTextContent('10')
    // Activated divides by the members who have actually cleared 24 h (4 of 8), not by all 10.
    const activated = screen.getByRole('row', { name: /activated within 24 h/i })
    expect(activated).toHaveTextContent('4')
    expect(activated).toHaveTextContent('50%')
    expect(screen.getByRole('row', { name: /median minutes/i })).toHaveTextContent('12')
    // Converted is a share of trials ended (2 of 4), not of signups.
    expect(screen.getByRole('row', { name: /^converted/i })).toHaveTextContent('50%')
    expect(screen.getByRole('row', { name: /growth/i })).toHaveTextContent('2')
    // The scope footnote — the tier heading carries "newest 1000 members" too, so match its lead.
    expect(screen.getByText(/cohort = members who signed up in the window/i)).toBeInTheDocument()
  })

  // A right-censored share reads as a product failure that never happened, so each return metric
  // divides by the members whose window has closed and shows that base next to it.
  it('divides each return metric by its own eligible base and prints the base', () => {
    render(
      <SurvivalTab
        sessionToken="tok"
        isAdmin
      />
    )
    const day1 = screen.getByRole('row', { name: /returned day 1/i })
    expect(day1).toHaveTextContent('50%') // 3 of 6 eligible, not 3 of 10
    expect(day1).toHaveTextContent('6')
    const week = screen.getByRole('row', { name: /returned days 1–7/i })
    expect(week).toHaveTextContent('100%') // 5 of 5 eligible, not 5 of 10
    expect(week).toHaveTextContent('5')
  })

  it('shows – rather than 0% when no member has aged into the window yet', () => {
    mockUseQuery.mockReturnValue({
      ...FIXTURE,
      cohort: {
        ...FIXTURE.cohort,
        activated: 0,
        returnedDay1: 0,
        returnedDays2to7: 0,
        activatedEligible: 0,
        returnedDay1Eligible: 0,
        returnedDays2to7Eligible: 0
      }
    })
    render(
      <SurvivalTab
        sessionToken="tok"
        isAdmin
      />
    )
    for (const label of [/activated within 24 h/i, /returned day 1/i, /returned days 1–7/i]) {
      const row = screen.getByRole('row', { name: label })
      expect(row).toHaveTextContent('–')
      expect(row).not.toHaveTextContent('0%')
    }
    // Started trial still divides by signups, which are never censored.
    expect(screen.getByRole('row', { name: /started trial/i })).toHaveTextContent('60%')
  })

  it('labels the wide return window 1–7 and scopes the tier table to the members it counts', () => {
    render(
      <SurvivalTab
        sessionToken="tok"
        isAdmin
      />
    )
    expect(screen.queryByRole('row', { name: /returned days 2–7/i })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /paying by tier \(all active members\)/i })).toBeInTheDocument()
  })

  it('renders – for a null median', () => {
    mockUseQuery.mockReturnValue({
      ...FIXTURE,
      cohort: { ...FIXTURE.cohort, medianMinutesToFirstInteraction: null }
    })
    render(
      <SurvivalTab
        sessionToken="tok"
        isAdmin
      />
    )
    expect(screen.getByRole('row', { name: /median minutes/i })).toHaveTextContent('–')
  })

  it('carries each metric definition on its row header, where a hover finds it', () => {
    render(
      <SurvivalTab
        sessionToken="tok"
        isAdmin
      />
    )
    const header = screen.getByRole('rowheader', { name: /activated within 24 h/i })
    expect(header.getAttribute('title')).toMatch(/first 24 h have already passed/i)
    expect(screen.getByRole('rowheader', { name: /returned days 1–7/i }).getAttribute('title')).toMatch(
      /includes day 1/i
    )
  })

  it('says nobody signed up instead of rendering a table of zeros, and keeps the tier table', () => {
    mockUseQuery.mockReturnValue({
      ...FIXTURE,
      cohort: {
        ...FIXTURE.cohort,
        signups: 0,
        startedTrial: 0,
        activated: 0,
        medianMinutesToFirstInteraction: null,
        returnedDay1: 0,
        returnedDays2to7: 0,
        trialsEnded: 0,
        converted: 0,
        canceled: 0,
        activatedEligible: 0,
        returnedDay1Eligible: 0,
        returnedDays2to7Eligible: 0
      }
    })
    render(
      <SurvivalTab
        sessionToken="tok"
        isAdmin
      />
    )
    expect(screen.getByText('No signups in the last 7 days.')).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /signed up/i })).not.toBeInTheDocument()
    expect(screen.getByRole('row', { name: /growth/i })).toHaveTextContent('2')
  })

  it('prints the window its UTC note refers to', () => {
    mockUseQuery.mockReturnValue({
      ...FIXTURE,
      since: Date.UTC(2026, 8, 1, 9, 30),
      generatedAt: Date.UTC(2026, 8, 8, 9, 30)
    })
    render(
      <SurvivalTab
        sessionToken="tok"
        isAdmin
      />
    )
    expect(screen.getByText(/2026-09-01 09:30 – 2026-09-08 09:30 UTC/)).toBeInTheDocument()
  })

  it('shows the no-snapshot state and keeps the window toggle live', () => {
    mockUseQuery.mockReturnValue(null)
    render(
      <SurvivalTab
        sessionToken="tok"
        isAdmin
      />
    )
    expect(screen.getByText(/no snapshot yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '28 days' }))
    expect(mockUseQuery).toHaveBeenLastCalledWith('admin.survivalMetrics', { sessionToken: 'tok', days: 28 })
  })

  it('captions the snapshot with the nightly rebuild time', () => {
    mockUseQuery.mockReturnValue({ ...FIXTURE, generatedAt: Date.UTC(2026, 8, 8, 3, 15) })
    render(
      <SurvivalTab
        sessionToken="tok"
        isAdmin
      />
    )
    expect(screen.getByText(/snapshot as of 2026-09-08 03:15 utc/i)).toBeInTheDocument()
    expect(screen.queryByText(/newest 1000 members/i)).not.toBeInTheDocument()
  })

  it('re-queries with days: 28 when the toggle is pressed and marks it pressed', () => {
    render(
      <SurvivalTab
        sessionToken="tok"
        isAdmin
      />
    )
    expect(screen.getByRole('button', { name: '7 days' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: '28 days' }))
    expect(mockUseQuery).toHaveBeenLastCalledWith('admin.survivalMetrics', { sessionToken: 'tok', days: 28 })
    expect(screen.getByRole('button', { name: '28 days' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '7 days' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('skips the query and shows the spinner while loading', () => {
    mockUseQuery.mockReturnValue(undefined)
    render(
      <SurvivalTab
        sessionToken={undefined}
        isAdmin
      />
    )
    expect(mockUseQuery).toHaveBeenCalledWith('admin.survivalMetrics', 'skip')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
