import { describe, it, expect } from 'vitest'
import { bumpTrialInteractionHandler, type TrialBumpCtx } from './interactions'
import { internal } from './_generated/api'

// The three predicates this handler calls are covered in lib/trialMilestone.test.ts. What is pinned
// here is the WIRING between them — that the 50th combined interaction is the one that ends the
// trial, on the right subscription, exactly once. That is the moment the member's card is charged.

type Row = { status: string; stripeSubscriptionId?: string; cancelAtPeriodEnd?: boolean }
type User = { subscriptionStatus?: string; trialInteractionsMade?: number; trialInteractionsReceived?: number }

function createCtx(user: User | null) {
  const patches: Array<Record<string, number>> = []
  const scheduled: Array<{ fn: unknown; args: Record<string, unknown> }> = []
  let loads = 0
  const ctx: TrialBumpCtx = {
    db: {
      get: async () => user,
      patch: async (_id, fields) => {
        patches.push(fields)
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
  return { ctx, patches, scheduled, load, loadCount: () => loads }
}

const trialing = (made: number, received = 0): User => ({
  subscriptionStatus: 'trialing',
  trialInteractionsMade: made,
  trialInteractionsReceived: received
})

const LIVE_TRIAL: Row[] = [{ status: 'trialing', stripeSubscriptionId: 'sub_live' }]

describe('bumpTrialInteractionHandler', () => {
  it('counts nothing for a member who is not on a trial', async () => {
    for (const user of [{ subscriptionStatus: 'active' }, {}, null]) {
      const t = createCtx(user)
      await bumpTrialInteractionHandler(t.ctx, 'u1', 'made', t.load(LIVE_TRIAL))
      expect(t.patches).toHaveLength(0)
      expect(t.scheduled).toHaveLength(0)
    }
  })

  it('bumps the side it was told to, and only that side', async () => {
    const made = createCtx(trialing(3, 7))
    await bumpTrialInteractionHandler(made.ctx, 'u1', 'made', made.load(LIVE_TRIAL))
    expect(made.patches).toEqual([{ trialInteractionsMade: 4 }])

    const received = createCtx(trialing(3, 7))
    await bumpTrialInteractionHandler(received.ctx, 'u1', 'received', received.load(LIVE_TRIAL))
    expect(received.patches).toEqual([{ trialInteractionsReceived: 8 }])
  })

  it('warns at 40 combined and charges nothing yet', async () => {
    const t = createCtx(trialing(20, 19)) // 39 → 40
    await bumpTrialInteractionHandler(t.ctx, 'u1', 'made', t.load(LIVE_TRIAL))
    expect(t.scheduled).toHaveLength(1)
    expect(t.scheduled[0].fn).toBe(internal.notifications.sendTrialNearEnd)
    expect(t.scheduled[0].args).toEqual({ userId: 'u1' })
    // The warning branch must not pay for the index read only the charge branch needs.
    expect(t.loadCount()).toBe(0)
  })

  it('ends the trial on the 50th — the interaction that charges the card', async () => {
    const t = createCtx(trialing(30, 19)) // 49 → 50
    await bumpTrialInteractionHandler(t.ctx, 'u1', 'received', t.load(LIVE_TRIAL))
    expect(t.scheduled).toHaveLength(1)
    expect(t.scheduled[0].fn).toBe(internal.billingNode.endTrialEarly)
    expect(t.scheduled[0].args).toEqual({ stripeSubscriptionId: 'sub_live' })
  })

  it('fires once: the 51st charges nothing and warns nothing', async () => {
    const t = createCtx(trialing(30, 20)) // 50 → 51
    await bumpTrialInteractionHandler(t.ctx, 'u1', 'made', t.load(LIVE_TRIAL))
    expect(t.patches).toEqual([{ trialInteractionsMade: 31 }])
    expect(t.scheduled).toHaveLength(0)
  })

  it('never reads the subscriptions index below the threshold', async () => {
    const t = createCtx(trialing(5, 5))
    await bumpTrialInteractionHandler(t.ctx, 'u1', 'made', t.load(LIVE_TRIAL))
    expect(t.loadCount()).toBe(0)
  })

  it('charges the trialing subscription, not an older canceled one', async () => {
    const t = createCtx(trialing(49))
    const rows: Row[] = [
      { status: 'canceled', stripeSubscriptionId: 'sub_old' },
      { status: 'trialing', stripeSubscriptionId: 'sub_new' }
    ]
    await bumpTrialInteractionHandler(t.ctx, 'u1', 'made', t.load(rows))
    expect(t.scheduled).toHaveLength(1)
    expect(t.scheduled[0].args).toEqual({ stripeSubscriptionId: 'sub_new' })
  })

  it('leaves a cancel-pending trial to run to the date the cancel dialog promised', async () => {
    const t = createCtx(trialing(49))
    const rows: Row[] = [{ status: 'trialing', stripeSubscriptionId: 'sub_live', cancelAtPeriodEnd: true }]
    await bumpTrialInteractionHandler(t.ctx, 'u1', 'made', t.load(rows))
    // Still counted — the member may resume, and the meter has to be right if they do.
    expect(t.patches).toEqual([{ trialInteractionsMade: 50 }])
    expect(t.scheduled).toHaveLength(0)
  })

  it('charges nothing when the trial row carries no Stripe id', async () => {
    const t = createCtx(trialing(49))
    await bumpTrialInteractionHandler(t.ctx, 'u1', 'made', t.load([{ status: 'trialing' }]))
    expect(t.scheduled).toHaveLength(0)
  })
})
