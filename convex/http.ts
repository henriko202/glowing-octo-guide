// convex/http.ts
import type { ActionCtx } from './_generated/server'
import { env, httpAction } from './_generated/server'
import { httpRouter } from 'convex/server'
import { ConvexError } from 'convex/values'
import { components, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import type Stripe from 'stripe'
import { registerRoutes } from '@convex-dev/stripe'
import { buildAuthUrl, exchangeCodeForTokens, fetchLinkedInUserInfo } from './linkedin/oauth.js'
import { eventCreatedMs, invoiceSubscriptionId, syncArgs } from './stripe'
import { scrubError } from './lib/scrubError'
import { isInviteCode } from './lib/invite'
import { isFeaturedPostCheckout } from './lib/featuredPurchase'
import { readCookie } from './lib/cookies'
import { isPkceChallenge } from './lib/pkce'
import { verifyUnsubscribeToken } from './lib/unsubscribeToken'
import { landingVisitorKey } from './lib/landingVisitorKey'
import { isLandingEventName, landingVisitorSecret } from './landingMetrics'

const http = httpRouter()

const NO_STORE = { 'Cache-Control': 'no-store', Pragma: 'no-cache' } as const

// The OAuth browser-nonce cookie is namespaced per `state`: a single fixed name lets a second login
// overwrite the first's nonce, so concurrent logins in one browser would clobber each other.
function nonceCookieName(state: string): string {
  return `oauth_nonce_${state}`
}

function setNonceCookie(state: string, nonce: string): string {
  return `${nonceCookieName(state)}=${nonce}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
}

// States are always UUIDs minted here by crypto.randomUUID() — pin the shape so an
// attacker-supplied query value can never name a cookie we did not set (nor reach Set-Cookie).
const OAUTH_STATE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function clearNonceCookie(state: string): string {
  return `${nonceCookieName(state)}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}

function redirect(location: string, extraHeaders: Record<string, string> = {}): Response {
  return new Response(null, { status: 302, headers: { Location: location, ...NO_STORE, ...extraHeaders } })
}

// ─── LinkedIn OAuth ──────────────────────────────────────────────────────────

http.route({
  path: '/auth/linkedin',
  method: 'GET',
  handler: httpAction(async (ctx, req) => {
    const state = crypto.randomUUID()
    const browserNonce = crypto.randomUUID()

    // Carry the user's chosen plan/interval through the OAuth round-trip.
    // Validate against the known-good sets to prevent tampering.
    const reqUrl = new URL(req.url)
    // PKCE-style binding: every login must present the SHA-256 challenge of a verifier that stays in
    // the initiating browser. A direct hit without a valid challenge is not a login flow.
    const vc = reqUrl.searchParams.get('vc')
    if (!vc || !isPkceChallenge(vc)) {
      return new Response('Invalid login request.', { status: 400, headers: NO_STORE })
    }
    const rawPlan = reqUrl.searchParams.get('plan') ?? undefined
    const rawInterval = reqUrl.searchParams.get('interval') ?? undefined
    const VALID_PLANS = new Set(['starter', 'growth', 'pro'])
    const VALID_INTERVALS = new Set(['monthly', 'annual'])
    const plan = rawPlan !== undefined && VALID_PLANS.has(rawPlan) ? rawPlan : undefined
    const interval = rawInterval !== undefined && VALID_INTERVALS.has(rawInterval) ? rawInterval : undefined
    // backlog/R19 — the inviter's code from the landing's ?ref=. Shape-checked here; whether it
    // belongs to a member is checked at upsert, where an unknown code is dropped.
    const rawRef = reqUrl.searchParams.get('ref')
    const ref = isInviteCode(rawRef) ? rawRef : undefined

    // x-forwarded-for is best-effort/untrusted — a caller can omit or forge it — so the global
    // backstop, not the per-client limit, is what actually bounds oauthStates growth; the
    // per-client dimension just blunts a single-source flood.
    const clientKey = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined
    await ctx.runMutation(internal.lib.rateLimit.checkOAuthStartBudget, { clientKey })

    // Persist state server-side before redirecting — validated on callback (CSRF protection).
    // The PKCE challenge rides along so the callback can bind the login code to this browser.
    await ctx.runMutation(internal.sessions.createOAuthState, {
      state,
      browserNonce,
      challenge: vc,
      plan,
      interval,
      ref
    })
    return redirect(buildAuthUrl(state), { 'Set-Cookie': setNonceCookie(state, browserNonce) })
  })
})

http.route({
  path: '/auth/linkedin/callback',
  method: 'GET',
  handler: httpAction(async (ctx, req) => {
    const appUrl = env.APP_URL ?? 'http://localhost:5173'
    // The nonce cookie is namespaced per state, so every callback exit clears the same cookie name.
    // State is read up front; the UUID guard keeps an attacker-supplied query value out of the
    // Set-Cookie header and out of the cookie lookup.
    let state: string | null = null
    const clearNonce = (): Record<string, string> =>
      state !== null && OAUTH_STATE_RE.test(state) ? { 'Set-Cookie': clearNonceCookie(state) } : {}

    try {
      const url = new URL(req.url)
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')
      state = url.searchParams.get('state')

      if (error) {
        // Log the error code only. `scrubError` redacts by key name and `error_description` is
        // caller-influenced free text, so the description is deliberately not logged.
        console.error('LinkedIn OAuth error param:', scrubError({ error }))
        return redirect(`${appUrl}/?error=oauth_denied`, clearNonce())
      }

      if (!code) {
        console.error('LinkedIn callback: missing code parameter')
        return redirect(`${appUrl}/?error=oauth_failed`, clearNonce())
      }

      // CSRF: validate the state parameter against the value we stored on initiation, and require
      // the HttpOnly browser nonce cookie set there — so a captured callback URL cannot log the
      // victim's browser into the attacker's account. If either is missing/expired/unknown — reject.
      if (!state || !OAUTH_STATE_RE.test(state)) {
        console.error('LinkedIn callback: missing state parameter')
        return redirect(`${appUrl}/?error=oauth_failed`, clearNonce())
      }
      const nonce = readCookie(req.headers.get('cookie'), nonceCookieName(state))
      if (!nonce) {
        console.error('LinkedIn callback: invalid or expired state parameter — possible CSRF attempt')
        return redirect(`${appUrl}/?error=oauth_failed`, clearNonce())
      }
      const oauthState = await ctx.runMutation(internal.sessions.validateAndConsumeOAuthState, {
        state,
        browserNonce: nonce
      })
      if (!oauthState.valid) {
        console.error('LinkedIn callback: invalid or expired state parameter — possible CSRF attempt')
        return redirect(`${appUrl}/?error=oauth_failed`, clearNonce())
      }

      const tokens = await exchangeCodeForTokens(code)
      const userInfo = await fetchLinkedInUserInfo(tokens.access_token)

      const tokenExpiresAt = Date.now() + tokens.expires_in * 1000

      // Note: linkedinPublicIdentifier (vanityName) is NOT in the OIDC userinfo response — LinkedIn's
      // identity/vanity endpoints require Partner/MDP access we don't have. It is derived later,
      // set-once, from the author.url of a name-verified submitted post (posts.submitPost →
      // users.setDerivedPublicIdentifier). Ownership itself matches userInfo.name ↔ the post author name.
      const userId = await ctx.runMutation(internal.linkedin.auth.upsertUser, {
        linkedinId: userInfo.sub,
        name: userInfo.name,
        headline: undefined, // OIDC userinfo doesn't include headline
        profilePictureUrl: userInfo.picture,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt,
        email: userInfo.email,
        referredByCode: oauthState.ref
      })

      // Mint a single-use, 2-minute login code bound to the initiating browser's PKCE challenge.
      // The session token is NOT created here and never travels in a URL: the SPA redeems this code
      // over the Convex transport by presenting the verifier (sessions.redeemAuthCode).
      const authCode = crypto.randomUUID()
      await ctx.runMutation(internal.sessions.createAuthCode, {
        code: authCode,
        userId: userId as Id<'users'>,
        challenge: oauthState.challenge,
        plan: oauthState.plan,
        interval: oauthState.interval
      })

      // Append plan/interval to the success redirect when they were carried through OAuth.
      let successUrl = `${appUrl}/auth/success#code=${authCode}`
      if (oauthState.plan !== undefined) successUrl += `&plan=${oauthState.plan}`
      if (oauthState.interval !== undefined) successUrl += `&interval=${oauthState.interval}`

      return redirect(successUrl, clearNonce())
    } catch (err) {
      // Log the real error server-side; send only a generic message to the client
      // to prevent leaking internal details (API responses, stack traces, etc.)
      console.error('OAuth callback error:', scrubError(err))
      return redirect(`${appUrl}/?error=auth_failed`, clearNonce())
    }
  })
})

// R24 — one-click unsubscribe for the 3-day digest. Stateless signed token, works without a session, idempotent.
// POST is the acting path (the RFC 8058 List-Unsubscribe-Post target) and redirects to /unsubscribe on the app.
// GET changes nothing: mail scanners and chat unfurlers prefetch links, so a GET just forwards the token to the
// app's public confirmation page, which calls users.unsubscribeByToken — invalid/unavailable tokens are handled
// there, so this redirect never has to know whether the token is good.
http.route({
  path: '/unsubscribe/digest',
  method: 'GET',
  handler: httpAction(async (_ctx, req) => {
    const token = new URL(req.url).searchParams.get('token') ?? ''
    const appUrl = env.APP_URL ?? 'http://localhost:5173'
    return redirect(`${appUrl}/unsubscribe?token=${encodeURIComponent(token)}`)
  })
})

http.route({
  path: '/unsubscribe/digest',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const token = new URL(req.url).searchParams.get('token') ?? ''
    return handleUnsubscribe(ctx, token)
  })
})

async function handleUnsubscribe(ctx: ActionCtx, token: string): Promise<Response> {
  const appUrl = env.APP_URL ?? 'http://localhost:5173'
  const secret = env.UNSUBSCRIBE_SECRET
  if (!secret) return redirect(`${appUrl}/unsubscribe?status=unavailable`)
  const userId = await verifyUnsubscribeToken(token, secret)
  if (!userId) return redirect(`${appUrl}/unsubscribe?status=invalid`)
  await ctx.runMutation(internal.jobs.digest.disableDigestByUserId, { userId: userId as Id<'users'> })
  return redirect(`${appUrl}/unsubscribe?status=ok`)
}

// ─── Landing funnel beacon ───────────────────────────────────────────────────
// Cookieless, first-party: the landing POSTs `{"event":"<name>"}` as text/plain (a CORS-safelisted
// content type, so no preflight) with keepalive. The only visitor-derived value stored is a
// daily-rotated HMAC of IP+UA (`landingVisitors`, deleted within 48h); no cookie and no client-side
// identifier ever exists. The UA never leaves this handler, and the raw IP only reaches the
// rate-limit mutation, which stores just its bucket.
http.route({
  path: '/landing/event',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const headers = { ...NO_STORE, 'Access-Control-Allow-Origin': '*' }
    const body: unknown = await req.json().catch(() => null)
    const event = typeof body === 'object' && body !== null ? (body as { event?: unknown }).event : undefined
    if (!isLandingEventName(event)) {
      return new Response(null, { status: 400, headers })
    }

    // x-forwarded-for is best-effort/untrusted (same as the OAuth route): it only feeds the
    // per-client dimension, while the global budget bounds the table's growth. The same first hop
    // is the IP half of the visitor key.
    const clientKey = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined
    try {
      await ctx.runMutation(internal.lib.rateLimit.checkLandingEventBudget, { clientKey })
      const secret = landingVisitorSecret()
      const visitorKey =
        secret && clientKey
          ? await landingVisitorKey(
              secret,
              new Date().toISOString().slice(0, 10),
              clientKey,
              req.headers.get('user-agent') ?? ''
            )
          : undefined
      await ctx.runMutation(internal.landingMetrics.recordLandingEvent, { event, visitorKey })
    } catch (err) {
      // Fire-and-forget by contract: the beacon never surfaces an error to the visitor. A budget
      // rejection is routine; anything else means the counter is silently not moving, so log it.
      if (!(err instanceof ConvexError)) console.error('Landing event beacon failed:', scrubError(err))
    }
    return new Response(null, { status: 204, headers })
  })
})

// ─── Stripe Webhooks (via @convex-dev/stripe component) ─────────────────────
// The component auto-syncs customers, subscriptions, payments, and invoices.
// Custom handlers below keep our app's users + subscriptions tables in sync.
// `syncArgs` (payload → syncUserSubscription's args) lives in ./stripe so it can be unit-tested:
// this file registers its routes at module scope and cannot be imported by a test.

// `Stripe.Event` is the SDK's discriminated union of every webhook payload. Each handler is typed
// to the exact event its key registers; `onEvent` sees the whole union. `ctx` stays unannotated so
// the component's own `GenericActionCtx<GenericDataModel>` types it (the generated `ActionCtx` is
// stricter than the component's callback signature accepts).
type StripeEvent = Stripe.Event

registerRoutes(http, components.stripe, {
  webhookPath: '/stripe/webhook',
  events: {
    'customer.subscription.created': async (ctx, event: Stripe.CustomerSubscriptionCreatedEvent) => {
      // Two tabs, two checkouts: the checkout guard cannot see a second checkout completed between
      // session creation and Stripe confirming payment. syncUserSubscription decides, inside its own
      // transaction, whether this member now holds a duplicate and which row is the newer one. Only
      // `created` acts on it — Stripe emits `updated` for the duplicate right after, and acting there
      // too would void (and notify) twice.
      const duplicate = await ctx.runMutation(internal.stripe.syncUserSubscription, syncArgs(event))
      if (duplicate) {
        await ctx.scheduler.runAfter(0, internal.billingNode.cancelDuplicateSubscription, {
          userId: duplicate.userId,
          stripeSubscriptionId: duplicate.stripeSubscriptionId,
          tier: duplicate.keepTier
        })
      }
    },
    'customer.subscription.updated': async (ctx, event: Stripe.CustomerSubscriptionUpdatedEvent) => {
      await ctx.runMutation(internal.stripe.syncUserSubscription, syncArgs(event))
    },
    'customer.subscription.deleted': async (ctx, event: Stripe.CustomerSubscriptionDeletedEvent) => {
      const sub = event.data.object
      await ctx.runMutation(internal.stripe.cancelUserSubscription, {
        stripeSubscriptionId: sub.id
      })
    },
    // Stripe fires this 3 days before trial_end. It NEVER fires for the 50-interaction path
    // (endTrialEarly sets trial_end:'now'), which is why that path has its own 40-of-50 notice.
    // Stripe's built-in trial-ending email must stay OFF so the member gets exactly one warning.
    'customer.subscription.trial_will_end': async (ctx, event: Stripe.CustomerSubscriptionTrialWillEndEvent) => {
      const sub = event.data.object
      if (!sub.trial_end) return
      await ctx.scheduler.runAfter(0, internal.billingNotices.sendTrialEnding, {
        stripeSubscriptionId: sub.id,
        trialEndsAt: sub.trial_end * 1000
      })
    },
    'invoice.payment_failed': async (ctx, event: Stripe.InvoicePaymentFailedEvent) => {
      const invoice = event.data.object
      const subscriptionId = invoiceSubscriptionId(invoice)
      if (subscriptionId && invoice.customer) {
        await ctx.runMutation(internal.stripe.markPastDue, {
          stripeCustomerId: String(invoice.customer),
          stripeSubscriptionId: subscriptionId,
          eventCreated: eventCreatedMs(event)
        })
      }
    },
    // backlog/R17 — the one-time featured-post purchase. Subscription checkouts complete through
    // this event too; the pure filter lets only a PAID payment-mode session tagged by
    // purchaseFeaturedPost through. postId travels as a plain string and is normalised inside the
    // mutation: a malformed id must log and return, never throw (Stripe retries a 500 for days).
    'checkout.session.completed': async (ctx, event: Stripe.CheckoutSessionCompletedEvent) => {
      const session = event.data.object
      if (!isFeaturedPostCheckout(session)) return
      await ctx.runMutation(internal.posts.applyPurchasedFeature, {
        postId: String(session.metadata?.postId ?? ''),
        checkoutSessionId: String(session.id),
        amountCents: typeof session.amount_total === 'number' ? session.amount_total : 0,
        paidAt: eventCreatedMs(event) ?? Date.now()
      })
    }
  },
  onEvent: async (_ctx, event: StripeEvent) => {
    // event.type/event.id are safe identifiers, but route through the scrub helper anyway so this
    // seam stays PII-safe if a future edit logs more of the event object.
    console.log('[Stripe webhook]', scrubError({ type: event.type, id: event.id }))
  }
})

export default http
