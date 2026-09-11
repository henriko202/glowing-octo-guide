import { describe, it, expect } from 'vitest'
import { bumpTrialInteractionHandler, type TrialBumpCtx } from './interactions'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'

// The three predicates this handler calls are covered in lib/trialMilestone.test.ts. What is pinned
// here is the WIRING between them — that the 50th combined interaction is the one that ends the
// trial, on the right subscription, exactly once. That is the moment the member's card is charged.
// Since plan 018 the counters live in their own `trialCounters` row (patch when present, insert on
// the first trial interaction) instead of on `users`; the thresholds themselves are unchanged. The
// first insert is seeded from the legacy `users.trialInteractionsMade/Received` fields (then clears
// them) so the deploy window cannot reset the meter or skip a milestone.

type Row = { status: string; stripeSubscriptionId?: string; cancelAtPeriodEnd?: boolean }
type User = {
  subscriptionStatus?: string
  trialInteractionsMade?: number
  trialInteractionsReceived?: number
}
type Counter = { made: number; received: number }
type CounterPatch = { made?: number; received?: number }
type LegacyClear = { trialInteractionsMade: undefined; trialInteractionsReceived: undefined }
type PatchCall = { id: Id<'users'> | Id<'trialCounters'>; fields: CounterPatch | LegacyClear }

const USER_ID = 'u1' as Id<'users'>
const COUNTER_ID = 'c1' as Id<'trialCounters'>

function createCtx(user: User | null, counter: Counter | null = null) {
  const patches: PatchCall[] = []
  const inserts: Array<{ userId: string; made: number; received: number }> = []
  const scheduled: Array<{ fn: unknown; args: Record<string, unknown> }> = []
  let loads = 0
  let counterReads = 0
  const ctx: TrialBumpCtx = {
    db: {
      get: async () => user,
      query: () => ({
        withIndex: () => ({
          unique: async () => {
            counterReads++
            return counter ? { _id: COUNTER_ID, made: counter.made, received: counter.received } : null
          }
        })
      }),
      patch: async (id, fields) => {
        patches.push({ id, fields })
      },
      insert: async (_table, doc) => {
        inserts.push(doc)
        return COUNTER_ID
      }
    },
    scheduler: {
      runAfter: async (_delay, fn, args) => {
        scheduled.push({ fn, args })
      }
    }
  }
  // Counts its own calls: below the threshold the subscriptions index must not be read at all.
  const load = (rows: readonly Row[]) => async () => {
    loads++
    return rows
  }
  return { ctx, patches, inserts, scheduled, load, loadCount: () => loads, counterReads: () => counterReads }
}

const trialCtx = (made: number, received = 0) => createCtx({ subscriptionStatus: 'trialing' }, { made, received })

const LIVE_TRIAL: Row[] = [{ status: 'trialing', stripeSubscriptionId: 'sub_live' }]

describe('bumpTrialInteractionHandler', () => {
  it('counts nothing for a member who is not on a trial', async () => {
    for (const user of [{ subscriptionStatus: 'active' }, {}, null]) {
      const t = createCtx(user)
      await bumpTrialInteractionHandler(t.ctx, USER_ID, 'made', t.load(LIVE_TRIAL))
      expect(t.patches).toHaveLength(0)
      expect(t.inserts).toHaveLength(0)
      expect(t.scheduled).toHaveLength(0)
      // The trialing gate returns before the counter table is touched.
      expect(t.counterReads()).toBe(0)
    }
  })

  it('bumps the side it was told to, and only that side', async () => {
    const made = trialCtx(3, 7)
    await bumpTrialInteractionHandler(made.ctx, USER_ID, 'made', made.load(LIVE_TRIAL))
    expect(made.patches).toEqual([{ id: COUNTER_ID, fields: { made: 4 } }])
    expect(made.inserts).toHaveLength(0)

    const received = trialCtx(3, 7)
    await bumpTrialInteractionHandler(received.ctx, USER_ID, 'received', received.load(LIVE_TRIAL))
    expect(received.patches).toEqual([{ id: COUNTER_ID, fields: { received: 8 } }])
    expect(received.inserts).toHaveLength(0)
  })

  it("inserts the counter row on a trialing member's first interaction", async () => {
    const made = createCtx({ subscriptionStatus: 'trialing' })
    await bumpTrialInteractionHandler(made.ctx, USER_ID, 'made', made.load(LIVE_TRIAL))
    expect(made.patches).toHaveLength(0)
    expect(made.inserts).toEqual([{ userId: USER_ID, made: 1, received: 0 }])

    const received = createCtx({ subscriptionStatus: 'trialing' })
    await bumpTrialInteractionHandler(received.ctx, USER_ID, 'received', received.load(LIVE_TRIAL))
    expect(received.inserts).toEqual([{ userId: USER_ID, made: 0, received: 1 }])
  })

  it('seeds the counter from legacy fields on the first post-deploy bump, then charges at 50', async () => {
    const t = createCtx({ subscriptionStatus: 'trialing', trialInteractionsMade: 49 })
    await bumpTrialInteractionHandler(t.ctx, USER_ID, 'made', t.load(LIVE_TRIAL))
    // 49 legacy + this one = 50: the seeded row is written at 50, not 1 (the meter never resets).
    expect(t.inserts).toEqual([{ userId: USER_ID, made: 50, received: 0 }])
    // Consumed in the same mutation, so the migration can never add them to the row again.
    expect(t.patches).toEqual([
      { id: USER_ID, fields: { trialInteractionsMade: undefined, trialInteractionsReceived: undefined } }
    ])
    // Pre-increment combined = 49: the charge fires, and the 40 warning does NOT double-fire.
    expect(t.scheduled).toHaveLength(1)
    expect(t.scheduled[0].fn).toBe(internal.billingNode.endTrialEarly)
    expect(t.scheduled[0].args).toEqual({ stripeSubscriptionId: 'sub_live' })
  })

  it('seeds the counter from legacy fields and warns at 40 on the first post-deploy bump', async () => {
    const t = createCtx({ subscriptionStatus: 'trialing', trialInteractionsMade: 39 })
    await bumpTrialInteractionHandler(t.ctx, USER_ID, 'made', t.load(LIVE_TRIAL))
    expect(t.inserts).toEqual([{ userId: USER_ID, made: 40, received: 0 }])
    expect(t.patches).toEqual([
      { id: USER_ID, fields: { trialInteractionsMade: undefined, trialInteractionsReceived: undefined } }
    ])
    expect(t.scheduled).toHaveLength(1)
    expect(t.scheduled[0].fn).toBe(internal.notifications.sendTrialNearEnd)
    expect(t.scheduled[0].args).toEqual({ userId: USER_ID })
  })

  it('warns at 40 combined and charges nothing yet', async () => {
    const t = trialCtx(20, 19) // 39 → 40
    await bumpTrialInteractionHandler(t.ctx, USER_ID, 'made', t.load(LIVE_TRIAL))
    expect(t.scheduled).toHaveLength(1)
    expect(t.scheduled[0].fn).toBe(internal.notifications.sendTrialNearEnd)
    expect(t.scheduled[0].args).toEqual({ userId: USER_ID })
    // The warning branch must not pay for the index read only the charge branch needs.
    expect(t.loadCount()).toBe(0)
  })

  it('ends the trial on the 50th — the interaction that charges the card', async () => {
    const t = trialCtx(30, 19) // 49 → 50
    await bumpTrialInteractionHandler(t.ctx, USER_ID, 'received', t.load(LIVE_TRIAL))
    expect(t.scheduled).toHaveLength(1)
    expect(t.scheduled[0].fn).toBe(internal.billingNode.endTrialEarly)
    expect(t.scheduled[0].args).toEqual({ stripeSubscriptionId: 'sub_live' })
  })

  it('fires once: the 51st charges nothing and warns nothing', async () => {
    const t = trialCtx(30, 20) // 50 → 51
    await bumpTrialInteractionHandler(t.ctx, USER_ID, 'made', t.load(LIVE_TRIAL))
    expect(t.patches).toEqual([{ id: COUNTER_ID, fields: { made: 31 } }])
    expect(t.scheduled).toHaveLength(0)
  })

  it('never reads the subscriptions index below the threshold', async () => {
    const t = trialCtx(5, 5)
    await bumpTrialInteractionHandler(t.ctx, USER_ID, 'made', t.load(LIVE_TRIAL))
    expect(t.loadCount()).toBe(0)
  })

  it('charges the trialing subscription, not an older canceled one', async () => {
    const t = trialCtx(49)
    const rows: Row[] = [
      { status: 'canceled', stripeSubscriptionId: 'sub_old' },
      { status: 'trialing', stripeSubscriptionId: 'sub_new' }
    ]
    await bumpTrialInteractionHandler(t.ctx, USER_ID, 'made', t.load(rows))
    expect(t.scheduled).toHaveLength(1)
    expect(t.scheduled[0].args).toEqual({ stripeSubscriptionId: 'sub_new' })
  })

  it('leaves a cancel-pending trial to run to the date the cancel dialog promised', async () => {
    const t = trialCtx(49)
    const rows: Row[] = [{ status: 'trialing', stripeSubscriptionId: 'sub_live', cancelAtPeriodEnd: true }]
    await bumpTrialInteractionHandler(t.ctx, USER_ID, 'made', t.load(rows))
    // Still counted — the member may resume, and the meter has to be right if they do.
    expect(t.patches).toEqual([{ id: COUNTER_ID, fields: { made: 50 } }])
    expect(t.scheduled).toHaveLength(0)
  })

  it('charges nothing when the trial row carries no Stripe id', async () => {
    const t = trialCtx(49)
    await bumpTrialInteractionHandler(t.ctx, USER_ID, 'made', t.load([{ status: 'trialing' }]))
    expect(t.scheduled).toHaveLength(0)
  })
})
