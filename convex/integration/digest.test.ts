/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test, vi } from 'vitest'
import { internal } from '../_generated/api'
import type { TestConvex } from 'convex-test'
import type { Id } from '../_generated/dataModel'
import schema from '../schema'

// Existing digest tests rely on the real provider behavior (unconfigured → skipped, no stamp). Only the two
// addressed below are intercepted: one address throws like a Resend non-OK, the other reports a successful send.
vi.mock('../lib/email', async importOriginal => {
  const actual = await importOriginal<typeof import('../lib/email')>()
  return {
    ...actual,
    sendEmail: vi.fn(async (args: Parameters<typeof actual.sendEmail>[0]) => {
      if (args.to === 'fails@example.com') throw new Error('provider down')
      if (args.to === 'ok@example.com') return { sent: true }
      return actual.sendEmail(args)
    })
  }
})

const modules = import.meta.glob('../**/*.ts')
type T = TestConvex<typeof schema>

const NOW = Date.now()
const DAY = 86_400_000

async function seedUser(
  t: T,
  linkedinId: string,
  name: string,
  extra: { email?: string; digestEmailsEnabled?: boolean; lastDigestAt?: number } = {}
): Promise<Id<'users'>> {
  return await t.run(async ctx =>
    ctx.db.insert('users', {
      linkedinId,
      name,
      subscriptionStatus: 'none',
      createdAt: NOW,
      ...extra
    })
  )
}

async function seedPost(t: T, authorId: Id<'users'>): Promise<Id<'posts'>> {
  return await t.run(async ctx =>
    ctx.db.insert('posts', {
      linkedinPostUrn: `urn:${crypto.randomUUID()}`,
      authorId,
      content: 'x',
      publishedAt: NOW,
      likeCount: 0,
      commentCount: 0,
      mediaUrls: [],
      isFeatured: false,
      visibilityIndustries: [],
      visibilityCountries: [],
      hidden: false
    })
  )
}

async function seedInteraction(
  t: T,
  userId: Id<'users'>,
  authorId: Id<'users'>,
  postId: Id<'posts'>,
  kind: 'reaction' | 'comment'
): Promise<void> {
  await t.run(async ctx => ctx.db.insert('userInteractions', { userId, postId, authorId, kind, createdAt: NOW }))
}

describe('jobs.digest.getDigestData', () => {
  test('counts the personal window and reads site tops with position and movement', async () => {
    const t = convexTest(schema, modules)
    const me = await seedUser(t, 'li-me', 'Me', { lastDigestAt: NOW - 4 * DAY })
    const ana = await seedUser(t, 'li-ana', 'Ana')
    const bruno = await seedUser(t, 'li-bruno', 'Bruno')
    const dave = await seedUser(t, 'li-dave', 'Dave')
    const myPost = await seedPost(t, me)
    const anaPost = await seedPost(t, ana)
    const brunoPost = await seedPost(t, bruno)

    await seedInteraction(t, ana, me, myPost, 'reaction')
    await seedInteraction(t, ana, me, myPost, 'comment')
    await seedInteraction(t, bruno, me, myPost, 'comment')
    await seedInteraction(t, me, ana, anaPost, 'reaction')
    await seedInteraction(t, me, ana, anaPost, 'comment')
    await seedInteraction(t, me, bruno, brunoPost, 'reaction')

    await t.run(async ctx => {
      await ctx.db.insert('rankingSnapshots', {
        window: '7d',
        generatedAt: NOW - 5 * DAY,
        since: NOW - 12 * DAY,
        topPosters: [
          { userId: bruno, count: 6, lastAt: NOW - 5 * DAY },
          { userId: ana, count: 2, lastAt: NOW - 6 * DAY },
          { userId: me, count: 1, lastAt: NOW - 7 * DAY }
        ],
        topInteractors: [
          { userId: bruno, count: 6, lastAt: NOW - 5 * DAY },
          { userId: ana, count: 2, lastAt: NOW - 6 * DAY },
          { userId: me, count: 1, lastAt: NOW - 7 * DAY }
        ],
        posterCountsDescending: [6, 2, 1],
        interactorCountsDescending: [6, 2, 1],
        partial: false
      })
      await ctx.db.insert('rankingSnapshots', {
        window: '7d',
        generatedAt: NOW,
        since: NOW - 7 * DAY,
        topPosters: [
          { userId: ana, count: 4, lastAt: NOW },
          { userId: me, count: 3, lastAt: NOW },
          { userId: bruno, count: 2, lastAt: NOW },
          { userId: dave, count: 1, lastAt: NOW }
        ],
        topInteractors: [
          { userId: ana, count: 5, lastAt: NOW },
          { userId: me, count: 3, lastAt: NOW },
          { userId: bruno, count: 2, lastAt: NOW },
          { userId: dave, count: 1, lastAt: NOW }
        ],
        posterCountsDescending: [4, 3, 2, 1],
        interactorCountsDescending: [5, 3, 2, 1],
        partial: false
      })
    })

    const data = await t.query(internal.jobs.digest.getDigestData, {
      userId: me,
      lastDigestAt: NOW - 4 * DAY,
      now: NOW
    })

    expect(data.since).toBe(NOW - 3 * DAY)
    expect(data.received).toEqual({ reactions: 1, comments: 2 })
    expect(data.made).toEqual({ reactions: 2, comments: 1 })
    expect(data.topReceived.map(e => [e.userId, e.count])).toEqual([
      [ana, 2],
      [bruno, 1]
    ])
    expect(data.topMade.map(e => [e.userId, e.count])).toEqual([
      [ana, 2],
      [bruno, 1]
    ])
    expect(data.siteTopPosters.map(e => e.userId)).toEqual([ana, me, bruno])
    expect(data.siteTopInteractors.map(e => e.userId)).toEqual([ana, me, bruno])
    expect(data.myPosition).toBe(2)
    expect(data.movement).toBe(1)
  })

  test('drops banned and opted-out members from the site tops but keeps opted-out personal tallies', async () => {
    const t = convexTest(schema, modules)
    const me = await seedUser(t, 'li-me', 'Me')
    const banned = await seedUser(t, 'li-banned', 'Banned')
    const optedOut = await seedUser(t, 'li-opt', 'Opted Out')
    await t.run(async ctx => ctx.db.patch(banned, { isBanned: true }))
    await t.run(async ctx => ctx.db.patch(optedOut, { leaderboardOptOut: true }))
    const myPost = await seedPost(t, me)
    const bannedPost = await seedPost(t, banned)
    await seedPost(t, banned)
    await seedPost(t, banned)
    await seedPost(t, optedOut)
    await seedPost(t, optedOut)
    await seedInteraction(t, banned, me, myPost, 'reaction')
    await seedInteraction(t, banned, me, myPost, 'reaction')
    await seedInteraction(t, banned, me, myPost, 'comment')
    await seedInteraction(t, optedOut, me, myPost, 'comment')
    await seedInteraction(t, optedOut, me, myPost, 'comment')
    await seedInteraction(t, me, banned, bannedPost, 'reaction')

    await t.mutation(internal.jobs.rankingSnapshot.rebuildRankingSnapshots, { window: '7d' })

    const data = await t.query(internal.jobs.digest.getDigestData, { userId: me, now: NOW })

    expect(data.siteTopInteractors.map(e => e.userId)).toEqual([me])
    expect(data.siteTopPosters.map(e => e.userId)).toEqual([me])
    expect(data.topReceived.map(e => e.userId)).toEqual([optedOut])
    expect(data.topMade).toEqual([])
  })
})

describe('jobs.digest.getDisplayNames', () => {
  test('resolves the display name for each requested member', async () => {
    const t = convexTest(schema, modules)
    const ana = await seedUser(t, 'li-ana', 'Ana')
    const bruno = await seedUser(t, 'li-bruno', 'Bruno')

    const names = await t.query(internal.jobs.digest.getDisplayNames, { userIds: [ana, bruno] })

    expect(names).toEqual([
      { id: ana, name: 'Ana' },
      { id: bruno, name: 'Bruno' }
    ])
  })
})

describe('jobs.digest.disableDigestByUserId', () => {
  test('turns the flag off and audits once', async () => {
    const t = convexTest(schema, modules)
    const userId = await seedUser(t, 'li-off', 'Off', { digestEmailsEnabled: true })

    await t.mutation(internal.jobs.digest.disableDigestByUserId, { userId })

    const user = await t.run(async ctx => ctx.db.get(userId))
    expect(user?.digestEmailsEnabled).toBe(false)
    const audits = await t.run(async ctx =>
      (await ctx.db.query('auditLogs').collect()).filter(a => a.action === 'digest_unsubscribed_email')
    )
    expect(audits).toHaveLength(1)
    expect(audits[0]).toMatchObject({ actor: 'user', actorId: userId, targetUserId: userId })

    await t.mutation(internal.jobs.digest.disableDigestByUserId, { userId })
    const after = await t.run(async ctx =>
      (await ctx.db.query('auditLogs').collect()).filter(a => a.action === 'digest_unsubscribed_email')
    )
    expect(after).toHaveLength(1)
  })
})

describe('jobs.digest.getUsersPage', () => {
  test('paginates every member', async () => {
    const t = convexTest(schema, modules)
    await seedUser(t, 'li-1', 'One')
    await seedUser(t, 'li-2', 'Two')
    await seedUser(t, 'li-3', 'Three')

    const first = await t.query(internal.jobs.digest.getUsersPage, {
      paginationOpts: { numItems: 2, cursor: null }
    })
    expect(first.page.map(u => u.name)).toEqual(['One', 'Two'])
    expect(first.isDone).toBe(false)

    const second = await t.query(internal.jobs.digest.getUsersPage, {
      paginationOpts: { numItems: 2, cursor: first.continueCursor }
    })
    expect(second.page.map(u => u.name)).toEqual(['Three'])
    expect(second.isDone).toBe(true)
  })
})

describe('jobs.digest.getUserForSend', () => {
  test('returns the freshly unsubscribed doc so the mid-sweep guard can see it', async () => {
    const t = convexTest(schema, modules)
    const userId = await seedUser(t, 'li-race', 'Race', { email: 'race@example.com', digestEmailsEnabled: true })
    await t.run(async ctx => ctx.db.patch(userId, { digestEmailsEnabled: false }))

    const fresh = await t.query(internal.jobs.digest.getUserForSend, { userId })
    expect(fresh?.digestEmailsEnabled).toBe(false)

    process.env.UNSUBSCRIBE_SECRET = 'test-secret'
    process.env.CONVEX_SITE_URL = 'https://test.convex.site'
    try {
      await t.action(internal.jobs.digest.sendDueDigests, {})
    } finally {
      delete process.env.UNSUBSCRIBE_SECRET
      delete process.env.CONVEX_SITE_URL
    }

    const user = await t.run(async ctx => ctx.db.get(userId))
    expect(user?.lastDigestAt).toBeUndefined()
  })
})

describe('jobs.digest.sendDueDigests', () => {
  test('early-returns without stamping lastDigestAt when UNSUBSCRIBE_SECRET is unset', async () => {
    const t = convexTest(schema, modules)
    await seedUser(t, 'li-a', 'A', { email: 'a@example.com' })
    await seedUser(t, 'li-b', 'B', { email: 'b@example.com', digestEmailsEnabled: true })

    await t.action(internal.jobs.digest.sendDueDigests, {})

    const users = await t.run(async ctx => ctx.db.query('users').collect())
    expect(users).toHaveLength(2)
    expect(users.every(u => u.lastDigestAt === undefined)).toBe(true)
  })

  test('reaches the send path with the secret set and does not stamp when the provider is unconfigured', async () => {
    const t = convexTest(schema, modules)
    const me = await seedUser(t, 'li-send', 'Sender', { email: 'sender@example.com' })
    const ana = await seedUser(t, 'li-actor', 'Actor')
    const post = await seedPost(t, me)
    await seedInteraction(t, ana, me, post, 'comment')

    process.env.UNSUBSCRIBE_SECRET = 'test-secret'
    process.env.CONVEX_SITE_URL = 'https://test.convex.site'
    try {
      await t.action(internal.jobs.digest.sendDueDigests, {})
    } finally {
      delete process.env.UNSUBSCRIBE_SECRET
      delete process.env.CONVEX_SITE_URL
    }

    const user = await t.run(async ctx => ctx.db.get(me))
    expect(user?.lastDigestAt).toBeUndefined()
  })

  test('a failed send does not abort the sweep: later due members still get lastDigestAt stamped', async () => {
    const t = convexTest(schema, modules)
    const failing = await seedUser(t, 'li-fail', 'Failing', { email: 'fails@example.com' })
    const ok = await seedUser(t, 'li-ok', 'Okay', { email: 'ok@example.com' })
    const actor = await seedUser(t, 'li-actor2', 'Actor')
    await seedInteraction(t, actor, failing, await seedPost(t, failing), 'comment')
    await seedInteraction(t, actor, ok, await seedPost(t, ok), 'comment')

    process.env.UNSUBSCRIBE_SECRET = 'test-secret'
    process.env.CONVEX_SITE_URL = 'https://test.convex.site'
    try {
      await t.action(internal.jobs.digest.sendDueDigests, {})
    } finally {
      delete process.env.UNSUBSCRIBE_SECRET
      delete process.env.CONVEX_SITE_URL
    }

    const [failedUser, okUser] = await t.run(async ctx => [await ctx.db.get(failing), await ctx.db.get(ok)])
    expect(failedUser?.lastDigestAt).toBeUndefined()
    expect(okUser?.lastDigestAt).toBeDefined()
  })
})
