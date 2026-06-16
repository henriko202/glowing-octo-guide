# Privacy & Compliance — Phase 1: Foundations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> ⚠️ **DO NOT COMMIT TO GIT.** This repo's owner (Henriko) makes **all** commits. Every task ends in
> a **Checkpoint (no commit)** step — run the tests/lint, leave the changes in the working tree, and
> stop for review. Never run `git commit` or `git push`. (Per `CLAUDE.md`.)

> **Plan 1 of 4.** This is the foundations phase of the privacy-compliance program. Phases 2–4
> (DSR export+deletion; consent+retention+dormancy+re-consent; docs+legal) get their own plans,
> authored after this phase lands so they reference the real signatures created here.

**Goal:** Add the schema, the contact-channel capture, and the shared infrastructure (email, audit
log, policy version) that every later privacy feature depends on.

**Architecture:** Pure, testable handler functions (the existing `upsertUserHandler` pattern) plus
thin registered Convex wrappers. New `convex/lib/*` modules are framework-light and unit-tested with
the in-memory `createMockDb` style already used across the backend. No user-facing behavior changes in
this phase except that the user's email (already received from LinkedIn, previously discarded) is now
stored and forwarded to Stripe.

**Tech Stack:** Convex (TypeScript), Vitest (`vitest run` via `pnpm --filter convex test`), Resend
(transactional email), `@convex-dev/stripe`.

**Spec:** `docs/superpowers/specs/2026-06-15-privacy-compliance-design.md` (§2 architecture/schema,
§5.3 email, §2.2 tables).

**Source-of-truth reading before you start:** `convex/_generated/ai/guidelines.md` (Convex API rules
— overrides training data), and the spec above.

---

## File Structure (created/modified in this phase)

| File                                    | Responsibility                                                                            |
| --------------------------------------- | ----------------------------------------------------------------------------------------- |
| `convex/schema.ts` (modify)             | Add `users` privacy fields + `consentRecords` / `dataExportRequests` / `auditLogs` tables |
| `convex/schema.test.ts` (modify)        | Assert the new tables exist                                                               |
| `convex/lib/policy.ts` (create)         | `POLICY_VERSION` constant (single source of truth)                                        |
| `convex/linkedin/auth.ts` (modify)      | Capture `email`/`emailVerified`, stamp `lastLoginAt` + `acknowledgedPolicyVersion`        |
| `convex/linkedin/auth.test.ts` (modify) | Cover the new captured fields                                                             |
| `convex/http.ts` (modify)               | Pass `email`/`emailVerified` from OIDC userinfo into `upsertUser`                         |
| `convex/billing.ts` (modify)            | Send the real `user.email` to Stripe (was `undefined`)                                    |
| `convex/lib/audit.ts` (create)          | `writeAuditLog` helper + `logAudit` internal mutation                                     |
| `convex/lib/audit.test.ts` (create)     | Cover the audit helper                                                                    |
| `convex/lib/email.ts` (create)          | Provider-agnostic `sendEmail` (Resend; no-ops if unconfigured)                            |
| `convex/lib/email.test.ts` (create)     | Cover send + skip-when-unconfigured                                                       |
| `docs/PLATFORM.md` (modify)             | §5 data model, §16 env vars, new §13B Privacy & Compliance                                |

**Test commands** (from repo root):

- Whole convex suite: `pnpm --filter convex test`
- A single file: `pnpm --filter convex test <substring>` (e.g. `pnpm --filter convex test schema`)
- A single test: add `-t "<test name>"`
- Lint everything: `pnpm lint`

---

## Task 1: Schema — privacy fields + three new tables

**Files:**

- Modify: `convex/schema.ts` (the `users` table, and the `defineSchema({...})` object)
- Test: `convex/schema.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test to `convex/schema.test.ts` inside the existing `describe('schema', () => { ... })` block:

```ts
it('defines the privacy & compliance tables', () => {
  const tables = schema.tables
  expect(tables).toHaveProperty('consentRecords')
  expect(tables).toHaveProperty('dataExportRequests')
  expect(tables).toHaveProperty('auditLogs')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter convex test schema`
Expected: FAIL — the new `it('defines the privacy & compliance tables')` fails because
`tables` has no `consentRecords` property.

- [ ] **Step 3: Add the new `users` fields**

In `convex/schema.ts`, inside `users: defineTable({ ... })`, insert the privacy fields immediately
**before** `createdAt: v.number()`. The region should read:

```ts
    bannedReason: v.optional(v.string()),
    // ─── Privacy & compliance ────────────────────────────────────────────────
    // Contact channel captured from the LinkedIn OIDC `email` claim (previously discarded).
    // Used for DSR confirmations and breach notification. Stored under legitimate interest /
    // legal obligation, NOT marketing consent.
    email: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
    // Account-deletion lifecycle (self-service erasure + dormancy). Presence of
    // `deletionScheduledAt` means the account is pending hard-deletion by the cron.
    deletionRequestedAt: v.optional(v.number()),
    deletionScheduledAt: v.optional(v.number()),
    deletionReason: v.optional(v.union(v.literal('user_request'), v.literal('dormancy'))),
    // Set on each login (in upsertUser); powers the dormancy retention check.
    lastLoginAt: v.optional(v.number()),
    // The privacy-policy version this user last acknowledged (drives the re-consent prompt).
    acknowledgedPolicyVersion: v.optional(v.string()),
    createdAt: v.number()
  })
```

- [ ] **Step 4: Add the three new tables**

In `convex/schema.ts`, add a comma after the `postQueue` table's final `.index(...)`, then add the
three tables before the closing `})` of `defineSchema`. The region should read:

```ts
    .index('by_author', ['authorId'])
    .index('by_urn', ['linkedinPostUrn']),

  // Append-only consent/withdrawal log. Current effective consent for a purpose is the
  // latest record for (userId, purpose). 'location_enrichment' is reserved for future use
  // (the Apify profile scrape is disabled at launch — see spec §4.4).
  consentRecords: defineTable({
    userId: v.id('users'),
    purpose: v.union(v.literal('marketing'), v.literal('analytics')),
    granted: v.boolean(),
    policyVersion: v.string(),
    createdAt: v.number()
  })
    .index('by_user', ['userId'])
    .index('by_user_and_purpose', ['userId', 'purpose']),

  // Tracks asynchronous data-export jobs. The generated bundle is held in Convex file
  // storage; the link expires (fileStorageId/expiresAt) and is purged by the retention cron.
  dataExportRequests: defineTable({
    userId: v.id('users'),
    status: v.union(v.literal('pending'), v.literal('ready'), v.literal('failed'), v.literal('expired')),
    requestedAt: v.number(),
    fileStorageId: v.optional(v.id('_storage')),
    expiresAt: v.optional(v.number())
  }).index('by_user', ['userId']),

  // Accountability log (GDPR Art. 5(2)) for DSR actions, consent changes, and admin access
  // to personal data. A pseudonymized subset is retained past account deletion.
  auditLogs: defineTable({
    actor: v.union(v.literal('user'), v.literal('admin'), v.literal('system')),
    actorId: v.optional(v.id('users')),
    action: v.string(),
    targetUserId: v.optional(v.id('users')),
    metadata: v.optional(v.string()),
    createdAt: v.number()
  })
    .index('by_target', ['targetUserId'])
    .index('by_created', ['createdAt'])
})
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter convex test schema`
Expected: PASS — both `it(...)` tests in `schema.test.ts` pass.

- [ ] **Step 6: Checkpoint (no commit)**

Run `pnpm --filter convex test` (whole suite still green) and `pnpm lint`. Leave changes in the
working tree for Henriko to review and commit. **Do not commit.**

---

## Task 2: `POLICY_VERSION` + capture email / lastLoginAt / policy ack in `upsertUser`

**Files:**

- Create: `convex/lib/policy.ts`
- Modify: `convex/linkedin/auth.ts`
- Modify: `convex/http.ts` (the `/auth/linkedin/callback` handler, around lines 74–82)
- Test: `convex/linkedin/auth.test.ts`

- [ ] **Step 1: Create the policy-version constant**

Create `convex/lib/policy.ts`:

```ts
// convex/lib/policy.ts
// Single source of truth for the current published privacy-policy version.
// Bump this string (and the policy text) whenever the privacy policy materially
// changes — users whose `acknowledgedPolicyVersion` differs are re-prompted to
// acknowledge on next login (re-consent flow lands in Phase 3).
export const POLICY_VERSION = '2026-06-15'
```

- [ ] **Step 2: Write the failing tests**

In `convex/linkedin/auth.test.ts`, add the import at the top (below the existing import):

```ts
import { POLICY_VERSION } from '../lib/policy'
```

Then add these two tests inside the `describe('upsertUserHandler', () => { ... })` block:

```ts
it('stores email, lastLoginAt, and acknowledged policy version for a new user', async () => {
  const db = createMockDb()
  await upsertUserHandler(db, { ...BASE_ARGS, email: 'jane@example.com', emailVerified: true })
  const inserted = db._inserts[0]
  expect(inserted.email).toBe('jane@example.com')
  expect(inserted.emailVerified).toBe(true)
  expect(inserted.lastLoginAt).toBeGreaterThan(0)
  expect(inserted.acknowledgedPolicyVersion).toBe(POLICY_VERSION)
})

it('refreshes lastLoginAt and email on an existing-user login', async () => {
  const existing = { _id: 'existing-id', linkedinId: 'li-123', tier: 'pro', subscriptionStatus: 'active' }
  const db = createMockDb(existing)
  await upsertUserHandler(db, { ...BASE_ARGS, email: 'new@example.com' })
  expect(db._patches[0].data.lastLoginAt).toBeGreaterThan(0)
  expect(db._patches[0].data.email).toBe('new@example.com')
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter convex test auth.test`
Expected: FAIL — `inserted.email` is `undefined` (handler doesn't store it yet).

- [ ] **Step 4: Update the handler and registered mutation**

In `convex/linkedin/auth.ts`:

(a) Add the import at the top:

```ts
import { POLICY_VERSION } from '../lib/policy.js'
```

(b) Extend `UpsertUserArgs`:

```ts
export interface UpsertUserArgs {
  linkedinId: string
  name: string
  headline?: string
  profilePictureUrl?: string
  accessToken: string
  refreshToken?: string // LinkedIn standard OAuth may omit refresh_token
  tokenExpiresAt: number
  email?: string
  emailVerified?: boolean
}
```

(c) In `upsertUserHandler`, update the **existing-user** patch to include email + lastLoginAt:

```ts
if (existing) {
  const patch: Record<string, unknown> = {
    // SECURITY: isAdmin is intentionally excluded — it can only be set directly in the DB
    name: args.name,
    headline: args.headline,
    profilePictureUrl: args.profilePictureUrl,
    linkedinAccessToken: args.accessToken,
    linkedinRefreshToken: args.refreshToken,
    tokenExpiresAt: args.tokenExpiresAt,
    email: args.email,
    emailVerified: args.emailVerified,
    lastLoginAt: Date.now()
  }
  await db.patch(existing._id, patch)
  return existing._id
}
```

(d) Update the **new-user** insert to include email, lastLoginAt, and the acknowledged policy version:

```ts
const trialEndsAt = Date.now() + TRIAL_DURATION_MS
return await db.insert('users', {
  // SECURITY: isAdmin is intentionally excluded — only settable via direct DB edit
  linkedinId: args.linkedinId,
  name: args.name,
  headline: args.headline,
  profilePictureUrl: args.profilePictureUrl,
  tier: 'starter' as const,
  subscriptionStatus: 'trialing' as const,
  trialEndsAt,
  linkedinAccessToken: args.accessToken,
  linkedinRefreshToken: args.refreshToken,
  tokenExpiresAt: args.tokenExpiresAt,
  email: args.email,
  emailVerified: args.emailVerified,
  lastLoginAt: Date.now(),
  acknowledgedPolicyVersion: POLICY_VERSION,
  createdAt: Date.now()
})
```

(e) Extend the registered mutation's `args` validators:

```ts
export const upsertUser = internalMutation({
  args: {
    linkedinId: v.string(),
    name: v.string(),
    headline: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()), // optional — LinkedIn may not return it
    tokenExpiresAt: v.number(),
    email: v.optional(v.string()),
    emailVerified: v.optional(v.boolean())
  },
  handler: async (ctx, args) => upsertUserHandler(ctx.db as unknown as UpsertDb, args as UpsertUserArgs)
})
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter convex test auth.test`
Expected: PASS — all four `upsertUserHandler` tests pass.

- [ ] **Step 6: Wire the OIDC email through the OAuth callback**

In `convex/http.ts`, in the `/auth/linkedin/callback` handler, update the `upsertUser` call (currently
~lines 74–82) to pass the email claims:

```ts
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
```

(No change needed in `convex/linkedin/oauth.ts` — `fetchLinkedInUserInfo` already returns `email` /
`email_verified`, and `LinkedInUserInfo` already types them.)

- [ ] **Step 7: Verify the suite + lint**

Run: `pnpm --filter convex test` then `pnpm lint`
Expected: PASS / no warnings. (`http.ts` is an `httpAction` wired to LinkedIn and has no unit test by
design — it is covered by the handler tests it delegates to plus lint/typecheck.)

- [ ] **Step 8: Checkpoint (no commit)**

Leave changes in the working tree for review. **Do not commit.**

---

## Task 3: Forward the real email to Stripe

**Files:**

- Modify: `convex/billing.ts` (line 32, inside `createCheckoutSession`)

> Note: `billing.ts` wraps the `@convex-dev/stripe` component as a Convex `action` (no plain handler
> and no existing unit test), so this one-line field change is verified by the suite + lint rather
> than a brittle Stripe mock. `user` is the record returned by `requireAuthAction`, which now includes
> `email` after Task 1's schema change.

- [ ] **Step 1: Make the change**

In `convex/billing.ts`, in `createCheckoutSession`, change the `getOrCreateCustomer` call:

```ts
// Get or create Stripe customer via the component
const customer = await stripeClient.getOrCreateCustomer(ctx, {
  userId: user._id,
  email: user.email,
  name: user.name
})
```

- [ ] **Step 2: Verify the suite + lint**

Run: `pnpm --filter convex test` then `pnpm lint`
Expected: PASS / no warnings.

- [ ] **Step 3: Checkpoint (no commit)**

Leave changes in the working tree for review. **Do not commit.**

---

## Task 4: Audit-log helper

**Files:**

- Create: `convex/lib/audit.ts`
- Test: `convex/lib/audit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `convex/lib/audit.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { writeAuditLog } from './audit'

function createMockDb() {
  const inserts: any[] = []
  return {
    insert: async (table: string, doc: any) => {
      inserts.push({ table, doc })
      return 'audit-id'
    },
    _inserts: inserts
  }
}

describe('writeAuditLog', () => {
  it('inserts an auditLogs row with a timestamp and the given fields', async () => {
    const db = createMockDb()
    await writeAuditLog(db, {
      actor: 'user',
      actorId: 'u1',
      action: 'export.requested',
      targetUserId: 'u1'
    })
    expect(db._inserts).toHaveLength(1)
    expect(db._inserts[0].table).toBe('auditLogs')
    expect(db._inserts[0].doc.actor).toBe('user')
    expect(db._inserts[0].doc.action).toBe('export.requested')
    expect(db._inserts[0].doc.targetUserId).toBe('u1')
    expect(db._inserts[0].doc.createdAt).toBeGreaterThan(0)
  })

  it('works with only the required fields', async () => {
    const db = createMockDb()
    await writeAuditLog(db, { actor: 'system', action: 'retention.tokenNulled' })
    expect(db._inserts[0].doc.actor).toBe('system')
    expect(db._inserts[0].doc.actorId).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter convex test audit`
Expected: FAIL — cannot import `writeAuditLog` (module does not exist).

- [ ] **Step 3: Create the helper**

Create `convex/lib/audit.ts`:

```ts
// convex/lib/audit.ts
// Accountability log helper (GDPR Art. 5(2)). Call writeAuditLog from inside any mutation
// handler that has ctx.db; use the logAudit internal mutation from actions via ctx.runMutation.
// NEVER put secrets or raw tokens in `metadata`.
// NOTE: unit-tested Convex files import the generic from 'convex/server' (the vitest mock
// aliases it), matching convex/linkedin/auth.ts — NOT from './_generated/server'.
import { internalMutationGeneric as internalMutation } from 'convex/server'
import { v } from 'convex/values'

export interface AuditEntry {
  actor: 'user' | 'admin' | 'system'
  actorId?: string
  action: string
  targetUserId?: string
  metadata?: string
}

interface AuditInsertDb {
  insert(table: string, doc: Record<string, unknown>): Promise<string>
}

export async function writeAuditLog(db: AuditInsertDb, entry: AuditEntry): Promise<void> {
  await db.insert('auditLogs', {
    actor: entry.actor,
    actorId: entry.actorId,
    action: entry.action,
    targetUserId: entry.targetUserId,
    metadata: entry.metadata,
    createdAt: Date.now()
  })
}

export const logAudit = internalMutation({
  args: {
    actor: v.union(v.literal('user'), v.literal('admin'), v.literal('system')),
    actorId: v.optional(v.id('users')),
    action: v.string(),
    targetUserId: v.optional(v.id('users')),
    metadata: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await writeAuditLog(ctx.db as unknown as AuditInsertDb, args as AuditEntry)
  }
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter convex test audit`
Expected: PASS — both tests pass.

- [ ] **Step 5: Checkpoint (no commit)**

Run `pnpm lint`. Leave changes in the working tree for review. **Do not commit.**

---

## Task 5: Transactional email wrapper (Resend)

**Files:**

- Create: `convex/lib/email.ts`
- Test: `convex/lib/email.test.ts`

- [ ] **Step 1: Write the failing test**

Create `convex/lib/email.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { sendEmail } from './email'

describe('sendEmail', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('no-ops (skipped) when RESEND_API_KEY / EMAIL_FROM are unset', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('EMAIL_FROM', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendEmail({ to: 'a@b.com', subject: 's', html: '<p>x</p>' })

    expect(result.skipped).toBe(true)
    expect(result.sent).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('POSTs to Resend with auth + from header when configured', async () => {
    vi.stubEnv('RESEND_API_KEY', 'key_123')
    vi.stubEnv('EMAIL_FROM', 'noreply@linkintothessi.com')
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'e1' }) }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendEmail({ to: 'a@b.com', subject: 'Hi', html: '<p>x</p>' })

    expect(result.sent).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, opts] = fetchMock.mock.calls[0] as [string, any]
    expect(url).toBe('https://api.resend.com/emails')
    expect(opts.headers.Authorization).toBe('Bearer key_123')
    const body = JSON.parse(opts.body)
    expect(body.from).toBe('noreply@linkintothessi.com')
    expect(body.to).toBe('a@b.com')
    expect(body.subject).toBe('Hi')
  })

  it('throws a generic error when Resend responds non-ok', async () => {
    vi.stubEnv('RESEND_API_KEY', 'key_123')
    vi.stubEnv('EMAIL_FROM', 'noreply@linkintothessi.com')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 422, text: async () => 'bad request' }))
    )

    await expect(sendEmail({ to: 'a@b.com', subject: 's', html: '<p>x</p>' })).rejects.toThrow('Failed to send email')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter convex test email`
Expected: FAIL — cannot import `sendEmail` (module does not exist).

- [ ] **Step 3: Create the wrapper**

Create `convex/lib/email.ts`:

```ts
// convex/lib/email.ts
// Provider-agnostic transactional email. Backed by Resend. When RESEND_API_KEY or
// EMAIL_FROM is unset (local dev / tests / unconfigured prod), it no-ops so privacy
// flows never fail merely because email isn't configured — the caller decides whether
// a skipped send matters. The real upstream error is logged server-side; callers get
// a generic error.
export interface SendEmailArgs {
  to: string
  subject: string
  html: string
  text?: string
}

export interface SendEmailResult {
  sent: boolean
  skipped?: boolean
}

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    console.warn('[email] RESEND_API_KEY/EMAIL_FROM unset — skipping send to', args.to)
    return { sent: false, skipped: true }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text
    })
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`[email] Resend send failed: ${res.status}`, body)
    throw new Error('Failed to send email')
  }
  return { sent: true }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter convex test email`
Expected: PASS — all three tests pass.

- [ ] **Step 5: Checkpoint (no commit)**

Run `pnpm lint`. Leave changes in the working tree for review. **Do not commit.**

---

## Task 6: Documentation — keep `docs/PLATFORM.md` in sync

> Per `CLAUDE.md`, docs are part of "done". This is a docs-only task (no automated test); verification
> is a careful re-read plus the search in Step 5.

**Files:**

- Modify: `docs/PLATFORM.md` (§5 Data Model, §16 Environment Variables, Table of Contents, and a new
  §13B section)

- [ ] **Step 1: Add the new `users` fields to the §5 `users` table reference**

In `docs/PLATFORM.md` §5, in the `#### users` field table, add these rows after the `bannedReason`
row (before `createdAt`):

```markdown
| `email` | string | – | Contact channel from the OIDC `email` claim. DSR + breach notice. |
| `emailVerified` | boolean | – | From the OIDC `email_verified` claim. |
| `deletionRequestedAt` | number | – | When the user requested account deletion. |
| `deletionScheduledAt` | number | – | Hard-delete due time; presence ⇒ pending deletion. |
| `deletionReason` | `'user_request'\|'dormancy'` | – | Distinguishes self-service vs dormancy deletion. |
| `lastLoginAt` | number | – | Set on each login; powers the dormancy retention check. |
| `acknowledgedPolicyVersion` | string | – | Last privacy-policy version the user acknowledged. |
```

- [ ] **Step 2: Add the three new tables to §5**

In `docs/PLATFORM.md` §5, after the existing table subsections, add:

```markdown
#### `consentRecords` — append-only consent/withdrawal log

Latest record per `(userId, purpose)` is the effective consent. `purpose ∈ {marketing, analytics}`
(`location_enrichment` reserved for future). Fields: `userId`, `purpose`, `granted`, `policyVersion`,
`createdAt`. Indexes: `by_user [userId]`, `by_user_and_purpose [userId, purpose]`.

#### `dataExportRequests` — async data-export job tracking

Fields: `userId`, `status ∈ {pending, ready, failed, expired}`, `requestedAt`, `fileStorageId?`
(Convex storage id), `expiresAt?`. Index: `by_user [userId]`.

#### `auditLogs` — accountability log (GDPR Art. 5(2))

Fields: `actor ∈ {user, admin, system}`, `actorId?`, `action`, `targetUserId?`, `metadata?` (JSON
string, no secrets), `createdAt`. Indexes: `by_target [targetUserId]`, `by_created [createdAt]`.
Retained (pseudonymized) past account deletion.
```

- [ ] **Step 3: Update the table count references in §5 and §4**

In `docs/PLATFORM.md`, update the table count from 10 to **13**:

- §5 intro line "There are **10 tables**." → "There are **13 tables**."
- §4 repo-layout comment `schema.ts # 10-table database schema` → `# 13-table database schema`.
- §2 architecture Mermaid node `DB[("Convex DB<br/>10 tables")]` → `13 tables`.

- [ ] **Step 4: Add the env vars to §16 and a new §13B section + TOC entry**

(a) In §16, in the **Convex backend** env-var table, add:

```markdown
| `RESEND_API_KEY` | – (email no-ops if unset) | `lib/email.ts` | Resend API key for transactional email (DSR + breach notices). |
| `EMAIL_FROM` | – (email no-ops if unset) | `lib/email.ts` | From-address for transactional email. |
```

(b) Add a Table-of-Contents entry after the `13A.` line:

```markdown
13B. [Privacy & Compliance](#13b-privacy--compliance)
```

(c) Add the new section after §13A (before §14):

```markdown
## 13B. Privacy & Compliance

> Implements the design spec `docs/superpowers/specs/2026-06-15-privacy-compliance-design.md`.
> **Phase 1 (Foundations)** is in place; later phases (DSR export/deletion, consent/retention,
> legal artifacts) extend this section.

### Foundations (Phase 1)

- **Email capture:** `linkedin/auth.upsertUser` now stores `email`/`emailVerified` from the OIDC
  userinfo (previously discarded) and forwards the address to Stripe (`billing.ts`). Email is stored
  under legitimate interest / legal obligation (contact channel for rights + breach notice), not
  marketing consent.
- **Login + policy stamping:** `upsertUser` sets `lastLoginAt` on every login and stamps new users
  with the current `POLICY_VERSION` (`lib/policy.ts`) so they are not re-prompted.
- **New tables:** `consentRecords` (append-only consent log), `dataExportRequests` (async export
  jobs), `auditLogs` (accountability — `lib/audit.ts`).
- **Email infra:** `lib/email.ts` wraps Resend and no-ops when unconfigured.
- **Apify note:** the LinkedIn scrape stays **disabled** in production (kill-switches off). Turning it
  on requires adding the privacy disclosure + legal basis + sub-processor entry in the same change
  (spec §4.4).
```

- [ ] **Step 5: Verify no stale "10 tables" references remain**

Run (PowerShell): search the doc for stragglers — `Select-String -Path docs/PLATFORM.md -Pattern '10 tables','10-table'`
Expected: no matches. Re-read §5 and §16 to confirm the additions render as valid Markdown tables.

- [ ] **Step 6: Checkpoint (no commit)**

Leave changes in the working tree for review. **Do not commit.**

---

## Phase 1 completion check

- [ ] **Run the full suite + lint**

Run: `pnpm --filter convex test` then `pnpm lint`
Expected: all tests PASS; zero lint warnings.

- [ ] **Confirm deliverables**

- `convex/schema.ts` has the 7 new `users` fields + 3 new tables (with indexes).
- `convex/lib/policy.ts`, `convex/lib/audit.ts`, `convex/lib/email.ts` exist and are tested.
- `upsertUser` stores email/`lastLoginAt`/`acknowledgedPolicyVersion`; `http.ts` passes the OIDC
  email; `billing.ts` forwards `user.email` to Stripe.
- `docs/PLATFORM.md` reflects all of the above (§5, §16, §13B, TOC, table count = 13).
- **Nothing committed** — all changes left in the working tree for Henriko.

---

## Self-Review (performed during authoring)

- **Spec coverage:** Phase 1 of spec §9 = schema changes (✅ Task 1), email infra + capture email in
  `upsertUser` + Stripe (✅ Tasks 2–3, 5), `auditLogs`/audit helper (✅ Tasks 1, 4), `POLICY_VERSION`
  (✅ Task 2), PLATFORM.md (✅ Task 6). The `lastLoginAt` and `acknowledgedPolicyVersion`/`deletionReason`
  fields needed by Phases 2–3 are added here so later phases don't require a second schema migration.
- **Placeholder scan:** no TBD/TODO; every code step shows complete code.
- **Type consistency:** `UpsertUserArgs` (email?, emailVerified?) matches the registered validators and
  the `http.ts` caller; `AuditEntry` matches `writeAuditLog`/`logAudit`; `SendEmailArgs`/`SendEmailResult`
  match the tests; schema field/table names match every reference in the spec and PLATFORM.md edits.
- **No-commit rule:** every task ends in an explicit no-commit checkpoint (overrides the skill's
  default commit step, per `CLAUDE.md`).

```

```
