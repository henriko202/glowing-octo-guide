/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from '../_generated/api'
import type { TestConvex } from 'convex-test'
import type { Id } from '../_generated/dataModel'
import schema from '../schema'

// The real generated modules — this config has no `convex/server` alias, so functions run against
// the real convex-test backend (validators, indexes, transactions) instead of the unit mock shim.
const modules = import.meta.glob('../**/*.ts')

type T = TestConvex<typeof schema>

async function seedUser(t: T, linkedinId: string): Promise<{ userId: Id<'users'>; token: string }> {
  const userId = await t.run(async ctx =>
    ctx.db.insert('users', {
      linkedinId,
      name: 'Digest User',
      subscriptionStatus: 'active',
      createdAt: Date.now()
    })
  )
  const token = `integration-${linkedinId}-token`
  await t.run(async ctx => ctx.db.insert('sessions', { token, userId, expiresAt: Date.now() + 60_000 }))
  return { userId, token }
}

async function digestAudits(t: T) {
  return t.run(async ctx =>
    (await ctx.db.query('auditLogs').collect()).filter(a => a.action === 'digest_preference_changed')
  )
}

describe('users.getEmailPreferences', () => {
  test('absent fields read as the defaults: digest on, appears in rankings', async () => {
    const t = convexTest(schema, modules)
    const { token } = await seedUser(t, 'li-digest-defaults')

    const prefs = await t.query(api.users.getEmailPreferences, { sessionToken: token })
    expect(prefs).toEqual({ digestEmailsEnabled: true, leaderboardOptOut: false })
  })

  test('a bogus session token is refused', async () => {
    const t = convexTest(schema, modules)
    await expect(t.query(api.users.getEmailPreferences, { sessionToken: 'bogus-token' })).rejects.toThrow(
      /Unauthorized/
    )
  })
})

describe('users.setDigestEmailsEnabled', () => {
  test('setting the default value on an absent field is a no-op', async () => {
    const t = convexTest(schema, modules)
    const { token } = await seedUser(t, 'li-digest-noop')

    await t.mutation(api.users.setDigestEmailsEnabled, { sessionToken: token, enabled: true })
    expect(await digestAudits(t)).toHaveLength(0)
    expect((await t.query(api.users.getEmailPreferences, { sessionToken: token })).digestEmailsEnabled).toBe(true)
  })

  test('turning the digest off and on is idempotent and audited once per real change', async () => {
    const t = convexTest(schema, modules)
    const { token } = await seedUser(t, 'li-digest-toggle')

    await t.mutation(api.users.setDigestEmailsEnabled, { sessionToken: token, enabled: false })
    expect((await t.query(api.users.getEmailPreferences, { sessionToken: token })).digestEmailsEnabled).toBe(false)
    let audits = await digestAudits(t)
    expect(audits).toHaveLength(1)
    expect(audits[0].metadata).toBe(JSON.stringify({ enabled: false }))

    // Repeat of the same value: no new audit row.
    await t.mutation(api.users.setDigestEmailsEnabled, { sessionToken: token, enabled: false })
    audits = await digestAudits(t)
    expect(audits).toHaveLength(1)

    // Turning it back on is a real change: a second row.
    await t.mutation(api.users.setDigestEmailsEnabled, { sessionToken: token, enabled: true })
    expect((await t.query(api.users.getEmailPreferences, { sessionToken: token })).digestEmailsEnabled).toBe(true)
    audits = await digestAudits(t)
    expect(audits).toHaveLength(2)

    // Repeat of the new value: still two rows.
    await t.mutation(api.users.setDigestEmailsEnabled, { sessionToken: token, enabled: true })
    audits = await digestAudits(t)
    expect(audits).toHaveLength(2)
  })

  test('a bogus session token is refused and writes nothing', async () => {
    const t = convexTest(schema, modules)
    await expect(
      t.mutation(api.users.setDigestEmailsEnabled, { sessionToken: 'bogus-token', enabled: false })
    ).rejects.toThrow(/Unauthorized/)
    expect(await digestAudits(t)).toHaveLength(0)
  })
})
