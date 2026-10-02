/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { getFunctionName } from 'convex/server'
import Stripe from 'stripe'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { internal } from '../_generated/api'
import crons from '../crons'
import schema from '../schema'
import { pkceChallengeFromVerifier } from '../lib/pkce'
import { signUnsubscribeToken } from '../lib/unsubscribeToken'

const modules = import.meta.glob('../**/*.ts')
const reconcileMotd = getFunctionName(internal.motd.motd.reconcileMotdWindows)

// Every event the backend sends to Sentry, as the parsed event line of its envelope.
let sentryEvents: Array<Record<string, any>>

beforeEach(() => {
  vi.stubEnv('SENTRY_DSN', 'https://abc123@o1.ingest.us.sentry.io/456')
  sentryEvents = []
  vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) => {
    const href = url instanceof Request ? url.url : String(url)
    if (!href.startsWith('https://o1.ingest.us.sentry.io/')) throw new Error(`unexpected fetch: ${href}`)
    sentryEvents.push(JSON.parse(String(init?.body).split('\n')[2]))
    return new Response(null, { status: 200 })
  })
  // Every failure here logs on purpose; keep the test output readable.
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('sweep of failed scheduled runs', () => {
  test('every cron starts its job through runScheduled, so the sweep sees its failures', () => {
    const runScheduled = getFunctionName(internal.observability.runScheduled)
    const jobs = Object.entries(crons.crons)

    expect(jobs.length).toBeGreaterThan(0)
    for (const [name, job] of jobs) expect(`${name}: ${job.name}`).toBe(`${name}: ${runScheduled}`)
  })

  test('a cron job that fails is reported once, by the sweep that reads its half hour', async () => {
    vi.useFakeTimers()
    const t = convexTest(schema, modules)
    // The MOTD job takes no args, so an unexpected one fails it the way a real bug would.
    const runAt = async (iso: string, args: Record<string, unknown>) => {
      vi.setSystemTime(new Date(iso))
      await t.mutation(internal.observability.runScheduled, { fn: reconcileMotd, args })
    }
    await runAt('2026-09-25T10:05:00Z', { unexpected: true })
    await runAt('2026-09-25T10:10:00Z', {})
    await runAt('2026-09-25T10:35:00Z', { unexpected: true })
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const sweepAt = async (iso: string) => {
      vi.setSystemTime(new Date(iso))
      await t.action(internal.observability.reportFailedRuns, {})
    }
    await sweepAt('2026-09-25T10:30:04Z')
    expect(sentryEvents).toHaveLength(0)

    await sweepAt('2026-09-25T11:00:04Z')
    expect(sentryEvents).toHaveLength(1)
    expect(sentryEvents[0].transaction).toContain('reconcileMotdWindows')
    expect(sentryEvents[0].exception.values[0].type).toBe('ScheduledFunctionFailed')

    await sweepAt('2026-09-25T11:30:04Z')
    expect(sentryEvents).toHaveLength(2)
  })

  test('repeated failures of one job in a half hour are one event, with their count', async () => {
    vi.useFakeTimers()
    const t = convexTest(schema, modules)
    for (const iso of ['2026-09-25T10:05:00Z', '2026-09-25T10:10:00Z']) {
      vi.setSystemTime(new Date(iso))
      await t.mutation(internal.observability.runScheduled, { fn: reconcileMotd, args: { unexpected: true } })
    }
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    vi.setSystemTime(new Date('2026-09-25T11:00:04Z'))
    await t.action(internal.observability.reportFailedRuns, {})

    expect(sentryEvents).toHaveLength(1)
    expect(sentryEvents[0].tags['convex.failed_runs']).toBe('2')
  })

  test('sends nothing while SENTRY_DSN is unset', async () => {
    vi.useFakeTimers()
    vi.stubEnv('SENTRY_DSN', '')
    const t = convexTest(schema, modules)
    vi.setSystemTime(new Date('2026-09-25T10:05:00Z'))
    await t.mutation(internal.observability.runScheduled, { fn: reconcileMotd, args: { unexpected: true } })
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    vi.setSystemTime(new Date('2026-09-25T11:00:04Z'))
    await t.action(internal.observability.reportFailedRuns, {})

    expect(sentryEvents).toHaveLength(0)
  })
})

describe('HTTP routes', () => {
  test('a route that throws is reported with its route and still fails the request', async () => {
    vi.stubEnv('UNSUBSCRIBE_SECRET', 'unsubscribe-secret')
    const t = convexTest(schema, modules)
    // A valid signature over an id that is not a users id: the opt-out mutation rejects it.
    const token = await signUnsubscribeToken('not-a-user-id', 'unsubscribe-secret')

    // convex-test surfaces the re-thrown error; a deployment answers it with a 500.
    const unsubscribe = t.fetch(`/unsubscribe/digest?token=${encodeURIComponent(token)}`, { method: 'POST' })
    await expect(unsubscribe).rejects.toThrow('Expected ID for table "users"')

    expect(sentryEvents).toHaveLength(1)
    expect(sentryEvents[0].tags.route).toBe('POST /unsubscribe/digest')
  })

  test('a sign-in that fails after LinkedIn is reported and still lands on the error page', async () => {
    // No LINKEDIN_* variables: the token exchange throws once the state is consumed.
    for (const key of ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET', 'LINKEDIN_REDIRECT_URI']) {
      vi.stubEnv(key, undefined)
    }
    vi.stubEnv('APP_URL', 'https://app.test')
    const t = convexTest(schema, modules)
    const state = crypto.randomUUID()
    const nonce = crypto.randomUUID()
    const challenge = await pkceChallengeFromVerifier('v'.repeat(43))
    await t.mutation(internal.sessions.createOAuthState, { state, browserNonce: nonce, challenge })

    const response = await t.fetch(`/auth/linkedin/callback?code=li-code&state=${state}`, {
      headers: { cookie: `oauth_nonce_${state}=${nonce}` }
    })

    expect(response.headers.get('Location')).toBe('https://app.test/auth/error?reason=failed&cause=callback_error')
    expect(sentryEvents).toHaveLength(1)
    expect(sentryEvents[0].tags.route).toBe('GET /auth/linkedin/callback')
  })

  test('a Stripe handler that throws is reported, and Stripe still gets the 500 that makes it retry', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test')
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123')
    const t = convexTest(schema, modules)
    // The component ignores trial_will_end, so only our handler runs. A `$` field name is reserved in Convex values,
    // so scheduling the trial notice for this subscription id throws inside the handler.
    const payload = JSON.stringify({
      id: 'evt_1',
      object: 'event',
      type: 'customer.subscription.trial_will_end',
      created: 1,
      data: { object: { id: { $reserved: 1 }, trial_end: 2 } }
    })
    const signature = await new Stripe('sk_test_123').webhooks.generateTestHeaderStringAsync({
      payload,
      secret: 'whsec_test'
    })

    const response = await t.fetch('/stripe/webhook', {
      method: 'POST',
      body: payload,
      headers: { 'stripe-signature': signature }
    })

    expect(response.status).toBe(500)
    expect(sentryEvents).toHaveLength(1)
    expect(sentryEvents[0].tags).toMatchObject({ stripe_event: 'customer.subscription.trial_will_end' })
  })
})
