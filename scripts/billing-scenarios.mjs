// scripts/billing-scenarios.mjs — everything stripe-downgrade-proof.mjs could NOT prove, because a
// synthetic Stripe customer matches no member and so our own code never runs. TEST MODE ONLY.
//
//   node scripts/billing-scenarios.mjs           full run, deletes the test clock afterwards
//   node scripts/billing-scenarios.mjs --keep    keep the clock (and its customer/subscription)
//
// The other script drives the Stripe API directly and answers "does Stripe behave?". This one drives
// OUR public actions through the Convex CLI and answers "does the platform behave?" — the guards, the
// pending-downgrade mirror, and the webhook half (syncUserSubscription → releaseSubscriptionSchedule).
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
//
// NOT COVERED, deliberately: past_due/dunning (needs a failing card and repeated advances),
// invoice.payment_failed, the featured-post one-time checkout, the duplicate-subscription guard, and
// endTrialEarly's 50-interaction TRIGGER — reaching 50 needs 50 real interactions. What that trigger
// then DOES is covered: the conversion step below sets trial_end 'now' on a live trialing
// subscription, which is endTrialEarly's one line verbatim, and asserts the card is charged (the row
// moves to `active`). Each of the others needs machinery worth more than the coverage.
//
// ponytail: the Stripe form encoder and the assertion helpers below are a third copy (see
// stripe-provision.mjs and stripe-downgrade-proof.mjs). Both of those run their whole flow at import,
// so neither can be imported for its helpers; extracting a shared module would mean editing the
// live-mode provisioning tool, which is not worth a DRY win. Extract if a fourth copy ever appears.

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
const PRICE = {
  starter: readEnv('.env.local', 'STRIPE_STARTER_PRICE_ID'),
  growth: readEnv('.env.local', 'STRIPE_GROWTH_PRICE_ID'),
  pro: readEnv('.env.local', 'STRIPE_PRO_PRICE_ID')
}

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

    heading('Converting the trial (trial_end: now — what endTrialEarly does)')
    await stripe('POST', `/subscriptions/${sub.id}`, { trial_end: 'now' })
    await waitFor('row status moved to active', readSub(sub.id), r => r?.status === 'active')

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

    // ── S8 the webhook half ──
    heading('S8 the webhook half — the swap lands, our code clears up after it')
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
    await waitFor('row tier moved to starter', readSub(sub.id), r => r?.tier === 'starter')
    await waitFor('row pendingTier cleared by the sync', readSub(sub.id), r => r?.pendingTier === null, 15)
    await waitFor('users.tier moved to starter', readUser(userId), u => u?.tier === 'starter', 15)
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

let aborted = false
try {
  await run()
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
