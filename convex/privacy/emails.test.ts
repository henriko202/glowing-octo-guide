import { describe, it, expect } from 'vitest'
import { exportReadyEmail, deletionScheduledEmail, deletionCompletedEmail, dormancyWarningEmail } from './emails'

describe('privacy email templates', () => {
  it('exportReadyEmail includes the app name and a body', () => {
    const m = exportReadyEmail()
    expect(m.subject).toMatch(/export/i)
    expect(m.html).toContain('Link Into The SSI')
    expect(m.text.length).toBeGreaterThan(0)
  })

  it('deletionScheduledEmail states the deletion date', () => {
    const m = deletionScheduledEmail('June 30, 2026')
    expect(m.subject).toMatch(/deletion/i)
    expect(m.html).toContain('June 30, 2026')
    expect(m.text).toContain('June 30, 2026')
  })

  it('deletionCompletedEmail confirms removal', () => {
    const m = deletionCompletedEmail()
    expect(m.subject).toMatch(/deleted/i)
    expect(m.html).toContain('Link Into The SSI')
  })
})

describe('dormancyWarningEmail', () => {
  it('names the deletion date and the reactivation action', () => {
    const m = dormancyWarningEmail('June 30, 2026')
    expect(m.subject).toMatch(/inactive|deletion/i)
    expect(m.html).toContain('June 30, 2026')
    expect(m.text).toContain('June 30, 2026')
  })
})
