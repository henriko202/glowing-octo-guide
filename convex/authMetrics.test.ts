import { describe, expect, it } from 'vitest'
import { summarizeAuthMetrics } from './authMetrics'

describe('summarizeAuthMetrics', () => {
  it('totals every event across the window, zeros included', () => {
    const summary = summarizeAuthMetrics(
      [
        { day: '2026-09-19', event: 'started', count: 3 },
        { day: '2026-09-20', event: 'started', count: 2 },
        { day: '2026-09-20', event: 'linkedin_ok_new', count: 1 },
        { day: '2026-09-20', event: 'signed_in_new', count: 1 },
        { day: '2026-09-20', event: 'denied', count: 1 }
      ],
      { sinceDay: '2026-09-19', days: 2 }
    )
    expect(summary.totals).toEqual({
      started: 5,
      linkedin_ok_new: 1,
      linkedin_ok_returning: 0,
      signed_in_new: 1,
      signed_in_returning: 0,
      denied: 1,
      linkedin_error: 0,
      lost_cookie: 0,
      rejected: 0,
      error: 0
    })
  })

  it('groups each day into sent, back, signed in and failed, newest first with quiet days as zeros', () => {
    const summary = summarizeAuthMetrics(
      [
        { day: '2026-09-20', event: 'started', count: 4 },
        { day: '2026-09-20', event: 'linkedin_ok_new', count: 1 },
        { day: '2026-09-20', event: 'linkedin_ok_returning', count: 2 },
        { day: '2026-09-20', event: 'signed_in_new', count: 1 },
        { day: '2026-09-20', event: 'signed_in_returning', count: 1 },
        { day: '2026-09-20', event: 'denied', count: 1 },
        { day: '2026-09-20', event: 'error', count: 1 },
        { day: '2026-09-18', event: 'lost_cookie', count: 2 },
        { day: '2026-09-18', event: 'rejected', count: 1 },
        { day: '2026-09-18', event: 'linkedin_error', count: 1 }
      ],
      { sinceDay: '2026-09-18', days: 3 }
    )
    expect(summary.daily).toEqual([
      { day: '2026-09-20', started: 4, linkedinOk: 3, signedIn: 2, failed: 2 },
      { day: '2026-09-19', started: 0, linkedinOk: 0, signedIn: 0, failed: 0 },
      { day: '2026-09-18', started: 0, linkedinOk: 0, signedIn: 0, failed: 4 }
    ])
  })
})
