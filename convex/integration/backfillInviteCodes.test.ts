/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { internal } from '../_generated/api'
import type { TestConvex } from 'convex-test'
import type { Id } from '../_generated/dataModel'
import schema from '../schema'
import { INVITE_CODE_RE } from '../lib/invite'

// The real generated modules — this config has no `convex/server` alias, so functions run against
// the real convex-test backend (validators, indexes, transactions) instead of the unit mock shim.
const modules = import.meta.glob('../**/*.ts')

type T = TestConvex<typeof schema>

const backfill = internal.migrations.backfillInviteCodes.backfillInviteCodes

async function insertUser(t: T, linkedinId: string, inviteCode?: string): Promise<Id<'users'>> {
  return t.run(async ctx =>
    ctx.db.insert('users', {
      linkedinId,
      name: 'Member',
      subscriptionStatus: 'trialing',
      createdAt: Date.now(),
      ...(inviteCode ? { inviteCode } : {})
    })
  )
}

async function codesByLinkedinId(t: T): Promise<Record<string, string | undefined>> {
  const users = await t.run(async ctx => ctx.db.query('users').collect())
  return Object.fromEntries(users.map(u => [u.linkedinId, u.inviteCode]))
}

describe('migrations.backfillInviteCodes', () => {
  test('mints a valid, unique code for every member missing one', async () => {
    const t = convexTest(schema, modules)
    await insertUser(t, 'u1')
    await insertUser(t, 'u2')
    await insertUser(t, 'u3')

    await t.mutation(backfill, {})

    const codes = await codesByLinkedinId(t)
    for (const id of ['u1', 'u2', 'u3']) expect(codes[id]).toMatch(INVITE_CODE_RE)
    // Distinct codes, including across rows patched in the same transaction.
    expect(new Set(Object.values(codes)).size).toBe(3)
  })

  test('never reissues an existing code, and mints nothing it cannot collide with', async () => {
    const t = convexTest(schema, modules)
    await insertUser(t, 'keeper', 'abc12345')
    await insertUser(t, 'fresh')

    await t.mutation(backfill, {})

    const codes = await codesByLinkedinId(t)
    expect(codes.keeper).toBe('abc12345')
    expect(codes.fresh).toMatch(INVITE_CODE_RE)
    expect(codes.fresh).not.toBe('abc12345')
  })

  test('is idempotent — a second run changes nothing', async () => {
    const t = convexTest(schema, modules)
    await insertUser(t, 'u1')
    await insertUser(t, 'u2')

    await t.mutation(backfill, {})
    const first = await codesByLinkedinId(t)
    await t.mutation(backfill, {})
    expect(await codesByLinkedinId(t)).toEqual(first)
  })

  test('drains more than one batch, minting a code for every member', async () => {
    const t = convexTest(schema, modules)
    await t.run(async ctx => {
      for (let i = 0; i < 150; i += 1) {
        await ctx.db.insert('users', {
          linkedinId: `u${i}`,
          name: 'Member',
          subscriptionStatus: 'trialing',
          createdAt: Date.now()
        })
      }
    })

    await t.mutation(backfill, {})
    // The mutation processes one batch (100) and schedules the continuation; drain it before
    // asserting (same pattern as notifications.test.ts's oversized markAllRead drain).
    await t.finishAllScheduledFunctions(() => {})

    const codes = Object.values(await codesByLinkedinId(t))
    expect(codes).toHaveLength(150)
    for (const code of codes) expect(code).toMatch(INVITE_CODE_RE)
    expect(new Set(codes).size).toBe(150)
  })
})
