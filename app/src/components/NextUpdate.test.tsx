import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => `${key}${opts ? JSON.stringify(opts) : ''}`,
    i18n: { language: 'en' }
  })
}))

import NextUpdate from './NextUpdate'

describe('NextUpdate', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders hours, minutes and seconds and refreshes them every second', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-14T01:30:00Z'))
    render(<NextUpdate />)
    expect(screen.getByText(/rankings\.nextUpdate/)).toBeInTheDocument()
    expect(screen.getByText('rankings.nextUpdate{"when":"2h 0m 0s"}')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1_000))
    expect(screen.getByText('rankings.nextUpdate{"when":"1h 59m 59s"}')).toBeInTheDocument()
  })

  it('drops the empty leading units when the update is under an hour away', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-14T03:00:00Z'))
    render(<NextUpdate />)
    expect(screen.getByText('rankings.nextUpdate{"when":"30m 0s"}')).toBeInTheDocument()
  })

  it('rolls over to tomorrow once the 03:30 UTC rebuild passes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-14T01:30:00Z'))
    render(<NextUpdate />)

    // 121 minutes later is 03:31 UTC — just past the 03:30 rebuild, so the target rolls to tomorrow.
    act(() => vi.advanceTimersByTime(121 * 60_000))
    expect(screen.getByText('rankings.nextUpdate{"when":"23h 59m 0s"}')).toBeInTheDocument()
  })
})
