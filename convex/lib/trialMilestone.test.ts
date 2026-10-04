import { describe, it, expect } from 'vitest'
import {
  crossesThreshold,
  findDuplicateSubscription,
  findLiveSubscription,
  isNearThreshold,
  isStaleEvent,
  isStatusRegression,
  isTrialConversion,
  pickTrialingSubscription,
  planHasTrial,
  shouldEndTrialEarly,
  trialEligible,
  trialDaysFor,
  wentLive,
  TRIAL_INTERACTION_THRESHOLD,
  TRIAL_PERIOD_DAYS,
  TRIAL_WARNING_THRESHOLD,
  INVITED_TRIAL_PERIOD_DAYS
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

describe('planHasTrial', () => {
  // 2026-10-03 launch promotion: Starter and Growth bill at checkout.
  it('grants a trial on Pro only', () => {
    expect(planHasTrial('pro')).toBe(true)
    expect(planHasTrial('starter')).toBe(false)
    expect(planHasTrial('growth')).toBe(false)
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

describe('isTrialConversion', () => {
  it('is true only for trialing → active', () => {
    expect(isTrialConversion('trialing', 'active')).toBe(true)
    expect(isTrialConversion('active', 'active')).toBe(false)
    expect(isTrialConversion('trialing', 'canceled')).toBe(false)
    expect(isTrialConversion(undefined, 'active')).toBe(false)
  })
})

describe('isStaleEvent', () => {
  it('rejects an event older than the last one applied to the row', () => {
    expect(isStaleEvent(2000, 1000)).toBe(true)
  })
  it('applies a newer event, and a same-second one in arrival order', () => {
    expect(isStaleEvent(1000, 2000)).toBe(false)
    expect(isStaleEvent(1000, 1000)).toBe(false)
  })
  it('never rejects when either side has no stamp', () => {
    expect(isStaleEvent(undefined, 1000)).toBe(false)
    expect(isStaleEvent(1000, undefined)).toBe(false)
    expect(isStaleEvent(undefined, undefined)).toBe(false)
  })
})

describe('wentLive', () => {
  it('is true for the event that first makes a row live', () => {
    expect(wentLive(undefined, 'trialing')).toBe(true) // a trial's created
    expect(wentLive(undefined, 'active')).toBe(true) // a paid Checkout's created, or an updated landing first
    expect(wentLive('incomplete', 'active')).toBe(true) // the first payment of one born incomplete
  })
  it('is false once the row is live, and for a non-live event', () => {
    expect(wentLive('trialing', 'trialing')).toBe(false) // a retried created
    expect(wentLive('trialing', 'active')).toBe(false)
    expect(wentLive('past_due', 'active')).toBe(false)
    expect(wentLive(undefined, 'incomplete')).toBe(false)
    expect(wentLive('active', 'canceled')).toBe(false)
  })
})

describe('isStatusRegression', () => {
  it('rejects incomplete for a row already trialing or active', () => {
    expect(isStatusRegression('active', 'incomplete')).toBe(true)
    expect(isStatusRegression('trialing', 'incomplete')).toBe(true)
    expect(isStatusRegression('active', 'incomplete_expired')).toBe(true)
  })
  it('lets incomplete through otherwise, past_due included so a failed first payment can still expire', () => {
    expect(isStatusRegression(undefined, 'incomplete')).toBe(false)
    expect(isStatusRegression('incomplete', 'incomplete_expired')).toBe(false)
    expect(isStatusRegression('past_due', 'incomplete_expired')).toBe(false)
    expect(isStatusRegression('active', 'past_due')).toBe(false)
  })
})

describe('shouldEndTrialEarly', () => {
  it('ends a live trial that has a Stripe id', () => {
    expect(shouldEndTrialEarly({ stripeSubscriptionId: 'sub_1' })).toBe(true)
    expect(shouldEndTrialEarly({ stripeSubscriptionId: 'sub_1', cancelAtPeriodEnd: false })).toBe(true)
  })
  it('leaves a cancel-pending trial to run to its promised date', () => {
    expect(shouldEndTrialEarly({ stripeSubscriptionId: 'sub_1', cancelAtPeriodEnd: true })).toBe(false)
  })
  it('does nothing without a row or a Stripe id', () => {
    expect(shouldEndTrialEarly(undefined)).toBe(false)
    expect(shouldEndTrialEarly({ stripeSubscriptionId: undefined })).toBe(false)
  })
})

// backlog/R19 — the invited peer's gift is a longer trial; the interaction threshold is unchanged.
describe('trialDaysFor', () => {
  it('is 7 for a plain signup and 14 for a member who joined through an invite', () => {
    expect(TRIAL_PERIOD_DAYS).toBe(7)
    expect(INVITED_TRIAL_PERIOD_DAYS).toBe(14)
    expect(trialDaysFor({})).toBe(7)
    expect(trialDaysFor({ referredByCode: undefined })).toBe(7)
    expect(trialDaysFor({ referredByCode: 'abc12345' })).toBe(14)
  })
})
