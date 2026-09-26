/// <reference types="vite/client" />
import type { TestConvex } from 'convex-test'
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { api, internal } from '../_generated/api'
import schema from '../schema'
import { pkceChallengeFromVerifier } from '../lib/pkce'

const modules = import.meta.glob('../**/*.ts')
type T = TestConvex<typeof schema>
const DAY = 86_400_000
const APP_URL = 'https://app.test'
const VERIFIER = 'v'.repeat(43)
const ENV_KEYS = ['APP_URL', 'LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET', 'LINKEDIN_REDIRECT_URI'] as const

let savedEnv: Record<string, string | undefined>

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]))
  for (const key of ENV_KEYS) delete process.env[key]
  process.env.APP_URL = APP_URL
  // Every failure path logs on purpose; keep the test output readable.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key]
    else process.env[key] = savedEnv[key]
  }
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// LinkedIn answers the token exchange and the userinfo call for one member.
function stubLinkedIn(sub: string) {
  process.env.LINKEDIN_CLIENT_ID = 'client'
  process.env.LINKEDIN_CLIENT_SECRET = 'secret'
  process.env.LINKEDIN_REDIRECT_URI = 'https://convex.test/auth/linkedin/callback'
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
  vi.stubGlobal('fetch', async (url: string | URL | Request) => {
    const href = url instanceof Request ? url.url : String(url)
    if (href.endsWith('/oauth/v2/accessToken')) return json({ access_token: 'access', expires_in: 3600 })
    if (href.endsWith('/v2/userinfo')) return json({ sub, name: 'Ana Lima', given_name: 'Ana', family_name: 'Lima' })
    throw new Error(`unexpected fetch: ${href}`)
  })
}

async function startSignIn(t: T) {
  const state = crypto.randomUUID()
  const nonce = crypto.randomUUID()
  const challenge = await pkceChallengeFromVerifier(VERIFIER)
  await t.mutation(internal.sessions.createOAuthState, { state, browserNonce: nonce, challenge })
  return { state, cookie: `oauth_nonce_${state}=${nonce}` }
}

function callback(t: T, query: string, cookie?: string) {
  return t.fetch(`/auth/linkedin/callback?${query}`, cookie ? { headers: { cookie } } : undefined)
}

function codeFrom(response: Response): string {
  const location = response.headers.get('Location') ?? ''
  expect(location.startsWith(`${APP_URL}/auth/success#code=`)).toBe(true)
  return new URLSearchParams(location.split('#')[1]).get('code') ?? ''
}

async function counts(t: T): Promise<Record<string, number>> {
  const rows = await t.run(async ctx => ctx.db.query('authMetrics').collect())
  return Object.fromEntries(rows.map(row => [row.event, row.count]))
}

describe('sign-in funnel counters', () => {
  test('a new member counts as sent, back from LinkedIn and signed in', async () => {
    const t = convexTest(schema, modules)
    stubLinkedIn('li-new')
    const { state, cookie } = await startSignIn(t)

    const code = codeFrom(await callback(t, `code=li-code&state=${state}`, cookie))
    await t.mutation(api.sessions.redeemAuthCode, { code, verifier: VERIFIER })

    expect(await counts(t)).toEqual({ started: 1, linkedin_ok_new: 1, signed_in_new: 1 })
  })

  test('a member who already has an account counts as returning at both steps', async () => {
    const t = convexTest(schema, modules)
    await t.run(async ctx =>
      ctx.db.insert('users', { linkedinId: 'li-back', name: 'Ana Lima', subscriptionStatus: 'none', createdAt: 1 })
    )
    stubLinkedIn('li-back')
    const { state, cookie } = await startSignIn(t)

    const code = codeFrom(await callback(t, `code=li-code&state=${state}`, cookie))
    await t.mutation(api.sessions.redeemAuthCode, { code, verifier: VERIFIER })

    expect(await counts(t)).toEqual({ started: 1, linkedin_ok_returning: 1, signed_in_returning: 1 })
  })

  test('a failed redeem counts nothing past LinkedIn', async () => {
    const t = convexTest(schema, modules)
    stubLinkedIn('li-new')
    const { state, cookie } = await startSignIn(t)
    const code = codeFrom(await callback(t, `code=li-code&state=${state}`, cookie))

    await expect(t.mutation(api.sessions.redeemAuthCode, { code, verifier: 'w'.repeat(43) })).rejects.toThrow()

    expect(await counts(t)).toEqual({ started: 1, linkedin_ok_new: 1 })
  })

  test('a sign-in canceled on LinkedIn lands on the error page and counts once, even when replayed', async () => {
    const t = convexTest(schema, modules)
    const { state } = await startSignIn(t)

    const first = await callback(t, `error=user_cancelled_login&state=${state}`)
    await callback(t, `error=user_cancelled_login&state=${state}`)

    expect(first.status).toBe(302)
    expect(first.headers.get('Location')).toBe(`${APP_URL}/auth/error?reason=denied`)
    expect(await counts(t)).toEqual({ started: 1, denied: 1 })
  })

  test('an error LinkedIn raises on its side is not counted as a cancel and shows the failed page', async () => {
    // Only the two user_cancelled_* codes mean the member said no; anything else (a scope LinkedIn stopped granting,
    // a malformed request) breaks every sign-in and must not hide among the cancels.
    const t = convexTest(schema, modules)
    const { state } = await startSignIn(t)

    const response = await callback(t, `error=unauthorized_scope_error&state=${state}`)

    expect(response.headers.get('Location')).toBe(`${APP_URL}/auth/error?reason=failed`)
    expect(await counts(t)).toEqual({ started: 1, linkedin_error: 1 })
  })

  test('a browser that comes back without the sign-in cookie counts a lost cookie', async () => {
    const t = convexTest(schema, modules)
    const { state } = await startSignIn(t)

    const response = await callback(t, `code=li-code&state=${state}`)

    expect(response.headers.get('Location')).toBe(`${APP_URL}/auth/error?reason=failed`)
    expect(await counts(t)).toEqual({ started: 1, lost_cookie: 1 })
  })

  test('a member who came back after the attempt expired counts a rejected callback, not a lost cookie', async () => {
    // The nonce cookie and the state row share the 10-minute lifetime, so a slow return has no cookie either.
    const t = convexTest(schema, modules)
    await startSignIn(t)
    const [row] = await t.run(async ctx => ctx.db.query('oauthStates').collect())
    await t.run(async ctx => ctx.db.patch(row._id, { expiresAt: Date.now() - 1 }))

    await callback(t, `code=li-code&state=${row.state}`)

    expect(await counts(t)).toEqual({ started: 1, rejected: 1 })
  })

  test('a mismatched browser cookie counts a rejected callback and keeps the state for the real browser', async () => {
    const t = convexTest(schema, modules)
    const { state } = await startSignIn(t)

    const response = await callback(t, `code=li-code&state=${state}`, `oauth_nonce_${state}=someone-else`)

    expect(response.headers.get('Location')).toBe(`${APP_URL}/auth/error?reason=failed`)
    expect(await counts(t)).toEqual({ started: 1, rejected: 1 })
    expect(await t.run(async ctx => ctx.db.query('oauthStates').collect())).toHaveLength(1)
  })

  test('a callback for a state that was never issued counts nothing', async () => {
    const t = convexTest(schema, modules)

    const response = await callback(t, `error=user_cancelled_login&state=${crypto.randomUUID()}`)

    expect(response.headers.get('Location')).toBe(`${APP_URL}/auth/error?reason=denied`)
    expect(await counts(t)).toEqual({})
  })

  test('a failure after LinkedIn confirmed the state counts an error and lands on the error page', async () => {
    // No LINKEDIN_* variables: the token exchange throws once the state is consumed.
    const t = convexTest(schema, modules)
    const { state, cookie } = await startSignIn(t)

    const response = await callback(t, `code=li-code&state=${state}`, cookie)

    expect(response.headers.get('Location')).toBe(`${APP_URL}/auth/error?reason=failed`)
    expect(await counts(t)).toEqual({ started: 1, error: 1 })
  })
})

describe('getMetrics', () => {
  async function seedSession(t: T, isAdmin: boolean) {
    const userId = await t.run(async ctx =>
      ctx.db.insert('users', {
        linkedinId: isAdmin ? 'admin' : 'member',
        name: isAdmin ? 'Admin' : 'Member',
        subscriptionStatus: 'none' as const,
        isAdmin,
        createdAt: Date.now()
      })
    )
    await t.run(async ctx => ctx.db.insert('sessions', { token: 'tok', userId, expiresAt: Date.now() + DAY }))
  }

  test('returns the window totals and every day for an admin', async () => {
    const t = convexTest(schema, modules)
    await seedSession(t, true)
    await startSignIn(t)
    const { state } = await startSignIn(t)
    await callback(t, `error=user_cancelled_login&state=${state}`)

    const metrics = await t.query(api.authMetrics.getMetrics, { sessionToken: 'tok', days: 7 })

    expect(metrics.totals.started).toBe(2)
    expect(metrics.totals.denied).toBe(1)
    expect(metrics.totals.signed_in_new).toBe(0)
    expect(metrics.daily).toHaveLength(7)
    expect(metrics.daily[0]).toMatchObject({ started: 2, failed: 1 })
  })

  test('rejects a non-admin session', async () => {
    const t = convexTest(schema, modules)
    await seedSession(t, false)
    await expect(t.query(api.authMetrics.getMetrics, { sessionToken: 'tok', days: 7 })).rejects.toThrow(
      'Forbidden: admin access required'
    )
  })
})
