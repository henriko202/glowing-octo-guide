// convex/http.ts
import { httpAction } from './_generated/server'
import { httpRouter } from 'convex/server'
import { components, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { registerRoutes } from '@convex-dev/stripe'
import { buildAuthUrl, exchangeCodeForTokens, fetchLinkedInUserInfo } from './linkedin/oauth.js'
import { getTierFromPriceId } from './lib/stripePrices'
import { scrubError } from './lib/scrubError'
import { isInviteCode } from './lib/invite'
import { isFeaturedPostCheckout } from './lib/featuredPurchase'

const http = httpRouter()

// ─── LinkedIn OAuth ──────────────────────────────────────────────────────────

http.route({
  path: '/auth/linkedin',
  method: 'GET',
  handler: httpAction(async (ctx, req) => {
    const state = crypto.randomUUID()

    // Carry the user's chosen plan/interval through the OAuth round-trip.
    // Validate against the known-good sets to prevent tampering.
    const reqUrl = new URL(req.url)
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

    // Persist state server-side before redirecting — validated on callback (CSRF protection).
    await ctx.runMutation(internal.sessions.createOAuthState, { state, plan, interval, ref })
    const url = buildAuthUrl(state)
    return new Response(null, { status: 302, headers: { Location: url } })
  })
})

http.route({
  path: '/auth/linkedin/callback',
  method: 'GET',
  handler: httpAction(async (ctx, req) => {
    const appUrl = process.env.APP_URL ?? 'http://localhost:5173'

    try {
      const url = new URL(req.url)
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      if (error) {
        console.error('LinkedIn OAuth error param:', error, url.searchParams.get('error_description'))
        return new Response(null, {
          status: 302,
          headers: { Location: `${appUrl}/?error=oauth_denied` }
        })
      }

      if (!code) {
        console.error('LinkedIn callback: missing code parameter')
        return new Response(null, {
          status: 302,
          headers: { Location: `${appUrl}/?error=oauth_failed` }
        })
      }

      // CSRF: validate the state parameter against the value we stored on initiation.
      // If missing, expired, or unknown — reject the callback to prevent account takeover.
      const state = url.searchParams.get('state')
      if (!state) {
        console.error('LinkedIn callback: missing state parameter')
        return new Response(null, { status: 302, headers: { Location: `${appUrl}/?error=oauth_failed` } })
      }
      const oauthState = await ctx.runMutation(internal.sessions.validateAndConsumeOAuthState, { state })
      if (!oauthState.valid) {
        console.error('LinkedIn callback: invalid or expired state parameter — possible CSRF attempt')
        return new Response(null, { status: 302, headers: { Location: `${appUrl}/?error=oauth_failed` } })
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

      // Issue a cryptographically random session token — never expose the raw userId.
      // The client stores this token; all protected functions resolve it server-side. The 15-day
      // sliding TTL is owned by sessions.create (see SESSION_TTL_MS).
      const sessionToken = crypto.randomUUID()
      await ctx.runMutation(internal.sessions.create, {
        token: sessionToken,
        userId: userId as Id<'users'>
      })

      // Append plan/interval to the success redirect when they were carried through OAuth.
      let successUrl = `${appUrl}/auth/success#session=${sessionToken}`
      if (oauthState.plan !== undefined) successUrl += `&plan=${oauthState.plan}`
      if (oauthState.interval !== undefined) successUrl += `&interval=${oauthState.interval}`

      return new Response(null, {
        status: 302,
        headers: { Location: successUrl }
      })
    } catch (err) {
      // Log the real error server-side; send only a generic message to the client
      // to prevent leaking internal details (API responses, stack traces, etc.)
      console.error('OAuth callback error:', scrubError(err))
      return new Response(null, {
        status: 302,
        headers: { Location: `${appUrl}/?error=auth_failed` }
      })
    }
  })
})

// ─── Stripe Webhooks (via @convex-dev/stripe component) ─────────────────────
// The component auto-syncs customers, subscriptions, payments, and invoices.
// Custom handlers below keep our app's users + subscriptions tables in sync.
// getTierFromPriceId is imported from ./lib/stripePrices (single source of truth).

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Stripe event types vary by SDK version
type StripeEvent = any

// Stripe's `created` of the EVENT itself (ms): the ordering stamp behind subscriptions.lastEventAt.
const eventCreatedMs = (event: StripeEvent) => (typeof event.created === 'number' ? event.created * 1000 : undefined)

// syncUserSubscription's args for a subscription event — shared by created + updated.
function syncArgs(event: StripeEvent) {
  const sub = event.data.object
  const price = sub.items?.data?.[0]?.price
  return {
    stripeCustomerId: String(sub.customer),
    stripeSubscriptionId: sub.id,
    tier: getTierFromPriceId(price?.id ?? ''),
    status: sub.status,
    currentPeriodEnd: sub.current_period_end ? sub.current_period_end * 1000 : undefined,
    trialEndsAt: sub.trial_end ? sub.trial_end * 1000 : undefined,
    // Price snapshot so a billing email can state the exact amount without a second Stripe call.
    priceAmount: typeof price?.unit_amount === 'number' ? price.unit_amount : undefined,
    priceCurrency: price?.currency ?? undefined,
    priceInterval: price?.recurring?.interval ?? undefined,
    cancelAtPeriodEnd: sub.cancel_at_period_end === true,
    // Stripe's own creation instant: the duplicate guard voids the newest by this, not by arrival.
    stripeCreated: typeof sub.created === 'number' ? sub.created * 1000 : undefined,
    eventCreated: eventCreatedMs(event)
  }
}

registerRoutes(http, components.stripe, {
  webhookPath: '/stripe/webhook',
  events: {
    'customer.subscription.created': async (ctx: StripeEvent, event: StripeEvent) => {
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
    'customer.subscription.updated': async (ctx: StripeEvent, event: StripeEvent) => {
      await ctx.runMutation(internal.stripe.syncUserSubscription, syncArgs(event))
    },
    'customer.subscription.deleted': async (ctx: StripeEvent, event: StripeEvent) => {
      const sub = event.data.object
      await ctx.runMutation(internal.stripe.cancelUserSubscription, {
        stripeSubscriptionId: sub.id
      })
    },
    // Stripe fires this 3 days before trial_end. It NEVER fires for the 50-interaction path
    // (endTrialEarly sets trial_end:'now'), which is why that path has its own 40-of-50 notice.
    // Stripe's built-in trial-ending email must stay OFF so the member gets exactly one warning.
    'customer.subscription.trial_will_end': async (ctx: StripeEvent, event: StripeEvent) => {
      const sub = event.data.object
      if (!sub.trial_end) return
      await ctx.scheduler.runAfter(0, internal.notifications.sendTrialEnding, {
        stripeSubscriptionId: sub.id,
        trialEndsAt: sub.trial_end * 1000
      })
    },
    'invoice.payment_failed': async (ctx: StripeEvent, event: StripeEvent) => {
      const invoice = event.data.object
      if (invoice.subscription && invoice.customer) {
        await ctx.runMutation(internal.stripe.markPastDue, {
          stripeCustomerId: String(invoice.customer),
          stripeSubscriptionId: String(invoice.subscription),
          eventCreated: eventCreatedMs(event)
        })
      }
    },
    // backlog/R17 — the one-time featured-post purchase. Subscription checkouts complete through
    // this event too; the pure filter lets only a PAID payment-mode session tagged by
    // purchaseFeaturedPost through. postId travels as a plain string and is normalised inside the
    // mutation: a malformed id must log and return, never throw (Stripe retries a 500 for days).
    'checkout.session.completed': async (ctx: StripeEvent, event: StripeEvent) => {
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
  onEvent: async (_ctx: StripeEvent, event: StripeEvent) => {
    // event.type/event.id are safe identifiers, but route through the scrub helper anyway so this
    // seam stays PII-safe if a future edit logs more of the event object.
    console.log('[Stripe webhook]', scrubError({ type: event.type, id: event.id }))
  }
})

export default http
