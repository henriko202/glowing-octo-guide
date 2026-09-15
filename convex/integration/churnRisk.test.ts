/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { api } from '../_generated/api'
import type { TestConvex } from 'convex-test'
import schema from '../schema'

const modules = import.meta.glob('../**/*.ts')
type T = TestConvex<typeof schema>

const NOW = Date.now()
const DAY = 86_400_000

async function seedUser(
  t: T,
  name: string,
  fields: { lastLoginAt?: number; isBanned?: boolean; isAdmin?: boolean; deletionScheduledAt?: number } = {}
) {
  return await t.run(async ctx =>
    ctx.db.insert('users', {
      linkedinId: `li-${name}`,
      name,
      subscriptionStatus: 'none',
      createdAt: NOW - 90 * DAY,
      ...fields
    })
  )
}

async function seedPost(
  t: T,
  authorId: Awaited<ReturnType<typeof seedUser>>,
  fields: { publishedAt: number; hidden?: boolean; deletedAt?: number }
) {
  return await t.run(async ctx =>
    ctx.db.insert('posts', {
      linkedinPostUrn: `urn:${crypto.randomUUID()}`,
      authorId,
      content: 'x',
      publishedAt: fields.publishedAt,
      likeCount: 0,
      commentCount: 0,
      mediaUrls: [],
      isFeatured: false,
      visibilityIndustries: [],
      visibilityCountries: [],
      hidden: fields.hidden ?? false,
      deletedAt: fields.deletedAt
    })
  )
}

async function seedInteraction(
  t: T,
  userId: Awaited<ReturnType<typeof seedUser>>,
  authorId: Awaited<ReturnType<typeof seedUser>> | undefined,
  postId: Awaited<ReturnType<typeof seedPost>>,
  at: number,
  kind: 'reaction' | 'comment' | 'ai_draft' = 'reaction'
) {
  return await t.run(async ctx =>
    ctx.db.insert('userInteractions', {
      userId,
      postId,
      ...(authorId !== undefined ? { authorId } : {}),
      kind,
      createdAt: at
    })
  )
}

describe('admin.getChurnRisk', () => {
  beforeEach(() => {
    // convex-test stamps `_creationTime` from Date.now(), so the fake clock both orders the seeds
    // and defines the 7d/30d windows the query computes.
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('flags each reason with the right hook and orders by severity', async () => {
    const t = convexTest(schema, modules)

    // Seed in ascending fake time: convex-test never stamps a row earlier than the previous one.
    vi.setSystemTime(NOW - 45 * DAY)
    const admin = await seedUser(t, 'Admin', { isAdmin: true })
    const sam = await seedUser(t, 'Sam', { lastLoginAt: NOW - DAY })
    const rita = await seedUser(t, 'Rita')
    const cleo = await seedUser(t, 'Cleo')
    const hana = await seedUser(t, 'Hana', { lastLoginAt: NOW - DAY })
    const ana = await seedUser(t, 'Ana')
    const bruno = await seedUser(t, 'Bruno')
    await seedUser(t, 'Banned', { lastLoginAt: NOW - DAY, isBanned: true })
    await seedUser(t, 'Leaving', { lastLoginAt: NOW - DAY, deletionScheduledAt: NOW + DAY })

    const hanaOldPost = await seedPost(t, hana, { publishedAt: NOW - 45 * DAY })
    const anaPost = await seedPost(t, ana, { publishedAt: NOW - 45 * DAY })
    const samPost = await seedPost(t, sam, { publishedAt: NOW - 45 * DAY })
    await seedInteraction(t, sam, hana, hanaOldPost, NOW - 45 * DAY)

    // Cleo: 8 own interactions 20 days ago, none in the last 7 days → cooling.
    vi.setSystemTime(NOW - 20 * DAY)
    await seedPost(t, cleo, { publishedAt: NOW - 20 * DAY })
    for (let i = 0; i < 8; i += 1) await seedInteraction(t, cleo, hana, hanaOldPost, NOW - 20 * DAY)

    // An ai_draft is not engagement: Sam still counts as silent with his last real interaction 45d ago.
    vi.setSystemTime(NOW - 3 * DAY)
    await seedInteraction(t, sam, undefined, samPost, NOW - 3 * DAY, 'ai_draft')

    // Rita: still no own interactions, but two people reacted to her post 2 days ago.
    vi.setSystemTime(NOW - 2 * DAY)
    const ritaPost = await seedPost(t, rita, { publishedAt: NOW - 2 * DAY })
    await seedPost(t, rita, { publishedAt: NOW - DAY, hidden: true })
    await seedInteraction(t, ana, rita, ritaPost, NOW - 2 * DAY)
    await seedInteraction(t, bruno, rita, ritaPost, NOW - 2 * DAY)

    // Hana: healthy — 5 made and 3 received inside the week, no reason fires.
    vi.setSystemTime(NOW - DAY)
    const hanaNewPost = await seedPost(t, hana, { publishedAt: NOW - DAY })
    for (let i = 0; i < 5; i += 1) await seedInteraction(t, hana, ana, anaPost, NOW - DAY)
    for (let i = 0; i < 3; i += 1) await seedInteraction(t, ana, hana, hanaNewPost, NOW - DAY)

    vi.setSystemTime(NOW)
    await t.run(async ctx => ctx.db.insert('sessions', { token: 'admin', userId: admin, expiresAt: NOW + DAY }))

    const rows = await t.query(api.admin.getChurnRisk, { sessionToken: 'admin' })

    expect(rows.map(r => r.name)).toEqual(['Rita', 'Sam', 'Cleo'])
    expect(rows[0]).toMatchObject({
      made7d: 0,
      made30d: 0,
      received7d: 2,
      reasons: ['received_no_reply'],
      hook: '2 interactions on your post, no reply',
      // The newest post is hidden, so recency falls back to the visible one.
      lastPostAt: NOW - 2 * DAY
    })
    expect(rows[1]).toMatchObject({
      made7d: 0,
      made30d: 0,
      received7d: 0,
      lastInteractionAt: NOW - 45 * DAY,
      reasons: ['silent_7d'],
      hook: 'no interactions since 45 days ago'
    })
    expect(rows[2]).toMatchObject({
      made7d: 0,
      made30d: 8,
      received7d: 0,
      reasons: ['cooling'],
      hook: '0 interactions this week, down from 8 in 30 days'
    })
  })

  test('rejects a non-admin', async () => {
    const t = convexTest(schema, modules)
    const mallory = await seedUser(t, 'Mallory')
    await t.run(async ctx => ctx.db.insert('sessions', { token: 'tok', userId: mallory, expiresAt: NOW + DAY }))

    await expect(t.query(api.admin.getChurnRisk, { sessionToken: 'tok' })).rejects.toThrow(/admin/i)
  })

  test('returns an empty list when nobody needs attention', async () => {
    const t = convexTest(schema, modules)
    const admin = await seedUser(t, 'Admin', { isAdmin: true })
    await t.run(async ctx => ctx.db.insert('sessions', { token: 'admin', userId: admin, expiresAt: NOW + DAY }))

    expect(await t.query(api.admin.getChurnRisk, { sessionToken: 'admin' })).toEqual([])
  })
})
