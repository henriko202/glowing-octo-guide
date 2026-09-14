import { describe, expect, it } from 'vitest'
import { timeAgoDetailed } from './relativeDay'

const t = ((key: string, opts?: Record<string, unknown>) =>
  opts ? `${key}:${JSON.stringify(opts)}` : key) as unknown as Parameters<typeof timeAgoDetailed>[1]

describe('timeAgoDetailed', () => {
  it('resolves minutes, hours and days', () => {
    const now = Date.now()
    expect(timeAgoDetailed(now, t)).toBe('notifications.justNow')
    expect(timeAgoDetailed(now - 5 * 60_000, t)).toBe('notifications.minutesAgo:{"count":5}')
    expect(timeAgoDetailed(now - 3 * 3_600_000, t)).toBe('notifications.hoursAgo:{"count":3}')
    expect(timeAgoDetailed(now - 2 * 86_400_000, t)).toBe('notifications.daysAgo:{"count":2}')
  })
})
