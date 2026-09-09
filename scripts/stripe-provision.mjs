// scripts/stripe-provision.mjs — recreate every Stripe object this app needs, in ONE environment.
//
//   node scripts/stripe-provision.mjs --check      encoder self-test, no key, no API calls
//   node scripts/stripe-provision.mjs              dev: key + site read from .env.local
//   node scripts/stripe-provision.mjs --key sk_test_… [--site https://<deployment>.convex.site]
//   node scripts/stripe-provision.mjs --key sk_live_…  --site https://<prod>.convex.site
//
// Creates: 3 plan products × 2 prices (monthly + annual), the one-time featured-post price, the
// webhook endpoint with exactly the six events convex/http.ts handles, and the Customer Portal
// configuration. Then writes the price ids into the three local .env files and prints the
// `npx convex env set` block for the deployment (the fourth copy — see docs/PLATFORM.md §8).
//
// CONVERGENT: every object is looked up by identity (product by name, price by amount+interval,
// webhook by url, portal by is_default) and only created when missing. So it is safe to re-run, and
// safe against an environment that is already partly set up — production, where the products exist
// already. Nothing is ever archived or deleted; a price whose amount no longer matches the table is
// left alone and reported, never mutated.
//
// With a LIVE key it refuses to guess the webhook host (--site is required) and never touches the
// local .env files, which point at the dev deployment — it prints the values instead.
//
// Source of truth for the numbers: app/src/lib/planPrices.ts and docs/PLATFORM.md §8
// "Stripe Dashboard setup". Change them there first, then here.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const API = 'https://api.stripe.com/v1'

// ── Decision D7, settled 2026-09-09 (Henriko) ─────────────────────────────────────────────────
// `always_invoice` bills an upgrade the moment it happens. The previous value, `create_prorations`,
// only WROTE proration line items and let them ride the next scheduled invoice — so a member could
// upgrade on day 2, use the higher tier all month, and cancel before ever being charged for it.
// That is the hole this closes, and the R13 ladder is built on upgrades.
//
// The historic objection to `always_invoice` was that it would also invoice a DOWNGRADE's credit on
// the spot. `SCHEDULE_AT_PERIOD_END` below removes that for every switch it covers: a cheaper
// switch is deferred to period end, so it never prorates and never credits at all.
const PRORATION = 'always_invoice'

// An update matching any of these is SCHEDULED at period end instead of applied now — the half that
// keeps a downgrade credit-free. Drop it and the no-refund line in the Terms breaks silently.
//
// ⚠️ It covers INTERVAL switches only, and that ceiling is structural. Stripe defers only "between
// prices that have the same product", and the portal refuses a product entry whose prices share a
// billing interval: "For each product, its price must have unique billing intervals" (400, proven
// 2026-09-09 by trying exactly that). So a product can expose one monthly and one annual price and
// no more — collapsing the tiers onto one product to widen this is impossible, not merely unwise.
// Starter annual → Starter monthly defers; Growth → Starter applies at once and credits.
// Closing THAT needs a subscription schedule of our own, off the portal. See docs/PLATFORM.md §8.
const SCHEDULE_AT_PERIOD_END = ['decreasing_item_amount', 'shortening_interval']

// unit_amount is CENTS. `interval` is what separates $100/yr from a catastrophic $100/mo.
const PLANS = [
  { key: 'starter', name: 'Starter', monthly: 1000, annual: 10000 },
  { key: 'growth', name: 'Growth', monthly: 1500, annual: 15000 },
  { key: 'pro', name: 'Pro', monthly: 5000, annual: 50000 }
]

// One product per tier — the portal's own model, and the only one it accepts (see the interval
// constraint above). The product NAME is what a member reads in the portal's plan list, on the
// invoice and on the statement; price `nickname` is "hidden from customers" and shows none of it.
const FEATURED = { name: 'Featured post', amount: 500 }
const CURRENCY = 'usd'

// The six events convex/http.ts registers. Subscribing to more means Stripe retries deliveries
// nothing handles; subscribing to fewer silently kills a flow (trial_will_end = the day-7 warning).
const EVENTS = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end',
  'invoice.payment_failed',
  'checkout.session.completed'
]

const arg = name => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? undefined : process.argv[i + 1]
}

// Same fallback chain as SITE below. The last successful run wrote the working key back into
// `.env.local`, so a dev re-run needs no arguments at all. A live key is never in that file, and
// `--key` overrides it anyway, so this can only ever resolve to the development environment.
const KEY = arg('key') ?? process.env.STRIPE_SECRET_KEY ?? readEnv('.env.local', 'STRIPE_SECRET_KEY')
const SITE = (arg('site') ?? process.env.CONVEX_SITE_URL ?? readEnv('.env.local', 'CONVEX_SITE_URL'))?.replace(
  /\/$/,
  ''
)

function readEnv(file, name) {
  const full = path.join(ROOT, file)
  if (!fs.existsSync(full)) return undefined
  return fs
    .readFileSync(full, 'utf8')
    .match(new RegExp(`^${name}=([^\r\n#]*)`, 'm'))?.[1]
    ?.trim()
}

function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

// Stripe's form encoding indexes every array explicitly — `products[0][prices][0]`, never a bare
// `[]`. This encoder has always produced that shape and Stripe has always accepted it. The
// long-running "Stripe silently drops `subscription_update.products`" story was a READ bug, never a
// write bug: `products` is an EXPANDABLE field, so a GET that does not ask for it comes back
// without one. Keep the explicit indices — they are the documented shape — but the encoder was
// never the suspect. See the read-back below and docs/PLATFORM.md §8.
function form(value, prefix = '') {
  if (value === undefined || value === null) return []
  if (Array.isArray(value)) return value.flatMap((item, i) => form(item, `${prefix}[${i}]`))
  if (typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => form(v, prefix ? `${prefix}[${k}]` : k))
  }
  return [[prefix, String(value)]]
}

// `node scripts/stripe-provision.mjs --check` runs this and stops, no key and no API calls. The
// nested `products[0][prices][0]` shape is the whole reason this encoder exists.
{
  const encode = body => new URLSearchParams(form(body)).toString()
  const nested = encode({ products: [{ product: 'prod_x', prices: ['price_a', 'price_b'] }] })
  assert(
    nested ===
      'products%5B0%5D%5Bproduct%5D=prod_x&products%5B0%5D%5Bprices%5D%5B0%5D=price_a&products%5B0%5D%5Bprices%5D%5B1%5D=price_b',
    `nested arrays lost their index: ${nested}`
  )
  assert(encode({ recurring: { interval: 'year' } }) === 'recurring%5Binterval%5D=year', 'nested object')
  assert(
    encode({ enabled_events: ['a', 'b'] }) === 'enabled_events%5B0%5D=a&enabled_events%5B1%5D=b',
    'top-level array'
  )
  assert(encode({ trial: undefined, name: 'Pro' }) === 'name=Pro', 'undefined must be dropped, not sent as "undefined"')
  if (process.argv.includes('--check')) {
    console.log('✓ form encoder ok')
    process.exit(0)
  }
}

function assert(ok, message) {
  if (!ok) fail(`self-check failed: ${message}`)
}

if (!KEY?.startsWith('sk_')) fail('Pass a Stripe secret key: --key sk_test_… (or set STRIPE_SECRET_KEY)')

// A live key must never inherit the dev site URL from .env.local: that would point production
// Stripe at the development backend, and the mistake is invisible until a real payment is lost.
const LIVE = KEY.startsWith('sk_live_')
if (LIVE && !arg('site')) fail('A live key requires an explicit --site https://<prod-deployment>.convex.site')
if (!SITE?.startsWith('http'))
  fail('Could not resolve the Convex site URL: pass --site https://<deployment>.convex.site')

// Non-fatal findings. Anything unrecoverable (a webhook secret) is printed the moment it exists, so
// a problem here can never cost it — the script finishes its work and exits 1 with the list.
const problems = []

async function call(method, endpoint, body, idempotencyKey) {
  const headers = { Authorization: `Bearer ${KEY}` }
  if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded'
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  const res = await fetch(`${API}${endpoint}`, {
    method,
    headers,
    body: body ? new URLSearchParams(form(body)) : undefined
  })
  const json = await res.json()
  if (!res.ok) fail(`${method} ${endpoint} → ${res.status} ${json.error?.message ?? JSON.stringify(json)}`)
  return json
}

// Stripe caches an idempotent response for 24 HOURS and replays it for any later request carrying
// the same key — WITHOUT performing the write. A key held constant across runs therefore turns a
// legitimate re-create into a silent no-op that hands back the OLD object. That is not theoretical:
// the stray-default fix above releases the `lits_tier` stamp so the loop will build that tier a
// fresh configuration, and with a constant key the create replayed the previous run's response and
// returned the very object the release was escaping — reported as "expected 6 prices, read 0".
// Duplicates across runs are prevented by the identity lookups, never by these keys, so the key's
// only job is to make ONE run's write safe to retry. Scope it to the run.
const RUN = Date.now().toString(36)
const idem = name => `lits-${name}-${RUN}`

const created = {}
const productIds = {}

// Deliberately one page: `limit=100` is far past what this app owns. But an account that already
// holds more would push ours off the end, every lookup below would miss, and the script would
// happily create DUPLICATE products and prices in a LIVE account. Say so instead of guessing.
const listAll = async endpoint => {
  const page = await call('GET', endpoint)
  if (page.has_more) {
    problems.push(
      `${endpoint} returned a full page with more behind it. Lookups on this list can miss and ` +
        'create duplicates — narrow the query or paginate before trusting this run.'
    )
  }
  return page.data ?? []
}

// Identity is the NAME, so renaming a product in the Dashboard makes the script create a new one.
// That is the intended failure: it never silently adopts a product it cannot recognise.
const products = await listAll('/products?limit=100&active=true')
const findOrCreateProduct = async (name, idempotencyKey) => {
  const existing = products.find(p => p.name === name)
  return existing ?? call('POST', '/products', { name }, idempotencyKey)
}

// ── Products + prices ─────────────────────────────────────────────────────────────────────────
for (const plan of PLANS) {
  const product = await findOrCreateProduct(plan.name, idem(`product-${plan.key}`))
  productIds[plan.key] = product.id

  // A price's identity is (amount, interval) — Stripe prices are immutable, so a matching one is
  // always safe to reuse and a mismatching one is a different price, never an edit.
  const existing = await listAll(`/prices?product=${product.id}&limit=100&active=true`)
  const price = async (amount, interval) =>
    existing.find(p => p.unit_amount === amount && p.recurring?.interval === interval && p.currency === CURRENCY) ??
    call(
      'POST',
      '/prices',
      { product: product.id, currency: CURRENCY, unit_amount: amount, recurring: { interval } },
      idem(`price-${plan.key}-${interval}`)
    )
  const monthly = await price(plan.monthly, 'month')
  const annual = await price(plan.annual, 'year')

  // A price that is its product's default_price cannot be archived until the product is repointed.
  // Set it only when there is none: repointing an established product is not this script's call.
  if (!product.default_price) await call('POST', `/products/${product.id}`, { default_price: monthly.id })

  created[`STRIPE_${plan.key.toUpperCase()}_PRICE_ID`] = monthly.id
  created[`STRIPE_${plan.key.toUpperCase()}_ANNUAL_PRICE_ID`] = annual.id
  console.log(`✓ ${plan.name}: ${monthly.id} ($${plan.monthly / 100}/mo), ${annual.id} ($${plan.annual / 100}/yr)`)
}

// One-time (no `recurring`) — mode:'payment' in billingNode.purchaseFeaturedPost. Never a tier.
const featuredProduct = await findOrCreateProduct(FEATURED.name, idem('product-featured'))
const featuredPrice =
  (await listAll(`/prices?product=${featuredProduct.id}&limit=100&active=true`)).find(
    p => p.unit_amount === FEATURED.amount && !p.recurring && p.currency === CURRENCY
  ) ??
  (await call(
    'POST',
    '/prices',
    { product: featuredProduct.id, currency: CURRENCY, unit_amount: FEATURED.amount },
    idem('price-featured')
  ))
created.STRIPE_FEATURED_POST_PRICE_ID = featuredPrice.id
console.log(`✓ ${FEATURED.name}: ${featuredPrice.id} ($${FEATURED.amount / 100} one-time)`)

// ── Read every price back ─────────────────────────────────────────────────────────────────────
// Never trust the POST: cents-vs-dollars and month-vs-year are the two mistakes that look fine in
// a 200 and only surface on a member's statement.
const expected = [
  ...PLANS.flatMap(p => [
    [created[`STRIPE_${p.key.toUpperCase()}_PRICE_ID`], p.monthly, 'month', productIds[p.key]],
    [created[`STRIPE_${p.key.toUpperCase()}_ANNUAL_PRICE_ID`], p.annual, 'year', productIds[p.key]]
  ]),
  [featuredPrice.id, FEATURED.amount, undefined, featuredProduct.id]
]
for (const [id, amount, interval, product] of expected) {
  const price = await call('GET', `/prices/${id}`)
  const actual = price.recurring?.interval
  if (price.unit_amount !== amount || actual !== interval) {
    fail(`price ${id} reads back as ${price.unit_amount}/${actual}, expected ${amount}/${interval}`)
  }
  // A price on the wrong product drops its rung out of schedule_at_period_end (Stripe defers only
  // within a product), and every other check here still passes: amount and interval are right.
  if (price.product !== product) fail(`price ${id} belongs to product ${price.product}, expected ${product}`)
}
console.log('✓ all 7 prices verified by GET (amount + interval + product)')

// ── Webhook ───────────────────────────────────────────────────────────────────────────────────
const webhookUrl = `${SITE}/stripe/webhook`
const existingHook = (await listAll('/webhook_endpoints?limit=100')).find(w => w.url === webhookUrl)
let webhookSecret

if (existingHook) {
  // `disabled` re-enables an endpoint Stripe switched off after repeated delivery failures.
  await call('POST', `/webhook_endpoints/${existingHook.id}`, { enabled_events: EVENTS, disabled: false })
  console.log(`✓ webhook ${existingHook.id} reused → ${webhookUrl} (${EVENTS.length} events re-applied)`)
  console.log("  ⓘ Stripe never returns an existing endpoint's signing secret. Keep the STRIPE_WEBHOOK_SECRET")
  console.log('    you already have, or reveal it in the Dashboard (Developers → Webhooks → this endpoint).')
} else {
  const webhook = await call('POST', '/webhook_endpoints', { url: webhookUrl, enabled_events: EVENTS }, idem('webhook'))
  webhookSecret = webhook.secret
  // `secret` exists ONLY in this response — printed here, before anything else can fail, because
  // nothing can recover it later except revealing it by hand in the Dashboard.
  console.log(`✓ webhook ${webhook.id} → ${webhook.url} (${EVENTS.length} events)`)
  console.log(`  STRIPE_WEBHOOK_SECRET=${webhookSecret}`)
}

// ── Customer Portal ───────────────────────────────────────────────────────────────────────────
// B07 — why there are FOUR configurations here and not one.
//
// `subscription_update.products` belongs to the CONFIGURATION, and the portal shows one list to
// every member. So a single config that lets a Starter member upgrade also lets a Pro member pick
// Starter: applied at once under `always_invoice` (D7), credited in cash, against the no-refund line
// in the Terms. Stripe defers a switch only between prices sharing a PRODUCT, and a portal product
// takes at most one price per interval, so no rearrangement fixes it (proven 2026-09-09).
//
// Stripe's only lever is MULTIPLE configurations plus a `configuration` on the session. One per
// tier, listing that tier and the tiers ABOVE it and nothing cheaper, each stamped with
// `metadata.lits_tier`. convex/billingNode.ts resolves them by that stamp and refuses hard
// (PORTAL_NOT_CONFIGURED) when the member's tier has none — never a permissive fallback.
//
// The DEFAULT config is what a portal link Stripe itself emails lands on (a receipt's "manage
// subscription"), and such a link cannot name a tier — so plan switching is turned OFF there.
const TIER_KEY = 'lits_tier'
// Cheapest first. Must stay in step with PORTAL_TIERS in convex/lib/portalConfig.ts.
const PORTAL_TIERS = ['starter', 'growth', 'pro']
for (const tier of PORTAL_TIERS) {
  if (!PLANS.some(p => p.key === tier)) fail(`PORTAL_TIERS names ${tier}, which is not one of the plans`)
}

const pricesOf = key => [
  created[`STRIPE_${key.toUpperCase()}_PRICE_ID`],
  created[`STRIPE_${key.toUpperCase()}_ANNUAL_PRICE_ID`]
]
/** The tiers a member may be offered: their own plus every tier above. Mirrors `tiersOfferedTo`. */
const offeredTo = tier => PORTAL_TIERS.slice(PORTAL_TIERS.indexOf(tier))

const baseFeatures = {
  invoice_history: { enabled: true },
  payment_method_update: { enabled: true },
  subscription_cancel: {
    enabled: true,
    mode: 'at_period_end',
    proration_behavior: 'none',
    cancellation_reason: {
      enabled: true,
      options: ['too_expensive', 'missing_features', 'switched_service', 'unused', 'other']
    }
  },
  subscription_pause: { enabled: false }
}

const featuresFor = tier => ({
  ...baseFeatures,
  subscription_update: {
    enabled: true,
    default_allowed_updates: ['price'],
    proration_behavior: PRORATION,
    // The other half of D7: a cheaper switch is deferred to period end, so `always_invoice` above
    // never credits a downgrade back to the member — for the rungs it reaches, which is interval
    // switches only. See the constraint on SCHEDULE_AT_PERIOD_END above.
    schedule_at_period_end: { conditions: SCHEDULE_AT_PERIOD_END.map(type => ({ type })) },
    // Belt and braces since 2026-09-09: our own actions now refuse any plan switch during a trial,
    // so the only way to reach this is the portal home. Without it, that switch ENDS the trial and
    // charges the member mid-switch.
    trial_update_behavior: 'continue_trial',
    // One entry per product, at most one price per interval inside it — Stripe rejects the whole
    // write otherwise ("For each product, its price must have unique billing intervals").
    products: offeredTo(tier).map(key => ({ product: productIds[key], prices: pricesOf(key) }))
  }
})

const existingConfigs = await listAll('/billing_portal/configurations?limit=100')

// An account holding no portal configuration at all gets its FIRST one stamped `is_default` by
// Stripe — on a fresh live account that is whatever this script creates first, i.e. the cheapest
// tier's. Two handlers below then fight over one object: the tier loop gives it prices, and the
// default block strips `subscription_update` to close the B07 leak on Stripe-emailed portal links.
// The strip runs last and wins, so that tier silently loses plan switching and its members cannot
// upgrade at all. `is_default` is read-only — no API parameter, no Dashboard control — so the only
// way out is to stop the default from BEING a tier config: release the stamp here and let the loop
// below build that tier a fresh one. Test mode never showed this, because saving portal settings in
// the Dashboard once (which the missing-default message asks for) creates a default of its own.
const strayDefault = existingConfigs.find(c => c.is_default && c.metadata?.[TIER_KEY])
if (strayDefault) {
  const tier = strayDefault.metadata[TIER_KEY]
  await call('POST', `/billing_portal/configurations/${strayDefault.id}`, { metadata: { [TIER_KEY]: '' } })
  strayDefault.metadata[TIER_KEY] = '' // the snapshot above is what the loop searches
  console.log(`ⓘ default ${strayDefault.id} was the ${tier} config too — stamp released, ${tier} gets a fresh one`)
}

for (const tier of PORTAL_TIERS) {
  const want = offeredTo(tier).flatMap(pricesOf)
  const existing = existingConfigs.find(c => c.metadata?.[TIER_KEY] === tier)
  const body = { features: featuresFor(tier), metadata: { [TIER_KEY]: tier } }
  const id = existing
    ? (await call('POST', `/billing_portal/configurations/${existing.id}`, body)).id
    : (await call('POST', '/billing_portal/configurations', body, idem(`portal-${tier}`))).id

  // Verify by GET, and EXPAND — `products` is an expandable field, so a plain retrieve reads back
  // `undefined` however many prices are stored. That read bug cost a day (2026-09-08k).
  const portal = await call(
    'GET',
    `/billing_portal/configurations/${id}?expand[0]=features.subscription_update.products`
  )
  const update = portal.features?.subscription_update
  const listedPrices = (update?.products ?? []).flatMap(p => p.prices ?? [])
  const missingPrices = want.filter(p => !listedPrices.includes(p))
  // A price that must NOT be listed is checked as hard as a missing one: an extra price here is not
  // cosmetic, it IS the credited cross-tier downgrade coming back.
  const forbidden = listedPrices.filter(p => !want.includes(p))
  const scheduled = (update?.schedule_at_period_end?.conditions ?? []).map(c => c.type)
  const missingConditions = SCHEDULE_AT_PERIOD_END.filter(t => !scheduled.includes(t))

  if (
    missingPrices.length ||
    forbidden.length ||
    update?.proration_behavior !== PRORATION ||
    missingConditions.length
  ) {
    problems.push(
      `portal ${id} (${tier}): expected ${want.length} prices, read ${listedPrices.length} ` +
        `(missing: ${missingPrices.join(', ') || 'none'}; must NOT be listed: ${forbidden.join(', ') || 'none'}).\n` +
        `  proration read back as ${update?.proration_behavior} (expected ${PRORATION}), ` +
        `schedule_at_period_end as [${scheduled}] (missing: ${missingConditions.join(', ') || 'nothing'}).\n` +
        (forbidden.length ? '  A cheaper price listed here re-opens the credited downgrade (B07).\n' : '') +
        `  Stripe stored: ${JSON.stringify(update)}`
    )
  } else {
    console.log(
      `✓ portal ${id} (${tier}): ${listedPrices.length} prices [${offeredTo(tier).join(' ')}], ` +
        `${PRORATION}, deferred [${scheduled.join(', ')}], continue_trial`
    )
  }
}

// The default configuration: no plan switching at all. Nothing the app mints uses it — billingNode
// always names a tier config — but a portal link Stripe emails does, and that link cannot name one.
// Stripe has no delete for portal configurations, only `active: false`, so this is edited in place.
const defaultConfig = existingConfigs.find(c => c.is_default)
if (!defaultConfig) {
  problems.push(
    'This account has no default Customer Portal configuration. The tier configurations above are what\n' +
      '  the app uses, so billing works, but a portal link Stripe emails would fall back to Stripe\n' +
      '  defaults. Open Dashboard → Settings → Billing → Customer portal, save once to create the\n' +
      '  default, then re-run to turn plan switching off on it.'
  )
} else {
  const configId = (
    await call('POST', `/billing_portal/configurations/${defaultConfig.id}`, {
      features: { ...baseFeatures, subscription_update: { enabled: false } }
    })
  ).id
  const portal = await call('GET', `/billing_portal/configurations/${configId}`)
  if (portal.features?.subscription_update?.enabled !== false) {
    problems.push(
      `portal ${configId} (default): subscription_update reads enabled=` +
        `${portal.features?.subscription_update?.enabled}, expected false.\n` +
        '  While it is on, a portal link Stripe emails offers every plan to every member — which is the\n' +
        '  credited cross-tier downgrade (B07) reachable outside the app entirely.'
    )
  } else {
    console.log(`✓ portal ${configId} (default): plan switching off — the tier configs own every switch`)
  }
}

// ── Env propagation ───────────────────────────────────────────────────────────────────────────
function upsertEnv(file, vars) {
  const full = path.join(ROOT, file)
  if (!fs.existsSync(full)) return console.log(`· ${file} not present, skipped`)
  let text = fs.readFileSync(full, 'utf8')
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  for (const [k, v] of Object.entries(vars)) {
    const re = new RegExp(`^${k}=[^\r\n]*`, 'm')
    text = re.test(text) ? text.replace(re, `${k}=${v}`) : text.replace(/\s*$/, '') + eol + `${k}=${v}` + eol
  }
  fs.writeFileSync(full, text)
  console.log(`✓ wrote ${Object.keys(vars).length} vars to ${file}`)
}

const prices = Object.fromEntries(Object.entries(created).filter(([k]) => k.endsWith('_PRICE_ID')))
const backend = { ...prices, STRIPE_SECRET_KEY: KEY }
// Only when this run minted it. Reusing an endpoint leaves the existing secret in place, and
// writing `undefined` over a working one would break every webhook.
if (webhookSecret) backend.STRIPE_WEBHOOK_SECRET = webhookSecret

const viteCopies = Object.fromEntries(
  Object.entries(prices)
    // The app build reads the VITE_ copies of the six subscription prices — same values, no
    // secrets, and NOT the featured price (it is never chosen client-side).
    .filter(([k]) => k !== 'STRIPE_FEATURED_POST_PRICE_ID')
    .map(([k, v]) => [`VITE_${k}`, v])
)

if (LIVE) {
  // The local .env files configure the DEV deployment. Writing live ids and a live secret key into
  // them would silently point the development app at production Stripe.
  console.log('\nLive key — local .env files left untouched. Production values:\n')
  for (const [k, v] of Object.entries({ ...backend, ...viteCopies })) console.log(`${k}=${v}`)
  console.log('\nSet them on the production Convex deployment, from the repo root:\n')
  for (const [k, v] of Object.entries(backend)) console.log(`npx convex env set ${k} ${v} --prod`)
  console.log('\nThe VITE_ copies belong in the production app build environment, not in app/.env.local.')
  // Stripe is only half of a working prod: the webhook lands on CONVEX_SITE_URL and every portal
  // and checkout redirect is built from APP_URL. Neither is this script's to set, and a wrong one
  // fails quietly — the payment succeeds and the member is returned to the dev app.
  console.log(`Check the prod deployment also has APP_URL and CONVEX_SITE_URL=${SITE} — the redirects use them.`)
} else {
  upsertEnv('.env.local', backend)
  upsertEnv('convex/.env.local', backend)
  upsertEnv('app/.env.local', viteCopies)

  // The fourth copy: the Convex DEPLOYMENT env, the only one the backend actually reads.
  console.log('\nRun these from the repo root (running convex from inside convex/ wipes the deployment):\n')
  for (const [k, v] of Object.entries(backend)) console.log(`npx convex env set ${k} ${v}`)
  console.log('\nThen restart `pnpm dev:app` — Vite reads VITE_ vars at startup only.')
}

if (problems.length) {
  console.error(`\n${problems.length} step(s) need attention — everything above is already applied:\n`)
  for (const p of problems) console.error(`✗ ${p}`)
  process.exit(1)
}
