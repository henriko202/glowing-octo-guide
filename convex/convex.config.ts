import { defineApp } from 'convex/server'
import { v } from 'convex/values'
import stripe from '@convex-dev/stripe/convex.config.js'
import rateLimiter from '@convex-dev/rate-limiter/convex.config.js'

const app = defineApp({
  env: {
    // Required in every deployment — a missing one must fail the deploy rather than surface as a
    // cryptic LinkedIn/Stripe error at runtime.
    LINKEDIN_CLIENT_ID: v.string(),
    LINKEDIN_CLIENT_SECRET: v.string(),
    LINKEDIN_REDIRECT_URI: v.string(),
    APP_URL: v.string(),
    STRIPE_SECRET_KEY: v.string(),

    // Optional — each read site has a documented runtime fallback (no-op / default).
    APIFY_API_TOKEN: v.optional(v.string()),
    APIFY_TASK_ID: v.optional(v.string()),
    APIFY_TASK_ID_PROFILE_SCRAPE: v.optional(v.string()),
    RESEND_API_KEY: v.optional(v.string()),
    EMAIL_FROM: v.optional(v.string()),
    FEEDBACK_REPLY_TO: v.optional(v.string()),
    OPENROUTER_API_KEY: v.optional(v.string()),
    OPENROUTER_MODEL: v.optional(v.string()),
    OPENROUTER_SITE_URL: v.optional(v.string()),
    OPENROUTER_SITE_NAME: v.optional(v.string()),
    STRIPE_FEATURED_POST_PRICE_ID: v.optional(v.string()),
    STRIPE_STARTER_PRICE_ID: v.optional(v.string()),
    STRIPE_GROWTH_PRICE_ID: v.optional(v.string()),
    STRIPE_PRO_PRICE_ID: v.optional(v.string()),
    STRIPE_STARTER_ANNUAL_PRICE_ID: v.optional(v.string()),
    STRIPE_GROWTH_ANNUAL_PRICE_ID: v.optional(v.string()),
    STRIPE_PRO_ANNUAL_PRICE_ID: v.optional(v.string()),
    ALLOW_ADMIN_SHARE_ANY_POST: v.optional(v.string()),
    ALLOW_DEV_IMPERSONATION: v.optional(v.string()),
    UNSUBSCRIBE_SECRET: v.optional(v.string())
  }
})
app.use(stripe)
app.use(rateLimiter)
export default app
