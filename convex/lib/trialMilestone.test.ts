import { describe, it, expect } from 'vitest'
import {
  crossesThreshold,
  findDuplicateSubscription,
  findLiveSubscription,
  isNearThreshold,
  pickTrialingSubscription,
  trialEligible,
  TRIAL_INTERACTION_THRESHOLD,
  TRIAL_WARNING_THRESHOLD
} from './trialMilestone'

describe('trialMilestone', () => {
  it('threshold is 50', () => {
    expect(TRIAL_INTERACTION_THRESHOLD).toBe(50)
  })
  it('crosses only on the +1 that reaches 50', () => {
    expect(crossesThreshold(49, 1)).toBe(true)
    expect(crossesThreshold(48, 1)).toBe(false)
    expect(crossesThreshold(50, 1)).toBe(false) // already past — fire once only
    expect(crossesThreshold(0, 1)).toBe(false)
  })
})

describe('isNearThreshold', () => {
  it('is true from 40 up to but not including 50', () => {
    expect(TRIAL_WARNING_THRESHOLD).toBe(40)
    expect(isNearThreshold(39)).toBe(false)
    expect(isNearThreshold(40)).toBe(true)
    expect(isNearThreshold(49)).toBe(true)
    expect(isNearThreshold(50)).toBe(false)
  })
})

describe('crossesThreshold at the warning threshold', () => {
  it('fires once, on the increment that reaches 40', () => {
    expect(crossesThreshold(39, 1, TRIAL_WARNING_THRESHOLD)).toBe(true)
    expect(crossesThreshold(40, 1, TRIAL_WARNING_THRESHOLD)).toBe(false)
  })
})

describe('findLiveSubscription', () => {
  it('finds trialing, active and past_due rows', () => {
    expect(findLiveSubscription([{ status: 'trialing' }])?.status).toBe('trialing')
    expect(findLiveSubscription([{ status: 'active' }])?.status).toBe('active')
    expect(findLiveSubscription([{ status: 'past_due' }])?.status).toBe('past_due')
  })
  it('ignores canceled and incomplete rows', () => {
    expect(findLiveSubscription([{ status: 'canceled' }, { status: 'incomplete_expired' }])).toBeUndefined()
    expect(findLiveSubscription([])).toBeUndefined()
  })
  it('finds a live row behind a canceled one', () => {
    expect(findLiveSubscription([{ status: 'canceled' }, { status: 'active' }])?.status).toBe('active')
  })
})

describe('pickTrialingSubscription', () => {
  // The bug this exists to prevent: by_user is ordered by _creationTime, so .first()
  // returns the OLDEST row — the canceled one after a cancel + re-subscribe.
  it('returns the trialing row even when an older canceled row precedes it', () => {
    const rows = [
      { status: 'canceled', stripeSubscriptionId: 'sub_old' },
      { status: 'trialing', stripeSubscriptionId: 'sub_new' }
    ]
    expect(pickTrialingSubscription(rows)?.stripeSubscriptionId).toBe('sub_new')
  })
  it('returns undefined when nothing is trialing', () => {
    expect(pickTrialingSubscription([{ status: 'active' }, { status: 'canceled' }])).toBeUndefined()
    expect(pickTrialingSubscription([])).toBeUndefined()
  })
})

describe('trialEligible', () => {
  it('grants a trial only to a user with no subscription row ever', () => {
    expect(trialEligible(0)).toBe(true)
    expect(trialEligible(1)).toBe(false)
    expect(trialEligible(3)).toBe(false)
  })
  it('the threshold constants stay put', () => {
    expect(TRIAL_INTERACTION_THRESHOLD).toBe(50)
  })
})

describe('findDuplicateSubscription', () => {
  it('needs two live rows', () => {
    expect(findDuplicateSubscription([])).toBeUndefined()
    expect(findDuplicateSubscription([{ status: 'trialing', stripeCreated: 1 }])).toBeUndefined()
    expect(
      findDuplicateSubscription([
        { status: 'canceled', stripeCreated: 1 },
        { status: 'trialing', stripeCreated: 2 }
      ])
    ).toBeUndefined()
  })
  it('voids the newest by Stripe created, whatever order the rows arrive in', () => {
    const a = { status: 'trialing', stripeCreated: 1000, id: 'a' }
    const b = { status: 'trialing', stripeCreated: 2000, id: 'b' }
    expect(findDuplicateSubscription([a, b])?.id).toBe('b')
    expect(findDuplicateSubscription([b, a])?.id).toBe('b')
  })
  it('never voids a row that predates the stamp', () => {
    const old = { status: 'active', id: 'old' }
    const dup = { status: 'trialing', stripeCreated: 5, id: 'dup' }
    expect(findDuplicateSubscription([old, dup])?.id).toBe('dup')
  })
  it('ignores canceled rows, however new', () => {
    const kept = { status: 'trialing', stripeCreated: 1, id: 'kept' }
    const dup = { status: 'trialing', stripeCreated: 2, id: 'dup' }
    const gone = { status: 'canceled', stripeCreated: 3, id: 'gone' }
    expect(findDuplicateSubscription([kept, dup, gone])?.id).toBe('dup')
  })
})
