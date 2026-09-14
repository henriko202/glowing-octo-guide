import { describe, it, expect } from 'vitest'
import { validateLimitArgs, assertNotSelfBan, effectiveContactLimits, toSurvivalMetrics } from './admin'
import type { Doc } from './_generated/dataModel'

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
