import { describe, it, expect } from 'vitest'
import {
  validateLimitArgs,
  assertNotSelfBan,
  effectiveContactLimits,
  toSurvivalMetrics,
  deriveChurnReasons,
  buildChurnHook,
  relativeDay,
  type ChurnSignals
} from './admin'
import type { Doc } from './_generated/dataModel'

const DAY = 86_400_000

describe('validateLimitArgs', () => {
  it('passes with valid positive values', () => {
    expect(() => validateLimitArgs(25, 1)).not.toThrow()
    expect(() => validateLimitArgs(1, 1)).not.toThrow()
    expect(() => validateLimitArgs(200, 5)).not.toThrow()
  })

  it('throws when interactionsPerPost < 1', () => {
    expect(() => validateLimitArgs(0, 1)).toThrow('>= 1')
    expect(() => validateLimitArgs(-1, 1)).toThrow('>= 1')
  })

  it('throws when postsPerWeek < 1', () => {
    expect(() => validateLimitArgs(25, 0)).toThrow('>= 1')
    expect(() => validateLimitArgs(25, -5)).toThrow('>= 1')
  })
})

describe('assertNotSelfBan', () => {
  it('throws when an admin targets their own id', () => {
    expect(() => assertNotSelfBan('admin1', 'admin1')).toThrow("can't ban yourself")
  })

  it('does not throw when targeting a different user', () => {
    expect(() => assertNotSelfBan('admin1', 'user2')).not.toThrow()
  })
})

describe('effectiveContactLimits', () => {
  const def = { interactionsPerPost: 200, postsPerWeek: 5 }

  it('uses the override and flags hasOverride when one exists', () => {
    expect(effectiveContactLimits({ interactionsPerPost: 500, postsPerWeek: 10 }, def)).toEqual({
      interactionsPerPost: 500,
      postsPerWeek: 10,
      hasOverride: true
    })
  })

  it('falls back to the contact default (no override) when none exists', () => {
    expect(effectiveContactLimits(undefined, def)).toEqual({
      interactionsPerPost: 200,
      postsPerWeek: 5,
      hasOverride: false
    })
  })

  it('falls back to hardcoded contact defaults when no default row exists', () => {
    expect(effectiveContactLimits(undefined, undefined)).toEqual({
      interactionsPerPost: 200,
      postsPerWeek: 5,
      hasOverride: false
    })
  })
})

// admin.survivalMetrics now reads one stored row (jobs/survivalSnapshot.ts); these pin the pure
// projection from that row to the panel payload, including the "no snapshot yet" null.
describe('toSurvivalMetrics', () => {
  const snapshot = {
    _id: 'snap1',
    _creationTime: 1,
    days: 28,
    generatedAt: 1_700_000_000_000,
    since: 1_697_000_000_000,
    cohort: {
      signups: 4,
      startedTrial: 2,
      activated: 1,
      medianMinutesToFirstInteraction: 12,
      returnedDay1: 1,
      returnedDays2to7: 2,
      trialsEnded: 1,
      converted: 1,
      canceled: 0,
      activatedEligible: 3,
      returnedDay1Eligible: 2,
      returnedDays2to7Eligible: 1
    },
    payingByTier: { starter: 1, growth: 1, pro: 0, contact: 0 }
  } as unknown as Doc<'survivalSnapshots'>

  it('returns null until the nightly rebuild has written a snapshot', () => {
    expect(toSurvivalMetrics(null)).toBeNull()
  })

  it('projects the stored row and defaults a legacy row without onboarded to 0', () => {
    expect(toSurvivalMetrics(snapshot)).toEqual({
      days: 28,
      since: 1_697_000_000_000,
      generatedAt: 1_700_000_000_000,
      cohort: { ...snapshot.cohort, onboarded: 0 },
      payingByTier: snapshot.payingByTier
    })
  })

  it('keeps the onboarded count a rebuilt row carries', () => {
    const rebuilt = {
      ...snapshot,
      cohort: { ...snapshot.cohort, onboarded: 3 }
    } as unknown as Doc<'survivalSnapshots'>
    expect(toSurvivalMetrics(rebuilt)?.cohort.onboarded).toBe(3)
  })
})

// admin.getChurnRisk's reason/hook rules, as pure functions.
describe('deriveChurnReasons', () => {
  const base: ChurnSignals = { made7d: 0, made30d: 0, received7d: 0, active: false, lastInteractionAt: null }

  it('flags received_no_reply when attention came in but none went out', () => {
    expect(deriveChurnReasons({ ...base, received7d: 2 })).toEqual(['received_no_reply'])
  })

  it('flags silent_7d only while the member is still logging in', () => {
    expect(deriveChurnReasons({ ...base, active: true })).toEqual(['silent_7d'])
    expect(deriveChurnReasons({ ...base, active: false })).toEqual([])
  })

  it('flags cooling when the 7d pace is under a quarter of the 30d pace', () => {
    expect(deriveChurnReasons({ ...base, made30d: 8, made7d: 1 })).toEqual(['cooling'])
    expect(deriveChurnReasons({ ...base, made30d: 8, made7d: 2 })).toEqual([])
  })

  it('stacks silent_7d and cooling for an active member with only old activity', () => {
    expect(deriveChurnReasons({ ...base, active: true, made30d: 8 })).toEqual(['silent_7d', 'cooling'])
  })
})

describe('buildChurnHook', () => {
  const base: ChurnSignals = { made7d: 0, made30d: 0, received7d: 0, active: false, lastInteractionAt: null }

  it('prefers the received-no-reply line and pluralizes', () => {
    expect(buildChurnHook({ ...base, received7d: 1 }, 0)).toBe('1 interaction on your post, no reply')
    expect(buildChurnHook({ ...base, received7d: 3 }, 0)).toBe('3 interactions on your post, no reply')
  })

  it('reports how long a silent member has been quiet', () => {
    const now = 100 * DAY
    expect(buildChurnHook({ ...base, active: true, lastInteractionAt: now - 9 * DAY }, now)).toBe(
      'no interactions since 9 days ago'
    )
    expect(buildChurnHook({ ...base, active: true }, now)).toBe('no interactions yet')
  })

  it('reports the week-over-30d drop for a cooling member', () => {
    expect(buildChurnHook({ ...base, made30d: 8, made7d: 1 }, 0)).toBe(
      '1 interaction this week, down from 8 in 30 days'
    )
    expect(buildChurnHook({ ...base, made30d: 8, made7d: 0 }, 0)).toBe(
      '0 interactions this week, down from 8 in 30 days'
    )
  })
})

describe('relativeDay', () => {
  const now = 100 * DAY

  it('names today, yesterday, and older day counts', () => {
    expect(relativeDay(now, now)).toBe('today')
    expect(relativeDay(now - DAY, now)).toBe('yesterday')
    expect(relativeDay(now - 45 * DAY, now)).toBe('45 days ago')
  })
})
