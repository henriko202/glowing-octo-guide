// convex/http.ts
import { httpActionGeneric as httpAction, httpRouter } from 'convex/server'
import { components, internal } from './_generated/api.js'
import { registerRoutes } from '@convex-dev/stripe'
import {
  buildAuthUrl,
  exchangeCodeForTokens,
  fetchLinkedInPublicIdentifier,
  fetchLinkedInUserInfo
} from './linkedin/oauth.js'

const http = httpRouter()

// ─── LinkedIn OAuth ──────────────────────────────────────────────────────────

http.route({
  path: '/auth/linkedin',
  method: 'GET',
  handler: httpAction(async (_ctx, _req) => {
    const state = crypto.randomUUID()
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

      const tokens = await exchangeCodeForTokens(code)
      // Run userInfo and publicIdentifier fetches concurrently — independent requests
      const [userInfo, publicIdentifier] = await Promise.all([
        fetchLinkedInUserInfo(tokens.access_token),
        fetchLinkedInPublicIdentifier(tokens.access_token)
      ])

      const tokenExpiresAt = Date.now() + tokens.expires_in * 1000

      const userId = await ctx.runMutation(internal.linkedin.auth.upsertUser, {
        linkedinId: userInfo.sub,
        name: userInfo.name,
        headline: undefined, // OIDC userinfo doesn't include headline
        profilePictureUrl: userInfo.picture,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt,
        // May be null if identityMe is unavailable — upsertUser handles null-safety
        linkedinPublicIdentifier: publicIdentifier ?? undefined
      })

      return new Response(null, {
        status: 302,
        headers: { Location: `${appUrl}/auth/success?userId=${userId}` }
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('OAuth callback error:', message, err)
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${appUrl}/?error=auth_failed&reason=${encodeURIComponent(message)}`
        }
      })
    }
  })
})

// ─── Stripe Webhooks (via @convex-dev/stripe component) ─────────────────────
// The component auto-syncs customers, subscriptions, payments, and invoices.
// Custom handlers below keep our app's users + subscriptions tables in sync.

function getTierFromPriceId(priceId: string): 'starter' | 'growth' | 'pro' {
  const map: Record<string, 'starter' | 'growth' | 'pro'> = {
    [process.env.STRIPE_STARTER_PRICE_ID ?? '']: 'starter',
    [process.env.STRIPE_GROWTH_PRICE_ID ?? '']: 'growth',
    [process.env.STRIPE_PRO_PRICE_ID ?? '']: 'pro'
  }
  return map[priceId] ?? 'starter'
}

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
