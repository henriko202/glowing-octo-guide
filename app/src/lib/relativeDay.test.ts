import { describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import { timeAgo } from './relativeDay'

describe('timeAgo', () => {
  it('says Today under a day and counts whole days after', () => {
    const t = i18n.t.bind(i18n)
    expect(timeAgo(Date.now() - 1000, t)).toBe('Today')
    expect(timeAgo(Date.now() - 3 * 86_400_000, t)).toBe('3 days ago')
  })
})
