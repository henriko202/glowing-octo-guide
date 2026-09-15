/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { api } from '../_generated/api'
import type { TestConvex } from 'convex-test'
import type { Id } from '../_generated/dataModel'
import schema from '../schema'
import { sendEmail } from '../lib/email'

// Every dev email path is forced through the shared sendEmail; the mock records the exact message
// and never reaches Resend. The real provider behavior is covered by lib/email.test.ts.
vi.mock('../lib/email', async importOriginal => {
  const actual = await importOriginal<typeof import('../lib/email')>()
  return {
    ...actual,
    sendEmail: vi.fn(async () => ({ sent: true }))
  }
})

const modules = import.meta.glob('../**/*.ts')
type T = TestConvex<typeof schema>

const NOW = Date.now()

const EMAIL_KINDS = [
  'digest',
  'digest_sample',
  'trial_near_end',
  'trial_converted',
  'post_cap',
  'duplicate_canceled'
] as const

// Hermetic env: the gate, the unsubscriber secret, the URLs and the provider keys all start unset
// and the ambient values are restored afterwards (undefined == was not set).
const AMBIENT_ENV_KEYS = [
  'ALLOW_DEV_IMPERSONATION',
  'UNSUBSCRIBE_SECRET',
  'APP_URL',
  'CONVEX_SITE_URL',
  'RESEND_API_KEY',
  'EMAIL_FROM'
]
const savedEnv: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const key of AMBIENT_ENV_KEYS) {
    savedEnv[key] = process.env[key]
    delete process.env[key]
  }
  vi.mocked(sendEmail).mockClear()
})

afterEach(() => {
  for (const key of AMBIENT_ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key]
    else process.env[key] = savedEnv[key]
  }
})

async function seedUser(t: T, extra: { email?: string } = {}): Promise<Id<'users'>> {
  return await t.run(async ctx =>
    ctx.db.insert('users', {
      linkedinId: `li-${crypto.randomUUID()}`,
      name: 'Dev Tester',
      subscriptionStatus: 'none',
      createdAt: NOW,
      ...extra
    })
  )
}

async function seedSession(t: T, userId: Id<'users'>, token = 'tok'): Promise<void> {
  await t.run(async ctx => ctx.db.insert('sessions', { token, userId, expiresAt: Date.now() + 60_000 }))
}

function enableDevTools(): void {
  process.env.ALLOW_DEV_IMPERSONATION = 'true'
  process.env.UNSUBSCRIBE_SECRET = 'test-secret'
  process.env.APP_URL = 'https://app.example'
  process.env.CONVEX_SITE_URL = 'https://test.convex.site'
}

describe('dev email tools gating', () => {
  test('every email entry point throws without the flag, before touching the database', async () => {
    const t = convexTest(schema, modules)
    for (const kind of EMAIL_KINDS) {
      await expect(t.action(api.dev.sendTestEmail, { kind })).rejects.toThrow(/Dev impersonation is disabled/)
    }
    await expect(t.action(api.dev.getUnsubscribeLink, {})).rejects.toThrow(/Dev impersonation is disabled/)
  })

  test('every email entry point throws without a session even with the flag on', async () => {
    process.env.ALLOW_DEV_IMPERSONATION = 'true'
    const t = convexTest(schema, modules)
    for (const kind of EMAIL_KINDS) {
      await expect(t.action(api.dev.sendTestEmail, { kind })).rejects.toThrow(/Unauthorized/)
    }
    await expect(t.action(api.dev.getUnsubscribeLink, {})).rejects.toThrow(/Unauthorized/)
  })
})

describe('dev.getUnsubscribeLink', () => {
  test('returns the member signed unsubscribe URL without sending anything', async () => {
    enableDevTools()
    const t = convexTest(schema, modules)
    const userId = await seedUser(t, { email: 'member@example.com' })
    await seedSession(t, userId)

    const { url } = await t.action(api.dev.getUnsubscribeLink, { sessionToken: 'tok' })

    expect(url).toContain('https://app.example/unsubscribe?token=')
    expect(sendEmail).not.toHaveBeenCalled()
  })
})

describe('dev.sendTestEmail', () => {
  test('digest_sample renders with the fallback subject and goes to the member email', async () => {
    enableDevTools()
    const t = convexTest(schema, modules)
    const userId = await seedUser(t, { email: 'member@example.com' })
    await seedSession(t, userId)

    const result = await t.action(api.dev.sendTestEmail, { sessionToken: 'tok', kind: 'digest_sample' })

    expect(result).toEqual({ status: 'sent' })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    const args = vi.mocked(sendEmail).mock.calls[0][0]
    expect(args.to).toBe('member@example.com')
    expect(args.subject).toBe('Activity summary')
    expect(args.html).toContain('/unsubscribe?token=')
  })

  test('digest sends the real composition for an empty window, bypassing isDigestDue and never stamping', async () => {
    enableDevTools()
    const t = convexTest(schema, modules)
    const userId = await seedUser(t, { email: 'member@example.com' })
    await seedSession(t, userId)

    const result = await t.action(api.dev.sendTestEmail, { sessionToken: 'tok', kind: 'digest' })

    expect(result).toEqual({ status: 'sent' })
    const args = vi.mocked(sendEmail).mock.calls[0][0]
    expect(args.subject).toBe('Activity summary')
    expect(args.headers?.['List-Unsubscribe']).toMatch(
      /^<https:\/\/test\.convex\.site\/unsubscribe\/digest\?token=[^>]+>$/
    )
    const user = await t.run(async ctx => ctx.db.get(userId))
    expect(user?.lastDigestAt).toBeUndefined()
  })

  test('reports no_email when the member has no address and no override is given', async () => {
    enableDevTools()
    const t = convexTest(schema, modules)
    const userId = await seedUser(t)
    await seedSession(t, userId)

    const result = await t.action(api.dev.sendTestEmail, { sessionToken: 'tok', kind: 'digest_sample' })

    expect(result).toEqual({ status: 'no_email' })
    expect(sendEmail).not.toHaveBeenCalled()
  })
})
