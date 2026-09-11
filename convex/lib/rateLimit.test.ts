import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkRateLimit,
  enforceOAuthStartBudget,
  OAUTH_START_GLOBAL_PER_HOUR,
  OAUTH_START_PER_CLIENT_PER_HOUR,
  RATE_LIMIT_ACTIONS,
  resetUserRateLimits,
  tryConsumeRateLimit
} from './rateLimit'

// The rate-limit algorithm itself now lives in @convex-dev/rate-limiter (tested upstream). These
// tests pin OUR wiring: that each helper hands the component the right inline config + key, throws
// with the expected message on denial, passes the boolean through, and that erasure resets every
// rate-limited action for the key.
const calls = vi.hoisted(() => ({
  limit: [] as Array<{ name: string; opts: any }>,
  reset: [] as Array<{ name: string; args: any }>,
  nextOk: true
}))

vi.mock('@convex-dev/rate-limiter', () => ({
  RateLimiter: class {
    constructor(_component: unknown) {}
    async limit(_ctx: unknown, name: string, opts: any) {
      calls.limit.push({ name, opts })
      return { ok: calls.nextOk, retryAfter: calls.nextOk ? undefined : 1000 }
    }
    async reset(_ctx: unknown, name: string, args: any) {
      calls.reset.push({ name, args })
    }
  }
}))

const DAY_MS = 24 * 60 * 60 * 1000
const ctx = { runMutation: async () => undefined } as any

beforeEach(() => {
  calls.limit.length = 0
  calls.reset.length = 0
  calls.nextOk = true
})

describe('checkRateLimit', () => {
  it('consumes an inline fixed-window limit keyed by userId (rate = max, period = window)', async () => {
    await checkRateLimit(ctx, 'u1' as any, 'profile_refresh', 2, DAY_MS, 'day')
    expect(calls.limit).toHaveLength(1)
    expect(calls.limit[0]).toMatchObject({
      name: 'profile_refresh',
      opts: { key: 'u1', config: { kind: 'fixed window', rate: 2, period: DAY_MS } }
    })
  })

  it('throws with the window label when the component denies the call', async () => {
    calls.nextOk = false
    await expect(checkRateLimit(ctx, 'u1' as any, 'profile_refresh', 2, DAY_MS, 'day')).rejects.toThrow(
      /at most 2 times per day/
    )
  })

  it('defaults to a 1-hour window when none is passed', async () => {
    await checkRateLimit(ctx, 'u1' as any, 'submitFeedback', 5)
    expect(calls.limit[0].opts.config.period).toBe(60 * 60 * 1000)
  })
})

describe('tryConsumeRateLimit', () => {
  it('returns true when the component allows the call', async () => {
    expect(await tryConsumeRateLimit(ctx, 'u1' as any, 'profile_refresh', 2, DAY_MS)).toBe(true)
  })

  it('returns false (no throw) when the component denies the call', async () => {
    calls.nextOk = false
    expect(await tryConsumeRateLimit(ctx, 'u1' as any, 'profile_refresh', 2, DAY_MS)).toBe(false)
  })
})

describe('resetUserRateLimits', () => {
  it('resets every rate-limited action for the key (erasure completeness)', async () => {
    await resetUserRateLimits(ctx, 'u1' as any)
    expect(calls.reset.map(r => r.name).sort()).toEqual([...RATE_LIMIT_ACTIONS].sort())
    for (const r of calls.reset) expect(r.args).toEqual({ key: 'u1' })
  })
})

describe('enforceOAuthStartBudget', () => {
  it('enforces the per-client 60/h limit and the global 1800/h backstop when a key is present', async () => {
    await enforceOAuthStartBudget(ctx, '203.0.113.7')
    expect(calls.limit).toHaveLength(2)
    expect(calls.limit[0]).toMatchObject({
      name: 'oauthStartClient',
      opts: {
        key: '203.0.113.7',
        config: { kind: 'fixed window', rate: OAUTH_START_PER_CLIENT_PER_HOUR, period: 60 * 60 * 1000 }
      }
    })
    expect(calls.limit[1]).toMatchObject({
      name: 'oauthStart',
      opts: {
        key: 'global',
        config: { kind: 'fixed window', rate: OAUTH_START_GLOBAL_PER_HOUR, period: 60 * 60 * 1000 }
      }
    })
  })

  it('enforces only the global backstop when no client key is present', async () => {
    await enforceOAuthStartBudget(ctx)
    expect(calls.limit).toHaveLength(1)
    expect(calls.limit[0]).toMatchObject({ name: 'oauthStart', opts: { key: 'global' } })
  })

  it('throws the shared sign-in message when a dimension denies', async () => {
    calls.nextOk = false
    await expect(enforceOAuthStartBudget(ctx, '203.0.113.7')).rejects.toThrow(
      'Too many sign-in attempts. Please try again shortly.'
    )
  })
})

describe('RATE_LIMIT_ACTIONS', () => {
  it('registers every billing and deletion action (erasure completeness)', () => {
    const added = [
      'createCheckoutSession',
      'purchaseFeaturedPost',
      'createPortalSession',
      'createCancelFlowSession',
      'createPlanSwitchSession',
      'undoScheduledDowngrade',
      'resumeSubscription',
      'requestAccountDeletion',
      'cancelAccountDeletion'
    ]
    expect([...RATE_LIMIT_ACTIONS].sort()).toEqual(expect.arrayContaining([...added].sort()))
  })
})
