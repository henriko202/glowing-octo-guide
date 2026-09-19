// scripts/billing-scenarios.mjs — the billing proofs in one script: the B07 downgrade run below, and
// the promotion-code guard run selected by --coupons. TEST MODE ONLY.
//
//   node scripts/billing-scenarios.mjs                    full B07 run, deletes the test clock afterwards
//   node scripts/billing-scenarios.mjs --keep             keep the clock (and its customer/subscription)
//   node scripts/billing-scenarios.mjs --user <convexId>  read-only audit of one member, writes nothing
//   node scripts/billing-scenarios.mjs --coupons          coupon guard run: a free month must not become a free year
//
// The --coupons run (2026-09-18): a 100%-off promotion code is attached to a trialing monthly
// subscription, then the portal-equivalent switch to annual happens on day 3 — while the `once`
// coupon is still unconsumed, which is exactly when it became a free year in test mode. It asserts
// three things: the no-plan-switching trial portal configuration exists, the promotion-code field
// is offered on MONTHLY Checkout sessions only (a 100%-off coupon on an annual Checkout zeroes the
// whole year, and Stripe cannot price-scope a coupon), and the webhook discount guard
// (lib/discountGuard) detaches the coupon before the trial-end invoice, so that invoice is PAID IN
// FULL. Checkout cannot drive a test-clock customer, so the coupon is attached the way a promotion
// code attaches it there: a subscription-level discount on the created subscription. The Checkout
// assertions drive our real createCheckoutSession action against its own disposable probe member.
// A second, no-trial subscription then carries the coupon to its own conclusion: consumed by its
// first invoice, so the same-day switch to annual is charged in full — the proof that the promotion
// only ever discounts one first monthly invoice.
//
// It drives OUR public actions through the Convex CLI, so it answers "does the platform behave?" —
// the guards, the pending-downgrade mirror, and the webhook half (syncUserSubscription →
// releaseSubscriptionSchedule) — and then reads Stripe's own money objects for the question B07
// actually asks: was NOTHING credited? Those are two different claims, and the mechanism one does not
// imply the other. A run can build a perfectly-shaped schedule, apply it, mirror it on our row and
// still hand the member a refund: drop the top-level `proration_behavior: 'none'` from
// scheduleDowngrade's phase-0 rewrite and every mechanism check below still passes while `no new
// invoice` fails. Hence the money assertions in S5, S7 and S8 — customer balance and invoice count at
// each step, and the applied invoice's own lines. (Those came from stripe-downgrade-proof.mjs, merged
// in and deleted on 2026-09-09: it could only drive Stripe against a synthetic customer that no member
// row pointed at, so it could never reach our own code at all.)
//
// HOW THE BLOCKER IS SOLVED. syncUserSubscription resolves the member by users.by_stripe_customer, so
// a customer no row points at is invisible to us. A test clock can only be attached to a customer at
// CREATION, so an existing member can never be moved onto one. The way through is the other
// direction: create the clock customer first, then point a member at it. That member is a DISPOSABLE
// probe user, minted fresh each run. No real account is ever touched, which matters because
// setStripeCustomerId cannot unset: a repointed real member would be left holding a dead customer id,
// and createCheckoutSession only mints a fresh one when the field is empty. Fresh rather than reused
// because `findLiveSubscription` scans by_user OLDEST-first, so a single aborted run would otherwise
// leave an `active` row that shadows every later run's own subscription.
//
// Each run also sweeps test clocks named `billing-scenarios` that earlier runs left behind, including
// ones kept with --keep. Inspect a kept clock before starting the next run.
//
// PREREQUISITES
//   - `npx convex dev` running (this reads and writes the DEV deployment, and needs its webhooks live)
//   - the test-mode account provisioned by scripts/stripe-provision.mjs (prices + portal configs)
//   `--user` needs neither to be useful: it is all GETs plus one sandboxed readonly query, and it
//   degrades to a Stripe-only report when the deployment is unreachable.
//
// NOT COVERED, deliberately: past_due/dunning (needs a failing card and repeated advances),
// invoice.payment_failed, the featured-post one-time checkout, the duplicate-subscription guard, and
// endTrialEarly's 50-interaction TRIGGER — reaching 50 needs 50 real interactions. What that trigger
// then DOES is covered: the conversion step below runs endTrialEarly itself, first on a cancelled
// trial (it must not convert) and then on a live one, where it asserts the MONEY — one paid invoice
// for the full price, nothing pending. The row moving to `active` never proved a charge: the
// 2026-09-10 cancelled-trial conversion went `active` too, and charged nothing. Each of the others
// needs machinery worth more than the coverage.
//
// ponytail: the Stripe form encoder and the assertion helpers below are a second copy of
// stripe-provision.mjs's. That script runs its whole flow at import, so it cannot be imported for its
// helpers, and extracting a shared module would mean editing the live-mode provisioning tool for a
// DRY win nobody asked for. Extract if a third copy ever appears.

import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const API = 'https://api.stripe.com/v1'
// The Convex CLI's own entrypoint, run with THIS node. `npx convex` cannot be spawned from a script
// on Windows: npx.cmd without a shell is EINVAL (the CVE-2024-27980 fix), and with `shell: true` the
// JSON argument's quotes are mangled before the CLI ever sees them.
const CONVEX_CLI = path.join(ROOT, 'node_modules', 'convex', 'bin', 'main.js')

// A FRESH probe member per run, not a reused one. A reused member keeps the subscription rows of
// every previous run, and `findLiveSubscription` scans the by_user index oldest-first — so one
// aborted run leaves an `active` row that every later run's actions would resolve against instead of
// the subscription it just created. A new member starts with no rows and cannot be shadowed. The
// cost is one dev-DB row per run, which is the cheaper side of that trade pre-launch.
const PROBE_LINKEDIN_ID = `lits-billing-scenarios-${Date.now().toString(36)}`

const flag = name => process.argv.includes(`--${name}`)
const arg = name => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? undefined : process.argv[i + 1]
}

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
  process.exitCode = 1
  throw new Error(message)
}

function form(value, prefix = '') {
  if (value === undefined || value === null) return []
  if (Array.isArray(value)) return value.flatMap((item, i) => form(item, `${prefix}[${i}]`))
  if (typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => form(v, prefix ? `${prefix}[${k}]` : k))
  }
  return [[prefix, String(value)]]
}

const KEY = arg('key') ?? process.env.STRIPE_SECRET_KEY ?? readEnv('.env.local', 'STRIPE_SECRET_KEY')
const USER = arg('user')
const PRICE = {
  starter: readEnv('.env.local', 'STRIPE_STARTER_PRICE_ID'),
  growth: readEnv('.env.local', 'STRIPE_GROWTH_PRICE_ID'),
  pro: readEnv('.env.local', 'STRIPE_PRO_PRICE_ID')
}
// Only the coupon run needs an annual price by name: the switch it drives is monthly -> annual.
const ANNUAL_PRICE = {
  starter: readEnv('.env.local', 'STRIPE_STARTER_ANNUAL_PRICE_ID'),
  growth: readEnv('.env.local', 'STRIPE_GROWTH_ANNUAL_PRICE_ID'),
  pro: readEnv('.env.local', 'STRIPE_PRO_ANNUAL_PRICE_ID')
}

// Every price → its tier, annual included. The run below only ever touches monthly, but --user has to
// name whatever price a real member is actually on — and annual is where a credit costs the most.
// This is lib/stripePrices.getTierFromPriceId's map, read from the same six env vars.
const TIER_BY_PRICE = {}
for (const tier of Object.keys(PRICE)) {
  for (const id of [PRICE[tier], readEnv('.env.local', `STRIPE_${tier.toUpperCase()}_ANNUAL_PRICE_ID`)]) {
    if (id) TIER_BY_PRICE[id] = tier
  }
}
const tierOf = priceId => TIER_BY_PRICE[priceId] ?? 'unknown'

// Called from inside run()'s try, so a misconfiguration prints one line like every other failure
// rather than an uncaught stack trace.
function preflight() {
  if (!KEY?.startsWith('sk_')) fail('Pass a Stripe secret key: --key sk_test_… (or set STRIPE_SECRET_KEY)')
  // Not a guard against mistakes — a guard against this script existing at all in live. It creates
  // members, subscriptions and clocks; no version of that belongs in a real account.
  if (!KEY.startsWith('sk_test_')) fail('TEST MODE ONLY. This creates members, subscriptions and clocks.')
  for (const [tier, id] of Object.entries(PRICE)) {
    if (!id) fail(`STRIPE_${tier.toUpperCase()}_PRICE_ID is missing from .env.local — run scripts/stripe-provision.mjs`)
  }
}

// ── Stripe ────────────────────────────────────────────────────────────────────────────────────
async function stripe(method, endpoint, body) {
  const headers = { Authorization: `Bearer ${KEY}` }
  if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded'
  const res = await fetch(`${API}${endpoint}`, {
    method,
    headers,
    body: body ? new URLSearchParams(form(body)) : undefined
  })
  const json = await res.json()
  if (!res.ok) fail(`${method} ${endpoint} → ${res.status} ${json.error?.message ?? JSON.stringify(json)}`)
  return json
}

const periodEndOf = sub => sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end
const scheduleIdOf = sub => (typeof sub.schedule === 'string' ? sub.schedule : sub.schedule?.id)
// A line item's price moved the same way current_period_end did: `line.price` is now
// `line.pricing.price_details.price`. No Stripe-Version header is sent, so read both shapes.
const linePriceOf = line => line.pricing?.price_details?.price ?? line.price?.id
const invoicesOf = async subId => (await stripe('GET', `/invoices?subscription=${subId}&limit=100`)).data
const balanceOf = async customerId => (await stripe('GET', `/customers/${customerId}`)).balance

// ── Convex ────────────────────────────────────────────────────────────────────────────────────
// Returns { ok, value, error }. Never throws: a REFUSAL is the expected outcome of half the
// scenarios below, so the caller decides whether a failure is a pass.
function convex(argv) {
  const r = spawnSync(process.execPath, [CONVEX_CLI, 'run', ...argv], { encoding: 'utf8', cwd: ROOT })
  if (r.error) fail(`could not run the Convex CLI: ${r.error.message}`)
  const out = (r.stdout ?? '').trim()
  if (r.status !== 0) {
    // The CLI prints `Uncaught ConvexError: CODE` (plus a stack) to stderr. Keep it whole — the
    // guard assertions match a substring, and an unexpected failure needs its real text visible.
    return { ok: false, error: (r.stderr ?? '').trim() }
  }
  try {
    return { ok: true, value: out === '' ? undefined : JSON.parse(out) }
  } catch {
    return { ok: true, value: out }
  }
}

/** A named function: internal mutations/actions, and the public billing actions. */
const call = (name, args) => convex([name, JSON.stringify(args ?? {})])

/** A sandboxed readonly DB read. `ctx` is bound; top-level await and `return` both work. */
const query = js => convex(['--inline-query', js])

const readSub = id =>
  `const r = await ctx.db.query('subscriptions').withIndex('by_stripe_id', q =>
     q.eq('stripeSubscriptionId', ${JSON.stringify(id)})).first()
   return r && { tier: r.tier, status: r.status, currentPeriodEnd: r.currentPeriodEnd ?? null,
     priceInterval: r.priceInterval ?? null,
     pendingTier: r.pendingTier ?? null, pendingAt: r.pendingAt ?? null,
     cancelAtPeriodEnd: r.cancelAtPeriodEnd ?? null, userId: r.userId }`

const readUser = id =>
  `const u = await ctx.db.get(${JSON.stringify(id)})
   return u && { tier: u.tier, status: u.subscriptionStatus, customer: u.stripeCustomerId ?? null }`

// ── Assertions ────────────────────────────────────────────────────────────────────────────────
// Nothing aborts on a failed check: one run should print the whole picture, because the interesting
// output is the pattern of what held and what did not, not the first thing that broke.
const results = []
const check = (label, ok, detail) => {
  results.push(ok)
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail === undefined ? '' : ` — ${detail}`}`)
}
const note = detail => console.log(`  · ${detail}`)
const heading = text => console.log(`\n${text}`)

// The informative line of a CLI failure. The first line is only ever `✖ Failed to run function "…"`,
// which names what broke and not why; the cause is on the `Uncaught …` line below it.
const errLine = e => (e.split('\n').find(l => l.includes('Uncaught')) ?? e.split('\n')[0] ?? '').trim()

/** Asserts a public action REFUSES with a specific guard code. A success is the failure here. */
function expectRefusal(label, code, name, args) {
  const r = call(name, args)
  if (r.ok) return check(label, false, `succeeded — returned ${JSON.stringify(r.value)}`)
  check(label, r.error.includes(code), errLine(r.error))
}

/**
 * The B07 assertion proper: no money moved. Both halves are needed. A credit does NOT arrive as an
 * invoice line — Stripe parks it as a NEGATIVE customer balance and silently consumes it on the next
 * invoice a period later — so an invoice-only check cannot see it, while a balance-only check misses
 * a charge that settled immediately.
 */
async function checkNoMoneyMoved(when, customerId, subId, baseline) {
  const balance = await balanceOf(customerId)
  check(`customer balance is still 0 ${when}`, balance === 0, String(balance))
  const count = (await invoicesOf(subId)).length
  check(`no new invoice ${when}`, count === baseline, `${count} vs ${baseline}`)
}

/**
 * Polls a readonly query until `predicate` holds. Every webhook-driven assertion needs this: Stripe
 * delivers the event to convex.site out of band, so the state we are asserting on arrives after the
 * API call that caused it has already returned.
 */
async function waitFor(label, js, predicate, seconds = 45) {
  let last
  for (let i = 0; i < seconds * 2; i++) {
    const r = query(js)
    if (!r.ok) fail(`inline query failed:\n${r.error}`)
    last = r.value
    if (predicate(last)) {
      check(label, true)
      return last
    }
    await sleep(500)
  }
  check(label, false, `timed out after ${seconds}s — last read ${JSON.stringify(last)}`)
  return last
}

/**
 * The Stripe-side twin of waitFor. The coupon guard's detach is scheduled from a webhook, so the
 * delete lands after the API call that caused it has already returned — and the state to assert
 * lives in Stripe, not in our row.
 */
async function waitForStripe(label, read, predicate, seconds = 45) {
  let last
  for (let i = 0; i < seconds * 2; i++) {
    last = await read()
    if (predicate(last)) {
      check(label, true)
      return last
    }
    await sleep(500)
  }
  check(label, false, `timed out after ${seconds}s — last read ${JSON.stringify(last)}`)
  return last
}

/** Advances the clock and waits for Stripe to finish replaying billing on it. */
async function advanceTo(clockId, unixTime) {
  await stripe('POST', `/test_helpers/test_clocks/${clockId}/advance`, { frozen_time: unixTime })
  let state = 'advancing'
  for (let i = 0; i < 120 && state === 'advancing'; i++) {
    await sleep(2000)
    state = (await stripe('GET', `/test_helpers/test_clocks/${clockId}`)).status
  }
  if (state !== 'ready') fail(`test clock ended in status "${state}" — cannot read back`)
}

// ── The run ───────────────────────────────────────────────────────────────────────────────────
async function run() {
  const now = Math.floor(Date.now() / 1000)
  let clockId
  let probeUserId

  try {
    preflight()

    // ── Setup ──
    heading('Setup — a clock customer, and a disposable member pointed at it')
    // Sweep clocks this script left behind — an aborted run (or --keep) leaves one holding a live
    // subscription that keeps firing webhooks into the deployment for as long as it exists.
    const stale = (await stripe('GET', '/test_helpers/test_clocks?limit=100')).data.filter(
      c => c.name === 'billing-scenarios'
    )
    for (const c of stale) {
      await stripe('DELETE', `/test_helpers/test_clocks/${c.id}`)
      note(`swept a leftover clock ${c.id} from an earlier run`)
    }

    const clock = await stripe('POST', '/test_helpers/test_clocks', { frozen_time: now, name: 'billing-scenarios' })
    clockId = clock.id
    note(`test clock ${clock.id} frozen at ${new Date(now * 1000).toISOString()}`)

    const customer = await stripe('POST', '/customers', {
      test_clock: clock.id,
      email: 'billing-probe@example.invalid',
      description: 'LITS billing scenarios probe — safe to delete'
    })
    const pm = await stripe('POST', '/payment_methods', { type: 'card', card: { token: 'tok_visa' } })
    await stripe('POST', `/payment_methods/${pm.id}/attach`, { customer: customer.id })
    await stripe('POST', `/customers/${customer.id}`, { invoice_settings: { default_payment_method: pm.id } })
    note(`customer ${customer.id} with a test Visa`)

    // tokenExpiresAt is a decade out on purpose: a probe user carries no real LinkedIn token, and a
    // near expiry would put it in front of whatever sweeps by_token_expiry.
    const upserted = call('linkedin/auth:upsertUser', {
      linkedinId: PROBE_LINKEDIN_ID,
      name: 'Billing Scenarios Probe',
      email: 'billing-probe@example.invalid',
      accessToken: 'probe-not-a-real-token',
      tokenExpiresAt: Date.now() + 10 * 365 * 24 * 3600 * 1000
    })
    if (!upserted.ok) fail(`could not create the probe member — is \`npx convex dev\` running?\n${upserted.error}`)
    const userId = upserted.value
    probeUserId = userId
    note(`probe member ${userId} (linkedinId ${PROBE_LINKEDIN_ID}, fresh for this run)`)

    // ── S1 link ──
    heading('S1 link — the member now resolves from the Stripe customer')
    const linked = call('billing:setStripeCustomerId', { userId, stripeCustomerId: customer.id })
    check('setStripeCustomerId accepted', linked.ok, linked.ok ? customer.id : errLine(linked.error))
    const byCustomer = query(
      `const u = await ctx.db.query('users').withIndex('by_stripe_customer', q =>
         q.eq('stripeCustomerId', ${JSON.stringify(customer.id)})).first()
       return u?._id ?? null`
    )
    check('users.by_stripe_customer finds the member', byCustomer.value === userId, String(byCustomer.value))

    const sessionToken = crypto.randomUUID()
    const minted = call('sessions:create', { token: sessionToken, userId })
    check('session token minted', minted.ok, minted.ok ? 'ok' : errLine(minted.error))

    // ── S2 webhook sync on create ──
    heading('S2 webhook sync — a Stripe subscription becomes a Convex row')
    const sub = await stripe('POST', '/subscriptions', {
      customer: customer.id,
      items: [{ price: PRICE.growth }],
      trial_period_days: 7,
      payment_behavior: 'error_if_incomplete',
      // What checkout stamps (billingNode.ts:72). Nothing in the webhook path reads it — it is a
      // Dashboard support lookup — but it earns its place twice here: `--user` searches on it, and
      // buildDowngradePhases has to carry it through the phase-0 rewrite or that rewrite silently
      // UNSETS it (lib/downgrade.ts:127). Without the stamp neither of those is exercised at all.
      metadata: { convexUserId: userId },
      expand: ['items.data.price']
    })
    note(`subscription ${sub.id} — ${sub.status}, ${PRICE.growth} (Growth), 7-day trial`)
    note('a trial conversion below will try to email billing-probe@example.invalid; that bounce is expected')

    const trialRow = await waitFor('subscriptions row created by the webhook', readSub(sub.id), r => r !== null)
    check('row tier is growth', trialRow?.tier === 'growth', trialRow?.tier)
    check('row status is trialing', trialRow?.status === 'trialing', trialRow?.status)
    check(
      'row currentPeriodEnd matches Stripe (ms)',
      trialRow?.currentPeriodEnd === periodEndOf(sub) * 1000,
      `${trialRow?.currentPeriodEnd} vs ${periodEndOf(sub) * 1000}`
    )
    check('row belongs to the probe member', trialRow?.userId === userId, trialRow?.userId)
    await waitFor('users.tier followed Stripe to growth', readUser(userId), u => u?.tier === 'growth')

    // ── S3 trial gate ──
    heading('S3 trial gate — a trial runs on the plan it started on (product rule, 2026-09-09)')
    expectRefusal(
      'plan grid: Starter during a trial is refused',
      'TRIAL_NO_SWITCH',
      'billingNode:createPlanSwitchSession',
      {
        sessionToken,
        priceId: PRICE.starter
      }
    )
    expectRefusal(
      'plan grid: Pro during a trial is refused',
      'TRIAL_NO_SWITCH',
      'billingNode:createPlanSwitchSession',
      {
        sessionToken,
        priceId: PRICE.pro
      }
    )
    expectRefusal(
      'cancel flow: "Move to Starter" during a trial is refused',
      'TRIAL_NO_SWITCH',
      'billingNode:createCancelFlowSession',
      { sessionToken, flow: 'downgrade' }
    )

    // The 2026-09-10 incident: the portal cancels with `cancel_at` (API 2026-02-25.clover), not the
    // flag. The row read it as "not cancelling", the 50th interaction converted the cancelled trial,
    // and Stripe billed the truncated period as PENDING prorations — nothing charged until renewal.
    heading('A cancelled trial is not converted (the portal cancel shape: cancel_at, flag false)')
    await stripe('POST', `/subscriptions/${sub.id}`, { cancel_at: sub.trial_end })
    await waitFor('row mirrors cancel_at as cancelAtPeriodEnd', readSub(sub.id), r => r?.cancelAtPeriodEnd === true)
    const skipped = call('billingNode:endTrialEarly', { stripeSubscriptionId: sub.id })
    check('endTrialEarly returns quietly', skipped.ok, skipped.ok ? 'ok' : errLine(skipped.error))
    const cancelled = await stripe('GET', `/subscriptions/${sub.id}`)
    check('the cancelled trial is still trialing', cancelled.status === 'trialing', cancelled.status)
    const resumedTrial = call('billingNode:resumeSubscription', { sessionToken })
    check('resumeSubscription accepted', resumedTrial.ok, resumedTrial.ok ? 'ok' : errLine(resumedTrial.error))
    const uncancelled = await stripe('GET', `/subscriptions/${sub.id}`)
    check('resume cleared cancel_at', uncancelled.cancel_at === null, String(uncancelled.cancel_at))
    await waitFor('row cancelAtPeriodEnd cleared', readSub(sub.id), r => r?.cancelAtPeriodEnd !== true)

    heading('Converting the trial (endTrialEarly — the 50-interaction conversion)')
    const invoicesInTrial = (await invoicesOf(sub.id)).length
    const converted = call('billingNode:endTrialEarly', { stripeSubscriptionId: sub.id })
    check('endTrialEarly accepted', converted.ok, converted.ok ? 'ok' : errLine(converted.error))
    await waitFor('row status moved to active', readSub(sub.id), r => r?.status === 'active')
    // Money, not status: `active` is also what the cancelled-trial conversion above reached.
    const [conversionInvoice, ...olderInvoices] = await invoicesOf(sub.id)
    check(
      'the conversion is invoiced now',
      olderInvoices.length === invoicesInTrial,
      `${olderInvoices.length + 1} invoice(s)`
    )
    const fullPrice = sub.items.data[0].price.unit_amount
    check(
      'and paid, for the full price',
      conversionInvoice?.status === 'paid' && conversionInvoice?.amount_paid === fullPrice,
      `${conversionInvoice?.status} ${conversionInvoice?.amount_paid} vs ${fullPrice}`
    )
    const pendingItems = (await stripe('GET', `/invoiceitems?pending=true&customer=${customer.id}`)).data
    check('nothing left pending for the renewal', pendingItems.length === 0, `${pendingItems.length} item(s)`)

    // ── S4 cancel-pending ──
    heading('S4 cancel pending — the mirror, the guard it raises, and resumeSubscription')
    await stripe('POST', `/subscriptions/${sub.id}`, { cancel_at_period_end: true })
    await waitFor('row mirrors cancelAtPeriodEnd', readSub(sub.id), r => r?.cancelAtPeriodEnd === true)
    expectRefusal(
      'a downgrade is refused while a cancellation is pending',
      'CANCEL_PENDING',
      'billingNode:createPlanSwitchSession',
      { sessionToken, priceId: PRICE.starter }
    )
    const resumed = call('billingNode:resumeSubscription', { sessionToken })
    check('resumeSubscription accepted', resumed.ok, resumed.ok ? 'ok' : errLine(resumed.error))
    await waitFor('row cancelAtPeriodEnd cleared', readSub(sub.id), r => r?.cancelAtPeriodEnd !== true)

    // ── S5 downgrade through our own action ──
    heading('S5 downgrade — createPlanSwitchSession schedules instead of opening the portal')
    // Baseline for every money assertion below. Taken HERE, with the trial conversion already billed:
    // from this point until the swap applies, nothing may add an invoice or move the balance.
    const invoicesBefore = (await invoicesOf(sub.id)).length
    note(`${invoicesBefore} invoice(s) so far — the baseline; nothing between here and the swap may add one`)

    const switched = call('billingNode:createPlanSwitchSession', { sessionToken, priceId: PRICE.starter })
    if (!switched.ok) fail(`createPlanSwitchSession refused unexpectedly:\n${switched.error}`)
    check('returns { url: null } — no portal round trip', switched.value?.url === null, JSON.stringify(switched.value))

    const subA = await stripe('GET', `/subscriptions/${sub.id}?expand[0]=schedule`)
    const schedule = typeof subA.schedule === 'object' ? subA.schedule : null
    const phase1 = schedule?.phases?.[1]
    const periodEnd = periodEndOf(subA)
    check('a schedule is attached', Boolean(schedule?.id), schedule?.id)
    check('two phases', schedule?.phases?.length === 2, `${schedule?.phases?.length}`)
    check('item is still on Growth', subA.items.data[0].price.id === PRICE.growth, subA.items.data[0].price.id)
    check('phase 1 is the Starter price', phase1?.items?.[0]?.price === PRICE.starter, phase1?.items?.[0]?.price)
    check('phase 1 proration_behavior is "none"', phase1?.proration_behavior === 'none', phase1?.proration_behavior)
    check(
      'phase 1 starts at current_period_end',
      phase1?.start_date === periodEnd,
      `${phase1?.start_date} vs ${periodEnd}`
    )
    check('end_behavior is release', schedule?.end_behavior === 'release', schedule?.end_behavior)

    // The assertion the synthetic-customer run could not reach: our row, not Stripe's object.
    const pending = await waitFor(
      'row mirrors pendingTier "starter"',
      readSub(sub.id),
      r => r?.pendingTier === 'starter',
      10
    )
    check(
      'row pendingAt == phase 1 start_date (ms)',
      pending?.pendingAt === phase1?.start_date * 1000,
      `${pending?.pendingAt} vs ${phase1?.start_date * 1000}`
    )
    // The member is not moved yet — that is the whole product promise of a scheduled downgrade.
    const stillGrowth = query(readUser(userId)).value?.tier
    check('member keeps growth until it applies', stillGrowth === 'growth', stillGrowth)
    // …and neither is their money. This is the state the portal used to reach by crediting on the
    // spot, which is the contradiction with the no-refund Terms that B07 exists to close.
    await checkNoMoneyMoved('while the downgrade is merely scheduled', customer.id, sub.id, invoicesBefore)

    // ── S6 guards while pending ──
    heading('S6 guards — what the plan grid refuses while a downgrade is booked')
    expectRefusal('an upgrade is refused while pending', 'PENDING_DOWNGRADE', 'billingNode:createPlanSwitchSession', {
      sessionToken,
      priceId: PRICE.pro
    })
    expectRefusal('the current plan is refused', 'ALREADY_ON_PLAN', 'billingNode:createPlanSwitchSession', {
      sessionToken,
      priceId: PRICE.growth
    })
    expectRefusal('an unknown price is refused', 'Invalid price ID', 'billingNode:createPlanSwitchSession', {
      sessionToken,
      priceId: 'price_not_ours'
    })

    // ── S7 undo ──
    heading('S7 undo — "Keep Growth" releases the schedule and clears the mirror')
    const undone = call('billingNode:undoScheduledDowngrade', { sessionToken })
    check('undoScheduledDowngrade accepted', undone.ok, undone.ok ? 'ok' : errLine(undone.error))
    const subC = await stripe('GET', `/subscriptions/${sub.id}`)
    check('subscription.schedule is null', scheduleIdOf(subC) === undefined, String(scheduleIdOf(subC)))
    check('price unchanged', subC.items.data[0].price.id === PRICE.growth, subC.items.data[0].price.id)
    await waitFor('row pendingTier cleared', readSub(sub.id), r => r?.pendingTier === null, 10)
    // An undo is the other way a naive implementation leaks money: releasing a schedule that already
    // rewrote phase 0 can re-invoice the current period.
    await checkNoMoneyMoved('after the undo', customer.id, sub.id, invoicesBefore)

    // ── S8 the webhook half ──
    heading('S8 the swap lands — one clean invoice, and our code clears up after it')
    const again = call('billingNode:createCancelFlowSession', { sessionToken, flow: 'downgrade' })
    if (!again.ok) fail(`createCancelFlowSession refused unexpectedly:\n${again.error}`)
    check('cancel flow also returns { url: null }', again.value?.url === null, JSON.stringify(again.value))
    await waitFor('re-scheduled — pendingTier is starter again', readSub(sub.id), r => r?.pendingTier === 'starter', 10)

    note(`advancing the clock past ${new Date(periodEnd * 1000).toISOString()} — this takes a minute`)
    await advanceTo(clock.id, periodEnd + 3600)

    const subB = await stripe('GET', `/subscriptions/${sub.id}`)
    check(
      'Stripe: item is on the Starter price',
      subB.items.data[0].price.id === PRICE.starter,
      subB.items.data[0].price.id
    )
    // A phase rewrite that omits metadata unsets it for the whole phase, which would quietly break
    // every Dashboard support lookup after a downgrade. buildDowngradePhases carries it; this is the
    // only place that proves the carry actually survives Stripe's round trip.
    check('checkout metadata survived the swap', subB.metadata?.convexUserId === userId, subB.metadata?.convexUserId)
    await waitFor('row tier moved to starter', readSub(sub.id), r => r?.tier === 'starter')
    await waitFor('row pendingTier cleared by the sync', readSub(sub.id), r => r?.pendingTier === null, 15)
    await waitFor('users.tier moved to starter', readUser(userId), u => u?.tier === 'starter', 15)

    // The renewal invoice the swap produced — the one artefact that would carry a refund if one had
    // been given. A credited downgrade appears here as a negative line, or, when the credit exceeds
    // the new invoice, as a negative customer balance carried silently into the next period.
    const starterPrice = await stripe('GET', `/prices/${PRICE.starter}`)
    const invoices = await invoicesOf(sub.id)
    const lines = invoices[0]?.lines?.data ?? []
    check('a new invoice was issued', invoices.length > invoicesBefore, `${invoices.length} vs ${invoicesBefore}`)
    check('the invoice has EXACTLY ONE line', lines.length === 1, `${lines.length} line(s)`)
    check(
      'that line is the Starter price',
      lines.length === 1 && linePriceOf(lines[0]) === PRICE.starter,
      lines.map(linePriceOf).join()
    )
    check('NO negative line', !lines.some(l => l.amount < 0), lines.map(l => l.amount).join())
    check('NO proration line', !lines.some(l => l.proration === true))
    check(
      'invoice total is the Starter price',
      invoices[0]?.total === starterPrice.unit_amount,
      `${invoices[0]?.total} vs ${starterPrice.unit_amount}`
    )
    const balanceB = await balanceOf(customer.id)
    check('customer balance is 0 — nothing was credited', balanceB === 0, String(balanceB))

    // The webhook-scheduled release cannot be observed under a test clock. Stripe locks writes while
    // a clock advances ("Test clock advancement underway - cannot perform modifications"), and the
    // swap webhook necessarily fires INSIDE that window — so the one-shot action runs and is refused
    // a second later, before the clock is ready. Convex does not retry actions, so nothing re-runs
    // it. That the sync scheduled it at all is already proven above: `pendingTier cleared by the
    // sync` is the same `applied` branch that schedules the release. What is left to prove is the
    // action itself, so run it now the clock has settled.
    //
    // The state that refusal leaves behind — a SPENT schedule, still attached, with pendingTier
    // clear — used to refuse every upgrade with PENDING_DOWNGRADE for a whole period. That is a
    // real production path (any transient Stripe failure reaches it), and it is closed by
    // isSpentSchedule in lib/downgrade; the decision is unit-tested there, because proving it here
    // would need an upgrade portal session and portalSession mints its own component-managed
    // customer, which does not own this clock subscription (see S9's note).
    if (scheduleIdOf(subB)) note('the scheduled release was refused mid-advance — re-running it now')
    const released = call('billingNode:releaseSubscriptionSchedule', { stripeSubscriptionId: sub.id })
    check('releaseSubscriptionSchedule accepted', released.ok, released.ok ? 'ok' : errLine(released.error))
    let releasedSub = subB
    for (let i = 0; i < 30 && scheduleIdOf(releasedSub); i++) {
      await sleep(1000)
      releasedSub = await stripe('GET', `/subscriptions/${sub.id}`)
    }
    check(
      'releaseSubscriptionSchedule handed the subscription back',
      scheduleIdOf(releasedSub) === undefined,
      String(scheduleIdOf(releasedSub))
    )

    // ── S9 the portal home ──
    heading('S9 portal home — a per-tier configuration exists and is matched')
    const portal = call('billingNode:createPortalSession', { sessionToken })
    check(
      'createPortalSession returns a URL (no PORTAL_NOT_CONFIGURED)',
      portal.ok && typeof portal.value?.url === 'string',
      portal.ok ? portal.value?.url : errLine(portal.error)
    )
    note('that session used the STARTER configuration — the member is starter after S8')
    note('it also mints a component-managed customer, off the clock; harmless, and deleted with nothing')

    // `products` is an EXPANDABLE field: a plain retrieve returns ids only, which is the read bug
    // that produced the retracted "Stripe drops products" story (§8). Expand it or the check lies.
    const configs = await stripe('GET', '/billing_portal/configurations?active=true&limit=100')
    const offered = { starter: ['starter', 'growth', 'pro'], growth: ['growth', 'pro'], pro: ['pro'] }
    for (const [tier, expected] of Object.entries(offered)) {
      const found = configs.data.find(c => c.metadata?.lits_tier === tier)
      if (!found) {
        check(`a "${tier}" portal configuration exists`, false, 'missing — run scripts/stripe-provision.mjs')
        continue
      }
      const full = await stripe(
        'GET',
        `/billing_portal/configurations/${found.id}?expand[0]=features.subscription_update.products`
      )
      const tiers = (full.features?.subscription_update?.products ?? []).map(
        p => Object.entries(PRICE).find(([, id]) => p.prices?.includes(id))?.[0] ?? p.product
      )
      check(
        `"${tier}" config offers exactly ${expected.join(' + ')}`,
        tiers.join() === expected.join(),
        tiers.join(' + ')
      )
    }
  } finally {
    heading('Cleanup')
    if (!clockId) {
      note('nothing created')
    } else if (flag('keep')) {
      note(`kept: test clock ${clockId}, with its customer, subscription and invoices`)
      note(`delete with: curl -u "$STRIPE_SECRET_KEY:" -X DELETE ${API}/test_helpers/test_clocks/${clockId}`)
    } else {
      await stripe('DELETE', `/test_helpers/test_clocks/${clockId}`)
      note(`test clock ${clockId} deleted, with its customer, subscription and invoices`)
    }
    // The probe member is deliberately left behind, still pointing at a now-deleted customer.
    // setStripeCustomerId cannot unset — which is the whole reason this uses a disposable member
    // rather than a real one. The next run mints its own and never reads this row again.
    if (probeUserId) note(`probe member ${probeUserId} left in the dev DB; harmless, never reused`)
  }
}

// ── Coupon guard run (--coupons) ───────────────────────────────────────────────────────────────
// The promotion-code campaign's one money question: does a free month stay a free month? In test
// mode it did not, twice (2026-09-18). A `repeating` coupon discounted the prorated ANNUAL invoice
// of a monthly -> annual switch inside its window; a `once` coupon did the same when the switch
// happened DURING a trial, because it is not consumed until the first invoice after the trial ends.
// The fix has two halves — a no-plan-switching portal configuration for trialing members
// (stripe-provision + lib/portalConfig), and a webhook detach for every other price change with a
// discount still attached (lib/discountGuard -> billingNode.detachSubscriptionDiscounts). This run
// proves the second half through a real clock and asserts the money at trial end: the annual
// invoice is paid in full, not $0. The first half is asserted as account state: the trial config
// exists and disables plan switching.
async function couponRun() {
  const now = Math.floor(Date.now() / 1000)
  let clockId
  let couponId
  let probeUserId
  const openSessions = []

  try {
    preflight()
    if (!PRICE.growth) fail('STRIPE_GROWTH_PRICE_ID is missing from .env.local — run scripts/stripe-provision.mjs')
    if (!ANNUAL_PRICE.growth)
      fail('STRIPE_GROWTH_ANNUAL_PRICE_ID is missing from .env.local — run scripts/stripe-provision.mjs')

    heading('Coupon guard — a free-month promotion code must not become a free year')
    const coupon = await stripe('POST', '/coupons', {
      percent_off: 100,
      duration: 'once',
      name: 'lits-coupon-guard'
    })
    couponId = coupon.id
    note(`coupon ${coupon.id} — 100% off, duration once (what a promotion code wraps)`)

    const stale = (await stripe('GET', '/test_helpers/test_clocks?limit=100')).data.filter(
      c => c.name === 'billing-coupons'
    )
    for (const c of stale) {
      await stripe('DELETE', `/test_helpers/test_clocks/${c.id}`)
      note(`swept a leftover clock ${c.id} from an earlier run`)
    }
    const clock = await stripe('POST', '/test_helpers/test_clocks', { frozen_time: now, name: 'billing-coupons' })
    clockId = clock.id
    const customer = await stripe('POST', '/customers', {
      test_clock: clock.id,
      email: 'billing-coupon-probe@example.invalid',
      description: 'LITS coupon guard probe — safe to delete'
    })
    const pm = await stripe('POST', '/payment_methods', { type: 'card', card: { token: 'tok_visa' } })
    await stripe('POST', `/payment_methods/${pm.id}/attach`, { customer: customer.id })
    await stripe('POST', `/customers/${customer.id}`, { invoice_settings: { default_payment_method: pm.id } })

    const upserted = call('linkedin/auth:upsertUser', {
      linkedinId: `lits-coupon-guard-${Date.now().toString(36)}`,
      name: 'Coupon Guard Probe',
      email: 'billing-coupon-probe@example.invalid',
      accessToken: 'probe-not-a-real-token',
      tokenExpiresAt: Date.now() + 10 * 365 * 24 * 3600 * 1000
    })
    if (!upserted.ok) fail(`could not create the probe member — is \`npx convex dev\` running?\n${upserted.error}`)
    probeUserId = upserted.value
    call('billing:setStripeCustomerId', { userId: probeUserId, stripeCustomerId: customer.id })

    // Checkout cannot drive a test-clock customer, so the coupon is attached the way a promotion
    // code attaches it at checkout: a subscription-level discount on the created subscription.
    const sub = await stripe('POST', '/subscriptions', {
      customer: customer.id,
      items: [{ price: PRICE.growth }],
      trial_period_days: 7,
      discounts: [{ coupon: coupon.id }],
      payment_behavior: 'error_if_incomplete',
      metadata: { convexUserId: probeUserId },
      expand: ['items.data.price']
    })
    note(`subscription ${sub.id} — Growth monthly, 7-day trial, coupon attached`)

    const trialRow = await waitFor(
      'row created by the webhook (trialing, growth, month)',
      readSub(sub.id),
      r => r?.status === 'trialing' && r?.tier === 'growth' && r?.priceInterval === 'month'
    )
    check('row belongs to the probe member', trialRow?.userId === probeUserId, trialRow?.userId)

    // The portal half of the fix, as account state. billingNode's portalSession picks by
    // metadata.lits_tier, so a trialing member must find this configuration — and it must have
    // plan switching off, or the switch driven below is a click away in the hosted portal.
    const configs = await stripe('GET', '/billing_portal/configurations?active=true&limit=100')
    const trialConfig = configs.data.find(c => c.metadata?.lits_tier === 'trial')
    check(
      'a trial portal configuration exists',
      Boolean(trialConfig),
      trialConfig?.id ?? 'missing — run scripts/stripe-provision.mjs'
    )
    if (trialConfig) {
      const full = await stripe('GET', `/billing_portal/configurations/${trialConfig.id}`)
      check(
        'the trial configuration disables plan switching',
        full.features?.subscription_update?.enabled === false,
        String(full.features?.subscription_update?.enabled)
      )
    }

    // The coupon itself cannot be price-scoped — Stripe's `applies_to` lists products, and each
    // tier's monthly and annual prices share one product — so monthly-only is enforced on the
    // Checkout session: the promotion-code field must be offered for monthly and hidden for annual.
    heading('Checkout — the promotion-code field is monthly-only')
    const checkoutProbe = call('linkedin/auth:upsertUser', {
      linkedinId: `lits-coupon-checkout-${Date.now().toString(36)}`,
      name: 'Coupon Checkout Probe',
      email: 'billing-coupon-probe@example.invalid',
      accessToken: 'probe-not-a-real-token',
      tokenExpiresAt: Date.now() + 10 * 365 * 24 * 3600 * 1000
    })
    if (!checkoutProbe.ok) fail(`could not create the checkout probe member:\n${checkoutProbe.error}`)
    const checkoutToken = crypto.randomUUID()
    const minted = call('sessions:create', { token: checkoutToken, userId: checkoutProbe.value })
    if (!minted.ok) fail(`could not mint the checkout probe session:\n${minted.error}`)

    for (const [label, priceId, wanted] of [
      ['monthly', PRICE.growth, true],
      ['annual', ANNUAL_PRICE.growth, false]
    ]) {
      const created = call('billingNode:createCheckoutSession', {
        priceId,
        sessionToken: checkoutToken,
        locale: 'en'
      })
      if (!created.ok) {
        check(`the ${label} checkout session is created`, false, errLine(created.error))
        continue
      }
      const sessionId = String(created.value?.url ?? '').match(/cs_(?:test|live)_[A-Za-z0-9]+/)?.[0]
      if (!sessionId) {
        check(`the ${label} checkout session id is readable`, false, String(created.value?.url))
        continue
      }
      openSessions.push(sessionId)
      const session = await stripe('GET', `/checkout/sessions/${sessionId}`)
      check(
        `the ${label} checkout ${wanted ? 'offers' : 'hides'} the promotion-code field`,
        (session.allow_promotion_codes ?? false) === wanted,
        `allow_promotion_codes=${session.allow_promotion_codes}`
      )
    }

    // ── The no-trial trajectory (a returning subscriber) ──
    // No trial means the `once` coupon is consumed by the invoice created WITH the subscription, so
    // it is gone before any plan switch is possible. The switch driven below (same clock, same day)
    // must therefore be CHARGED. This is the other half of "the coupon can only ever discount the
    // first monthly invoice" — and exactly the case a `repeating` coupon gets wrong.
    const cusNoTrial = await stripe('POST', '/customers', {
      test_clock: clock.id,
      email: 'billing-coupon-probe@example.invalid',
      description: 'LITS coupon guard probe (no trial) — safe to delete'
    })
    const pmNoTrial = await stripe('POST', '/payment_methods', { type: 'card', card: { token: 'tok_visa' } })
    await stripe('POST', `/payment_methods/${pmNoTrial.id}/attach`, { customer: cusNoTrial.id })
    await stripe('POST', `/customers/${cusNoTrial.id}`, {
      invoice_settings: { default_payment_method: pmNoTrial.id }
    })
    const subNoTrial = await stripe('POST', '/subscriptions', {
      customer: cusNoTrial.id,
      items: [{ price: PRICE.growth }],
      discounts: [{ coupon: coupon.id }],
      payment_behavior: 'error_if_incomplete',
      expand: ['items.data.price']
    })
    note(`subscription ${subNoTrial.id} — Growth monthly, NO trial, coupon attached`)
    // This customer is deliberately NOT linked to a member row: the no-trial path needs no webhook
    // sync to prove its money, so every assertion below reads Stripe itself.
    await waitForStripe(
      'the no-trial first invoice is the free month, already paid',
      async () => (await invoicesOf(subNoTrial.id))[0],
      inv => inv?.status === 'paid' && inv?.total === 0 && inv?.amount_paid === 0
    )
    await waitForStripe(
      'and the `once` coupon is already consumed',
      () => stripe('GET', `/subscriptions/${subNoTrial.id}`),
      s => (s.discounts ?? []).length === 0
    )

    // ── The switch ──
    heading('Day 3 — portal-equivalent switch to annual while the `once` coupon is unconsumed')
    await advanceTo(clock.id, now + 3 * 86400)
    const switched = await stripe('POST', `/subscriptions/${sub.id}`, {
      items: [{ id: sub.items.data[0].id, price: ANNUAL_PRICE.growth }],
      proration_behavior: 'always_invoice'
    })
    check('switch accepted and the trial kept', switched.status === 'trialing', switched.status)

    const detached = await waitForStripe(
      'the webhook guard detached the coupon',
      () => stripe('GET', `/subscriptions/${sub.id}`),
      s => (s.discounts?.length ?? 0) === 0
    )
    check(
      'the subscription is on the annual price',
      detached?.items?.data?.[0]?.price?.id === ANNUAL_PRICE.growth,
      detached?.items?.data?.[0]?.price?.id
    )
    await waitFor('row mirrors the interval switch (year)', readSub(sub.id), r => r?.priceInterval === 'year', 15)

    // ── The no-trial switch: no coupon left, so annual is charged ──
    heading('The same day — the no-trial member switches with no coupon left to lose')
    await stripe('POST', `/subscriptions/${subNoTrial.id}`, {
      items: [{ id: subNoTrial.items.data[0].id, price: ANNUAL_PRICE.growth }],
      proration_behavior: 'always_invoice'
    })
    const [switchCharge] = await invoicesOf(subNoTrial.id)
    check(
      'the post-free-month switch to annual is charged, not discounted',
      switchCharge?.status === 'paid' &&
        switchCharge.amount_paid === switchCharge.total &&
        switchCharge.total > 0 &&
        (switchCharge.total_discount_amounts ?? []).length === 0,
      `${switchCharge?.status} paid=${switchCharge?.amount_paid} total=${switchCharge?.total}`
    )
    const noTrialAfter = await stripe('GET', `/subscriptions/${subNoTrial.id}?expand[]=items.data.price`)
    check(
      'no discount survives on the annual subscription',
      (noTrialAfter.discounts ?? []).length === 0 && noTrialAfter.items.data[0].price.id === ANNUAL_PRICE.growth,
      `${(noTrialAfter.discounts ?? []).length} discount(s), price ${noTrialAfter.items.data[0].price.id}`
    )

    // ── The money ──
    heading('Trial end — the first invoice after the trial must charge the full annual price')
    await advanceTo(clock.id, sub.trial_end + 3600, 'trial end')
    const annual = await stripe('GET', `/prices/${ANNUAL_PRICE.growth}`)
    const [charge] = await invoicesOf(sub.id)
    check(
      'the trial-end invoice is paid in full',
      charge?.status === 'paid' && charge?.amount_paid === annual.unit_amount,
      `${charge?.status} ${charge?.amount_paid} vs ${annual.unit_amount}`
    )
    check(
      'no discount reached it',
      (charge?.total_discount_amounts ?? []).length === 0,
      JSON.stringify(charge?.total_discount_amounts ?? [])
    )
    await waitFor('row is active after the paid trial-end invoice', readSub(sub.id), r => r?.status === 'active')
  } finally {
    heading('Cleanup')
    if (!clockId) {
      note('nothing created')
    } else if (flag('keep')) {
      note(`kept: test clock ${clockId}, with its customer, subscription and invoices`)
    } else {
      await stripe('DELETE', `/test_helpers/test_clocks/${clockId}`)
      note(`test clock ${clockId} deleted, with its customer, subscription and invoices`)
    }
    if (couponId) {
      await stripe('DELETE', `/coupons/${couponId}`)
      note(`coupon ${couponId} deleted`)
    }
    for (const id of openSessions) {
      try {
        await stripe('POST', `/checkout/sessions/${id}/expire`)
        note(`expired checkout session ${id}`)
      } catch (err) {
        note(`could not expire checkout session ${id}: ${err.message}`)
      }
    }
    if (probeUserId) note(`probe member ${probeUserId} left in the dev DB; harmless, never reused`)
  }
}

// ── Read-only audit ───────────────────────────────────────────────────────────────────────────
// Every Stripe call here is a GET and the Convex read is a sandboxed readonly query, so this is safe
// against a member's real test-mode subscription at any time — including while a downgrade is
// pending, which is exactly when it has something to say.
async function audit(convexUserId) {
  preflight()
  heading(`Read-only audit — convexUserId ${convexUserId}`)

  // Checkout stamps convexUserId on the SUBSCRIPTION, not the customer (billingNode.ts).
  const q = encodeURIComponent(`metadata['convexUserId']:'${convexUserId}'`)
  const found = await stripe('GET', `/subscriptions/search?query=${q}&limit=10&expand[]=data.schedule`)
  if (!found.data?.length) {
    note('No subscription carries that convexUserId — the member has not checked out in this mode')
    note('(or did so before the metadata stamp, or in a sandbox that has since been deleted).')
    // Say what IS here rather than only what is missing: "none at all" and "one under a different id"
    // are different problems, and the difference decides whether a full run is the only way in.
    const all = await stripe('GET', '/subscriptions?status=all&limit=20&expand[]=data.schedule')
    heading(`Every subscription in this mode (${all.data.length}):`)
    if (!all.data.length) note('none — nothing to audit; a full run builds its own')
    for (const s of all.data) {
      const p = s.items.data[0]?.price
      note(
        `${s.id} ${s.status} · ${s.customer} · ${tierOf(p?.id)} ` +
          `$${((p?.unit_amount ?? 0) / 100).toFixed(2)}/${p?.recurring?.interval} · ` +
          `schedule ${scheduleIdOf(s) ?? 'none'} · convexUserId ${s.metadata?.convexUserId ?? 'unstamped'}`
      )
    }
    return
  }

  for (const sub of found.data) {
    const item = sub.items.data[0]
    const periodEnd = periodEndOf(sub)
    const customer = await stripe('GET', `/customers/${sub.customer}`)
    const schedule = sub.schedule && typeof sub.schedule === 'object' ? sub.schedule : null
    // Our row, not Stripe's object — the half a synthetic-customer script could never read. A
    // schedule id and a pendingTier are DIFFERENT states, and only this tells them apart.
    const mirror = query(readSub(sub.id))
    const row = mirror.ok ? mirror.value : undefined

    heading(`${sub.id} — status ${sub.status}, customer ${sub.customer}`)
    const amount = (item.price.unit_amount / 100).toFixed(2)
    note(`item price ${item.price.id} — ${tierOf(item.price.id)} $${amount}/${item.price.recurring.interval}`)
    note(`current_period_end ${new Date(periodEnd * 1000).toISOString()}`)
    note(`customer balance ${customer.balance} (0 = nothing credited)`)
    note(`test clock ${customer.test_clock ?? 'none'}`)
    note(
      mirror.ok
        ? `our row: tier ${row?.tier ?? '—'}, status ${row?.status ?? '—'}, pendingTier ${row?.pendingTier ?? 'none'}`
        : 'our row: unreadable — is `npx convex dev` running? (Stripe-only report below)'
    )

    if (!schedule) {
      console.log('\n  No schedule attached — the undone / never-scheduled shape:')
      check('subscription.schedule is null', scheduleIdOf(sub) === undefined)
      check('customer balance is 0', customer.balance === 0, String(customer.balance))
      // The mirror pointing at a downgrade Stripe no longer holds: BillingPage would promise
      // "Starter from <date>" for a swap that will never happen, and undoing it has nothing to release.
      if (row) check('our row agrees nothing is pending', row.pendingTier === null, String(row.pendingTier))
      continue
    }

    console.log('\n  Schedule attached — the pending-downgrade shape:')
    check('schedule status is active', schedule.status === 'active', schedule.status)
    check('two phases', schedule.phases?.length === 2, `${schedule.phases?.length} phase(s)`)
    const [kept, next] = schedule.phases ?? []
    const nextPrice = next?.items?.[0]?.price
    check('phase 0 keeps the current price', kept?.items?.[0]?.price === item.price.id, kept?.items?.[0]?.price)
    check('phase 1 proration_behavior is "none"', next?.proration_behavior === 'none', next?.proration_behavior)
    check('phase 1 starts at current_period_end', next?.start_date === periodEnd, `${next?.start_date} vs ${periodEnd}`)
    check('item still on the OLD price', item.price.id !== nextPrice, item.price.id)
    check('customer balance is 0', customer.balance === 0, String(customer.balance))
    check('end_behavior is release', schedule.end_behavior === 'release', schedule.end_behavior)
    if (row) {
      // isSpentSchedule's state, in the wild: the swap applied and the release that should have
      // followed never landed. Not an assertion — it is self-healing since 2026-09-09, and the member
      // sees nothing wrong. Worth naming, because before that fix it refused their every upgrade.
      if (row.pendingTier === null) note('SPENT schedule — nothing pending on our row; the next upgrade releases it')
      else check('our row mirrors the pending tier', row.pendingTier === tierOf(nextPrice), row.pendingTier)
    }
  }
}

let aborted = false
try {
  await (USER ? audit(USER) : flag('coupons') ? couponRun() : run())
} catch (err) {
  aborted = true
  // fail() has already printed and set the exit code; anything else is a genuine crash.
  if (process.exitCode !== 1) console.error(err)
  process.exitCode = 1
}

const failed = results.filter(ok => !ok).length
// An abort gets its own verdict: "all 0 checks passed" reads like a clean run, and a run that
// stopped early is exactly when the summary line most needs to say so.
heading(
  aborted
    ? `✗ run aborted after ${results.length} check(s) — ${failed} had already failed`
    : failed
      ? `✗ ${failed} of ${results.length} checks failed`
      : `✓ all ${results.length} checks passed`
)
// `process.exitCode`, never `process.exit()`: forcing the teardown while a pooled keep-alive socket
// is still closing makes Node on Windows abort with `libuv assertion … UV_HANDLE_CLOSING`, which
// replaces this script's verdict with exit 127. Letting the loop drain keeps the exit code honest.
if (failed) process.exitCode = 1
