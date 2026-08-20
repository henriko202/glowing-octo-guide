// convex/http.ts
import { httpAction } from './_generated/server'
import { httpRouter } from 'convex/server'
import { components, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { registerRoutes } from '@convex-dev/stripe'
import { buildAuthUrl, exchangeCodeForTokens, fetchLinkedInUserInfo } from './linkedin/oauth.js'
import { getTierFromPriceId } from './lib/stripePrices'

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

    // Persist state server-side before redirecting — validated on callback (CSRF protection).
    await ctx.runMutation(internal.sessions.createOAuthState, { state, plan, interval })
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
        emailVerified: userInfo.email_verified
      })

      // Issue a cryptographically random session token — never expose the raw userId.
      // The client stores this token; all protected functions resolve it server-side.
      const sessionToken = crypto.randomUUID()
      await ctx.runMutation(internal.sessions.create, {
        token: sessionToken,
        userId: userId as Id<'users'>,
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
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
      console.error('OAuth callback error:', err instanceof Error ? err.message : String(err), err)
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

registerRoutes(http, components.stripe, {
  webhookPath: '/stripe/webhook',
  events: {
    'customer.subscription.created': async (ctx: StripeEvent, event: StripeEvent) => {
      const sub = event.data.object
      const priceId = sub.items?.data?.[0]?.price?.id ?? ''
      await ctx.runMutation(internal.stripe.syncUserSubscription, {
        stripeCustomerId: String(sub.customer),
        stripeSubscriptionId: sub.id,
        tier: getTierFromPriceId(priceId),
        status: sub.status,
        currentPeriodEnd: sub.current_period_end ? sub.current_period_end * 1000 : undefined
      })
    },
    'customer.subscription.updated': async (ctx: StripeEvent, event: StripeEvent) => {
      const sub = event.data.object
      const priceId = sub.items?.data?.[0]?.price?.id ?? ''
      await ctx.runMutation(internal.stripe.syncUserSubscription, {
        stripeCustomerId: String(sub.customer),
        stripeSubscriptionId: sub.id,
        tier: getTierFromPriceId(priceId),
        status: sub.status,
        currentPeriodEnd: sub.current_period_end ? sub.current_period_end * 1000 : undefined
      })
    },
    'customer.subscription.deleted': async (ctx: StripeEvent, event: StripeEvent) => {
      const sub = event.data.object
      await ctx.runMutation(internal.stripe.cancelUserSubscription, {
        stripeSubscriptionId: sub.id
      })
    },
    'invoice.payment_failed': async (ctx: StripeEvent, event: StripeEvent) => {
      const invoice = event.data.object
      if (invoice.subscription && invoice.customer) {
        await ctx.runMutation(internal.stripe.markPastDue, {
          stripeCustomerId: String(invoice.customer),
          stripeSubscriptionId: String(invoice.subscription)
        })
      }
    }
  },
  onEvent: async (_ctx: StripeEvent, event: StripeEvent) => {
    console.log('[Stripe webhook]', event.type, event.id)
  }
})

export default http
