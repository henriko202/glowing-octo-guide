// convex/http.ts
import type { ActionCtx } from './_generated/server'
import { env, httpAction } from './_generated/server'
import { type GenericActionCtx, type GenericDataModel, httpRouter } from 'convex/server'
import { ConvexError } from 'convex/values'
import { components, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import type Stripe from 'stripe'
import { registerRoutes, type StripeEventHandlers } from '@convex-dev/stripe'
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
import type { OAuthFailureReason } from './lib/authMetrics'
import { reportError, reportingThrows, type SentryTags } from './lib/sentry'

const http = httpRouter()

const NO_STORE = { 'Cache-Control': 'no-store', Pragma: 'no-cache' } as const

function routeTags(req: Request): { route: string } {
  return { route: `${req.method} ${new URL(req.url).pathname}` }
}

// Every route's handler: an error that escapes it reaches Sentry (lib/sentry.ts), then Convex answers the 500 it
// always has. The two handlers that catch their own errors report them where they catch.
function reportingHttpAction(handler: (ctx: ActionCtx, req: Request) => Promise<Response>) {
  return httpAction(reportingThrows(routeTags, handler))
}

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

// Sign-in funnel counters (convex/authMetrics.ts) are best effort: a failed write is logged and never changes where
// the member lands. A failure before LinkedIn confirmed the member names its state, so it counts once per attempt
// we issued; `error` follows a consumed state, which happens once per attempt.
async function countSignInFailure(
  ctx: ActionCtx,
  state: string | null,
  reason: OAuthFailureReason | 'error'
): Promise<void> {
  try {
    if (reason === 'error') await ctx.runMutation(internal.authMetrics.recordOAuthError, {})
    else if (state !== null && OAUTH_STATE_RE.test(state)) {
      await ctx.runMutation(internal.authMetrics.recordOAuthFailure, { state, reason })
    }
  } catch (err) {
    console.error('Sign-in metric write failed:', scrubError(err))
  }
}

// ─── LinkedIn OAuth ──────────────────────────────────────────────────────────

http.route({
  path: '/auth/linkedin',
  method: 'GET',
  handler: reportingHttpAction(async (ctx, req) => {
    const state = crypto.randomUUID()
    const browserNonce = crypto.randomUUID()

    // Carry the user's chosen plan/interval through the OAuth round-trip.
    // Validate against the known-good sets to prevent tampering.
    const reqUrl = new URL(req.url)
    // PKCE-style binding: every login must present the SHA-256 challenge of a verifier that stays in
    // the initiating browser. A direct hit without a valid challenge is not a login flow.
    const vc = reqUrl.searchParams.get('vc')
    if (!vc || !isPkceChallenge(vc)) {
      console.error('LinkedIn sign-in start: missing or malformed challenge')
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
  handler: reportingHttpAction(async (ctx, req) => {
    const appUrl = env.APP_URL ?? 'http://localhost:5173'
    // The nonce cookie is namespaced per state, so every callback exit clears the same cookie name.
    // State is read up front; the UUID guard keeps an attacker-supplied query value out of the
    // Set-Cookie header and out of the cookie lookup.
    let state: string | null = null
    const clearNonce = (): Record<string, string> =>
      state !== null && OAUTH_STATE_RE.test(state) ? { 'Set-Cookie': clearNonceCookie(state) } : {}
    // Every failure lands on the app's /auth/error page. It sits outside RequireAuth, which would restart the
    // sign-in on its own and loop a member who just canceled back to LinkedIn. `cause` names the exit taken; the page
    // never shows it, it reports it to Sentry (AuthErrorPage) so a failed sign-in can be told apart from the next.
    const failedUrl = (cause: string) => `${appUrl}/auth/error?reason=failed&cause=${cause}`
    // Set once the state is consumed: only then does a thrown error count as `error` in the funnel.
    let consumed = false

    try {
      const url = new URL(req.url)
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')
      state = url.searchParams.get('state')

      if (error) {
        // Log the error code only. `scrubError` redacts by key name and `error_description` is
        // caller-influenced free text, so the description is deliberately not logged.
        console.error('LinkedIn OAuth error param:', scrubError({ error }))
        // Only these two codes mean the member said no. Any other error (a scope LinkedIn stopped granting, a
        // malformed request) fails every sign-in, so it must not hide among the cancels.
        const canceled = error === 'user_cancelled_login' || error === 'user_cancelled_authorize'
        await countSignInFailure(ctx, state, canceled ? 'denied' : 'linkedin_error')
        // LinkedIn's code rides along for the Sentry report. Anyone can send this query value, so only an
        // OAuth-style token is passed on (AuthErrorPage checks the same shape again).
        const linkedinError = /^[a-z_]{1,32}$/.test(error) ? `&linkedin_error=${error}` : ''
        return redirect(
          canceled ? `${appUrl}/auth/error?reason=denied` : failedUrl('linkedin_error') + linkedinError,
          clearNonce()
        )
      }

      if (!code) {
        console.error('LinkedIn callback: missing code parameter')
        await countSignInFailure(ctx, state, 'rejected')
        return redirect(failedUrl('missing_code'), clearNonce())
      }

      // CSRF: validate the state parameter against the value we stored on initiation, and require
      // the HttpOnly browser nonce cookie set there — so a captured callback URL cannot log the
      // victim's browser into the attacker's account. If either is missing/expired/unknown — reject.
      if (!state || !OAUTH_STATE_RE.test(state)) {
        console.error('LinkedIn callback: missing state parameter')
        return redirect(failedUrl('bad_state'), clearNonce())
      }
      const nonce = readCookie(req.headers.get('cookie'), nonceCookieName(state))
      if (!nonce) {
        console.error('LinkedIn callback: no browser nonce cookie for this state')
        await countSignInFailure(ctx, state, 'lost_cookie')
        return redirect(failedUrl('lost_cookie'), clearNonce())
      }
      const oauthState = await ctx.runMutation(internal.sessions.validateAndConsumeOAuthState, {
        state,
        browserNonce: nonce
      })
      if (!oauthState.valid) {
        console.error('LinkedIn callback: invalid or expired state parameter — possible CSRF attempt')
        await countSignInFailure(ctx, state, 'rejected')
        return redirect(failedUrl('state_rejected'), clearNonce())
      }
      consumed = true

      const tokens = await exchangeCodeForTokens(code)
      const userInfo = await fetchLinkedInUserInfo(tokens.access_token)

      const tokenExpiresAt = Date.now() + tokens.expires_in * 1000

      // Note: linkedinPublicIdentifier (vanityName) is NOT in the OIDC userinfo response — LinkedIn's
      // identity/vanity endpoints require Partner/MDP access we don't have. It is derived later,
      // set-once, from the author.url of a name-verified submitted post (posts.submitPost →
      // users.setDerivedPublicIdentifier). Ownership itself matches userInfo.name ↔ the post author name.
      const { userId, isNew } = await ctx.runMutation(internal.linkedin.auth.upsertUser, {
        linkedinId: userInfo.sub,
        name: userInfo.name,
        headline: undefined, // OIDC userinfo doesn't include headline
        profilePictureUrl: userInfo.picture,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt,
        email: userInfo.email,
        // Strict: the validator takes a boolean, and anything but a literal `true` must not claim an account.
        emailVerified: userInfo.email_verified === true,
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
        interval: oauthState.interval,
        isNew
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
      await reportError(ctx, err, routeTags(req))
      if (consumed) await countSignInFailure(ctx, state, 'error')
      return redirect(failedUrl('callback_error'), clearNonce())
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
  handler: reportingHttpAction(async (_ctx, req) => {
    const token = new URL(req.url).searchParams.get('token') ?? ''
    const appUrl = env.APP_URL ?? 'http://localhost:5173'
    return redirect(`${appUrl}/unsubscribe?token=${encodeURIComponent(token)}`)
  })
})

http.route({
  path: '/unsubscribe/digest',
  method: 'POST',
  handler: reportingHttpAction(async (ctx, req) => {
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
  handler: reportingHttpAction(async (ctx, req) => {
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
      // rejection is routine; anything else means the counter is silently not moving, so log and report it.
      if (!(err instanceof ConvexError)) {
        console.error('Landing event beacon failed:', scrubError(err))
        await reportError(ctx, err, routeTags(req))
      }
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

function stripeTags(event: StripeEvent): SentryTags {
  return { route: 'POST /stripe/webhook', stripe_event: event.type, stripe_event_id: event.id }
}

// One handler's shape, loosened to fit all of them: an event parameter of type `never` accepts any event type.
type StripeHandler = (ctx: GenericActionCtx<GenericDataModel>, event: never) => Promise<void>

// Wraps every event handler in reportingThrows: an error one throws reaches Sentry with the event's id (to resend it
// from Stripe's dashboard once fixed), then the component answers Stripe with the 500 that makes Stripe retry.
function reportingHandlers(handlers: StripeEventHandlers): StripeEventHandlers {
  const entries = Object.entries(handlers as Record<string, StripeHandler>)
  return Object.fromEntries(entries.map(([type, handler]) => [type, reportingThrows(stripeTags, handler)]))
}

registerRoutes(http, components.stripe, {
  webhookPath: '/stripe/webhook',
  events: reportingHandlers({
    // Two tabs, two checkouts: the checkout guard cannot see a second checkout completed between
    // session creation and Stripe confirming payment. syncUserSubscription voids the newer one itself,
    // inside its own transaction, on whichever of these events makes it live (PLATFORM §8).
    'customer.subscription.created': async (ctx, event: Stripe.CustomerSubscriptionCreatedEvent) => {
      await ctx.runMutation(internal.stripe.syncUserSubscription, syncArgs(event))
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
  }),
  onEvent: async (_ctx, event: StripeEvent) => {
    // event.type/event.id are safe identifiers, but route through the scrub helper anyway so this
    // seam stays PII-safe if a future edit logs more of the event object.
    console.log('[Stripe webhook]', scrubError({ type: event.type, id: event.id }))
  }
})

export default http
