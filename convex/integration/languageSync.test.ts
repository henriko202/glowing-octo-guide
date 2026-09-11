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

async function insertUser(t: T, linkedinId: string): Promise<Id<'users'>> {
  return t.run(async ctx =>
    ctx.db.insert('users', {
      linkedinId,
      name: 'Language User',
      subscriptionStatus: 'active',
      createdAt: Date.now()
    })
  )
}

describe('users.setLanguage', () => {
  test('a bogus session token is refused', async () => {
    const t = convexTest(schema, modules)
    await expect(t.mutation(api.users.setLanguage, { sessionToken: 'bogus-token', language: 'pt' })).rejects.toThrow(
      /Unauthorized/
    )
  })

  test('a valid token persists the language, and a repeat call leaves it unchanged', async () => {
    const t = convexTest(schema, modules)
    const userId = await insertUser(t, 'li-language')
    const token = 'integration-language-token'
    await t.run(async ctx => ctx.db.insert('sessions', { token, userId, expiresAt: Date.now() + 60_000 }))

    await t.mutation(api.users.setLanguage, { sessionToken: token, language: 'pt' })
    const first = await t.run(async ctx => (await ctx.db.get(userId))?.language)
    expect(first).toBe('pt')

    // Idempotent: the second call short-circuits on the equal value.
    await t.mutation(api.users.setLanguage, { sessionToken: token, language: 'pt' })
    const second = await t.run(async ctx => (await ctx.db.get(userId))?.language)
    expect(second).toBe(first)
  })

  test('an unsupported language is rejected by the validator before the handler runs', async () => {
    const t = convexTest(schema, modules)
    const userId = await insertUser(t, 'li-language-invalid')
    const token = 'integration-invalid-language-token'
    await t.run(async ctx => ctx.db.insert('sessions', { token, userId, expiresAt: Date.now() + 60_000 }))

    const call = t.mutation as unknown as (fn: typeof api.users.setLanguage, args: unknown) => Promise<unknown>
    await expect(call(api.users.setLanguage, { sessionToken: token, language: 'fr' })).rejects.toThrow(
      /Validator error/
    )

    // Nothing was written: the rejection happened before the handler ran.
    const language = await t.run(async ctx => (await ctx.db.get(userId))?.language)
    expect(language).toBeFalsy()
  })
})
