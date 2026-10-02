/// <reference types="vite/client" />
import type { TestConvex } from 'convex-test'
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { internal } from '../_generated/api'
import schema from '../schema'
import { pkceChallengeFromVerifier } from '../lib/pkce'

// What the sign-in callback does with a request that is not LinkedIn's answer to this browser's own sign-in.
// LinkedIn is configured and answering in every test, so the callback's own checks are all that stands between a
// forged request and an account.
const modules = import.meta.glob('../**/*.ts')
type T = TestConvex<typeof schema>
const APP_URL = 'https://app.test'
const NEVER_ISSUED = '11111111-2222-4333-8444-555555555555'

// Every request the backend sent to LinkedIn.
let linkedIn: string[]

beforeEach(() => {
  vi.stubEnv('APP_URL', APP_URL)
  vi.stubEnv('LINKEDIN_CLIENT_ID', 'client')
  vi.stubEnv('LINKEDIN_CLIENT_SECRET', 'secret')
  vi.stubEnv('LINKEDIN_REDIRECT_URI', 'https://convex.test/auth/linkedin/callback')
  linkedIn = []
  vi.stubGlobal('fetch', async (url: string | URL | Request) => {
    const href = url instanceof Request ? url.url : String(url)
    linkedIn.push(href)
    const body = href.endsWith('/oauth/v2/accessToken')
      ? { access_token: 'access', expires_in: 3600 }
      : { sub: 'li-member', name: 'Ana Lima' }
    return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
  })
  // Every refusal logs on purpose; keep the test output readable.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function startSignIn(t: T) {
  const state = crypto.randomUUID()
  const nonce = crypto.randomUUID()
  const challenge = await pkceChallengeFromVerifier('v'.repeat(43))
  await t.mutation(internal.sessions.createOAuthState, { state, browserNonce: nonce, challenge })
  return { state, cookie: `oauth_nonce_${state}=${nonce}` }
}

function callback(t: T, query: string, cookie?: string) {
  return t.fetch(`/auth/linkedin/callback?${query}`, cookie ? { headers: { cookie } } : undefined)
}

// What a sign-in leaves behind: an account, a login code for the app to redeem, then a session.
function written(t: T) {
  return t.run(async ctx => ({
    users: (await ctx.db.query('users').collect()).length,
    authCodes: (await ctx.db.query('authCodes').collect()).length,
    sessions: (await ctx.db.query('sessions').collect()).length
  }))
}

type Issued = Awaited<ReturnType<typeof startSignIn>>
type Forged = { query: string; cookie?: string; cause: string }

// Each one starts from a sign-in that some browser really began, and sends a callback that is not its answer.
const FORGED: Array<[string, (issued: Issued) => Forged]> = [
  ['a callback with no code', ({ state, cookie }) => ({ query: `state=${state}`, cookie, cause: 'missing_code' })],
  ['a callback with no state', () => ({ query: 'code=forged', cause: 'bad_state' })],
  [
    'a made-up state and cookie',
    () => ({
      query: `code=forged&state=${NEVER_ISSUED}`,
      cookie: `oauth_nonce_${NEVER_ISSUED}=made-up`,
      cause: 'state_rejected'
    })
  ],
  [
    "another browser's state without its cookie",
    ({ state }) => ({ query: `code=forged&state=${state}`, cause: 'lost_cookie' })
  ],
  [
    "another browser's state with a guessed cookie",
    ({ state }) => ({
      query: `code=forged&state=${state}`,
      cookie: `oauth_nonce_${state}=guessed`,
      cause: 'state_rejected'
    })
  ]
]

describe('LinkedIn callback: forged and replayed requests', () => {
  test.each(FORGED)('%s is refused before LinkedIn is asked anything', async (_name, forge) => {
    const t = convexTest(schema, modules)
    const { query, cookie, cause } = forge(await startSignIn(t))

    const response = await callback(t, query, cookie)

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(`${APP_URL}/auth/error?reason=failed&cause=${cause}`)
    expect(linkedIn).toEqual([])
    expect(await written(t)).toEqual({ users: 0, authCodes: 0, sessions: 0 })
  })

  test('a state that is not one of our UUIDs never reaches a Set-Cookie header', async () => {
    const t = convexTest(schema, modules)

    const response = await callback(t, `code=forged&state=${encodeURIComponent('x; Domain=evil.example')}`)

    expect(response.headers.get('Location')).toBe(`${APP_URL}/auth/error?reason=failed&cause=bad_state`)
    expect(response.headers.get('Set-Cookie')).toBeNull()
  })

  test('a callback URL works once: sent again with its cookie, it is refused', async () => {
    const t = convexTest(schema, modules)
    const { state, cookie } = await startSignIn(t)

    const first = await callback(t, `code=li-code&state=${state}`, cookie)
    const replay = await callback(t, `code=li-code&state=${state}`, cookie)

    expect(first.headers.get('Location')).toContain(`${APP_URL}/auth/success#code=`)
    expect(replay.headers.get('Location')).toBe(`${APP_URL}/auth/error?reason=failed&cause=state_rejected`)
    expect(linkedIn.filter(href => href.endsWith('/oauth/v2/accessToken'))).toHaveLength(1)
    expect(await written(t)).toEqual({ users: 1, authCodes: 1, sessions: 0 })
  })
})
