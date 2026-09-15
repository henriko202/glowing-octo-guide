/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { api } from '../_generated/api'
import type { TestConvex } from 'convex-test'
import type { Id } from '../_generated/dataModel'
import schema from '../schema'
import { POLICY_VERSION } from '../lib/policy'
import { signUnsubscribeToken } from '../lib/unsubscribeToken'

const modules = import.meta.glob('../**/*.ts')
type T = TestConvex<typeof schema>

const SECRET = 'integration-unsubscribe-secret'
const savedSecret = process.env.UNSUBSCRIBE_SECRET

beforeEach(() => {
  process.env.UNSUBSCRIBE_SECRET = SECRET
})

afterEach(() => {
  if (savedSecret === undefined) delete process.env.UNSUBSCRIBE_SECRET
  else process.env.UNSUBSCRIBE_SECRET = savedSecret
})

async function seedUser(t: T, linkedinId: string, extra: { digestEmailsEnabled?: boolean } = {}): Promise<Id<'users'>> {
  return t.run(async ctx =>
    ctx.db.insert('users', {
      linkedinId,
      name: linkedinId,
      subscriptionStatus: 'none',
      createdAt: Date.now(),
      ...extra
    })
  )
}

async function auditsWithAction(t: T, action: string) {
  return t.run(async ctx => (await ctx.db.query('auditLogs').collect()).filter(a => a.action === action))
}

async function marketingRows(t: T, userId: Id<'users'>) {
  return t.run(async ctx =>
    ctx.db
      .query('consentRecords')
      .withIndex('by_user_and_purpose_and_created_at', q => q.eq('userId', userId).eq('purpose', 'marketing'))
      .order('asc')
      .collect()
  )
}

describe('users.unsubscribeByToken', () => {
  test('returns unavailable when UNSUBSCRIBE_SECRET is unset and touches nothing', async () => {
    delete process.env.UNSUBSCRIBE_SECRET
    const t = convexTest(schema, modules)
    const user = await seedUser(t, 'li-unset', { digestEmailsEnabled: true })

    const res = await t.mutation(api.users.unsubscribeByToken, { token: 'a.b', scope: 'all' })

    expect(res).toEqual({ status: 'unavailable' })
    expect((await t.run(async ctx => ctx.db.get(user)))?.digestEmailsEnabled).toBe(true)
    expect(await t.run(async ctx => ctx.db.query('consentRecords').collect())).toHaveLength(0)
    expect(await t.run(async ctx => ctx.db.query('auditLogs').collect())).toHaveLength(0)
  })

  test('maps a malformed token and a token for an unknown user to the same invalid', async () => {
    const t = convexTest(schema, modules)
    const unknownToken = await signUnsubscribeToken('missing-user', SECRET)

    expect(await t.mutation(api.users.unsubscribeByToken, { token: 'not-a-token', scope: 'digest' })).toEqual({
      status: 'invalid'
    })
    expect(await t.mutation(api.users.unsubscribeByToken, { token: unknownToken, scope: 'all' })).toEqual({
      status: 'invalid'
    })
    expect(await t.run(async ctx => ctx.db.query('auditLogs').collect())).toHaveLength(0)
    expect(await t.run(async ctx => ctx.db.query('consentRecords').collect())).toHaveLength(0)
  })

  test('digest scope turns the flag off once, audits digest_unsubscribed_app, and never touches consent', async () => {
    const t = convexTest(schema, modules)
    const user = await seedUser(t, 'li-digest', { digestEmailsEnabled: true })
    const token = await signUnsubscribeToken(user, SECRET)

    expect(await t.mutation(api.users.unsubscribeByToken, { token, scope: 'digest' })).toEqual({ status: 'ok' })
    expect((await t.run(async ctx => ctx.db.get(user)))?.digestEmailsEnabled).toBe(false)
    const audits = await auditsWithAction(t, 'digest_unsubscribed_app')
    expect(audits).toHaveLength(1)
    expect(audits[0]).toMatchObject({ actor: 'user', actorId: user, targetUserId: user })
    expect(await t.run(async ctx => ctx.db.query('consentRecords').collect())).toHaveLength(0)

    expect(await t.mutation(api.users.unsubscribeByToken, { token, scope: 'digest' })).toEqual({ status: 'ok' })
    expect(await auditsWithAction(t, 'digest_unsubscribed_app')).toHaveLength(1)
  })

  test('all scope also withdraws marketing consent once and is idempotent', async () => {
    const t = convexTest(schema, modules)
    const user = await seedUser(t, 'li-all', { digestEmailsEnabled: true })
    const token = await signUnsubscribeToken(user, SECRET)

    expect(await t.mutation(api.users.unsubscribeByToken, { token, scope: 'all' })).toEqual({ status: 'ok' })
    expect((await t.run(async ctx => ctx.db.get(user)))?.digestEmailsEnabled).toBe(false)
    expect(await auditsWithAction(t, 'unsubscribe_all_email')).toHaveLength(1)

    let rows = await marketingRows(t, user)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      userId: user,
      purpose: 'marketing',
      granted: false,
      policyVersion: POLICY_VERSION
    })

    // Repeat: the digest is already off and the latest marketing row is already a withdrawal — nothing new.
    expect(await t.mutation(api.users.unsubscribeByToken, { token, scope: 'all' })).toEqual({ status: 'ok' })
    rows = await marketingRows(t, user)
    expect(rows).toHaveLength(1)
    expect(await auditsWithAction(t, 'unsubscribe_all_email')).toHaveLength(1)
  })

  test('all scope records a fresh withdrawal only after marketing was granted again', async () => {
    const t = convexTest(schema, modules)
    const user = await seedUser(t, 'li-regrant', { digestEmailsEnabled: true })
    const token = await signUnsubscribeToken(user, SECRET)

    await t.mutation(api.users.unsubscribeByToken, { token, scope: 'all' })
    await t.run(async ctx => {
      await ctx.db.insert('consentRecords', {
        userId: user,
        purpose: 'marketing',
        granted: true,
        policyVersion: POLICY_VERSION,
        createdAt: Date.now() + 1
      })
    })

    expect(await t.mutation(api.users.unsubscribeByToken, { token, scope: 'all' })).toEqual({ status: 'ok' })
    const rows = await marketingRows(t, user)
    // withdrawal → re-grant → fresh withdrawal
    expect(rows).toHaveLength(3)
    expect(rows[1]).toMatchObject({ granted: true })
    expect(rows[2]).toMatchObject({ granted: false, policyVersion: POLICY_VERSION })

    // The latest row is a withdrawal again, so another call appends nothing.
    await t.mutation(api.users.unsubscribeByToken, { token, scope: 'all' })
    expect(await marketingRows(t, user)).toHaveLength(3)
    // The digest was already off on the second call, so only the first call added an audit row.
    expect(await auditsWithAction(t, 'unsubscribe_all_email')).toHaveLength(1)
  })
})
