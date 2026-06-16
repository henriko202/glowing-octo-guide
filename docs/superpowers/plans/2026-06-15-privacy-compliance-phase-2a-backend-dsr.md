# Privacy & Compliance — Phase 2a: Backend Data-Subject Rights — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> ⚠️ **DO NOT COMMIT TO GIT.** The repo owner (Henriko) makes all commits. Every task ends in a
> **Checkpoint (no commit)**. Never run `git commit`/`git push`. (Per `CLAUDE.md`.)

> ⚠️ **Requires Phase 1 to be committed AND `convex/_generated` regenerated** (run `pnpm dev:convex`
> once) so `Doc<'users'>` includes `email`/`deletionScheduledAt`/etc. and the new tables are typed.

> **Plan 2a of the program.** Backend DSR only. Phase 2b (frontend: Privacy & Data page,
> `CancelDeletionScreen`, `RequireAuth` interception) is a separate plan authored after this lands.

**Goal:** Implement the backend for self-service **data export** (right of access / portability) and
the **30-day account-deletion lifecycle** (right to erasure), including the cron cascade, immediate
Stripe cancellation, feed exclusion, and the transactional emails.

**Architecture:** Convex `query`/`mutation`/`action` + a daily cron. The logic that matters lives in
**pure, unit-tested helpers** (`buildExportBundle`, `isAuthorFeedEligible`, `cascadeDeleteUser`,
email templates); registered Convex functions are thin wrappers (integration-noted where a unit test
would require mocking Convex storage/Stripe). Deletion auth uses `resolveSession` (NOT `requireAuth`)
so a **banned user can still exercise erasure**. Removing a pending-deletion user's posts from the
feed is a one-predicate filter (auto-restores on cancel) — no post mutation.

**Tech Stack:** Convex (TypeScript), Vitest (`pnpm --filter convex test`), `stripe` SDK (already a
convex dependency), Resend via `convex/lib/email.ts` (Phase 1), `convex/lib/audit.ts` (Phase 1),
`convex/lib/policy.ts` (Phase 1).

**Spec:** `docs/superpowers/specs/2026-06-15-privacy-compliance-design.md` §3 (DSR engine), §3.2
(deletion lifecycle + cascade map), §6 (error handling), §8 (security).

**Read first:** `convex/_generated/ai/guidelines.md` (Convex rules) and the spec.

---

## Conventions in this codebase (verified)

- Registered fns import from `./_generated/server`; this resolves through the mocked `convex/server`
  in Vitest, so test files that import a module which imports `./_generated/server` still run
  (`feed.test.ts`, `users.test.ts` do exactly this).
- **Unit-test the pure helpers**, not the registered wrappers (pattern: `countPostsSince`,
  `buildFeedFilter`, `toSafeMe`). Use the in-memory `createMockDb` style from
  `convex/linkedin/auth.test.ts`.
- No `any` in source (`eslint . --max-warnings 0`); use `as unknown as` casts like `auth.ts`.
- Reads soft-fail (`null`/`[]`); writes throw.
- Cron batching pattern: `convex/jobs/processQueue.ts` (take a batch, reschedule self if full).
- Rate limiting: `checkRateLimit(ctx, userId, action, maxPerWindow, windowMs, windowLabel)` throws on
  exceed (see `users.refreshProfileFromLinkedIn`); admins are exempt at the call site.

**Test commands:** `pnpm --filter convex test [substring]`; lint `pnpm lint`; format check
`npx prettier --check "<files>"`.

---

## File Structure

| File                                       | Responsibility                                                                                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `convex/privacy/emails.ts` (create)        | Pure email-template builders (`exportReadyEmail`, `deletionScheduledEmail`, `deletionCompletedEmail`)                                         |
| `convex/privacy/emails.test.ts` (create)   | Template tests                                                                                                                                |
| `convex/privacy/export.ts` (create)        | `buildExportBundle` (pure) + `gatherUserData` (internalQuery) + `requestDataExport`/`generateExport`/`getExportStatus`/`getExportDownloadUrl` |
| `convex/privacy/export.test.ts` (create)   | `buildExportBundle` tests (secret-stripping, audit redaction, owner-scoping)                                                                  |
| `convex/privacy/deletion.ts` (create)      | `cascadeDeleteUser` (pure) + `requestAccountDeletion`/`cancelAccountDeletion`/`onDeletionRequested`/`processAccountDeletions`                 |
| `convex/privacy/deletion.test.ts` (create) | `cascadeDeleteUser` tests (every table covered, audit pseudonymized, storage files deleted)                                                   |
| `convex/feed.ts` (modify)                  | Extract `isAuthorFeedEligible` pure helper; use it in the eligibility filter                                                                  |
| `convex/feed.test.ts` (modify)             | `isAuthorFeedEligible` tests                                                                                                                  |
| `convex/crons.ts` (modify)                 | Register `processAccountDeletions` (daily)                                                                                                    |
| `docs/PLATFORM.md` (modify)                | Extend §13B (export + deletion) + add cron to §13 + deletion Mermaid                                                                          |

---

## Task 1: Email templates (pure)

**Files:** Create `convex/privacy/emails.ts`, `convex/privacy/emails.test.ts`

- [ ] **Step 1: Write the failing test** — `convex/privacy/emails.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { exportReadyEmail, deletionScheduledEmail, deletionCompletedEmail } from './emails'

describe('privacy email templates', () => {
  it('exportReadyEmail includes the app name and a body', () => {
    const m = exportReadyEmail()
    expect(m.subject).toMatch(/export/i)
    expect(m.html).toContain('Link Into The SSI')
    expect(m.text.length).toBeGreaterThan(0)
  })

  it('deletionScheduledEmail states the deletion date', () => {
    const m = deletionScheduledEmail('June 30, 2026')
    expect(m.subject).toMatch(/deletion/i)
    expect(m.html).toContain('June 30, 2026')
    expect(m.text).toContain('June 30, 2026')
  })

  it('deletionCompletedEmail confirms removal', () => {
    const m = deletionCompletedEmail()
    expect(m.subject).toMatch(/deleted/i)
    expect(m.html).toContain('Link Into The SSI')
  })
})
```

- [ ] **Step 2: Run, confirm FAIL** — `pnpm --filter convex test emails` (cannot import module).

- [ ] **Step 3: Implement** — `convex/privacy/emails.ts`:

```ts
// convex/privacy/emails.ts
// Pure transactional-email template builders for privacy/DSR flows. No I/O — return
// { subject, html, text } for convex/lib/email.ts:sendEmail to deliver. Keep copy plain;
// these are legal/operational notices, not marketing.
export interface EmailContent {
  subject: string
  html: string
  text: string
}

const APP = 'Link Into The SSI'

export function exportReadyEmail(): EmailContent {
  const subject = `Your ${APP} data export is ready`
  const text = `Your data export is ready. Sign in to ${APP} and open Settings → Privacy & Data to download it. The download link expires in 7 days.`
  const html = `<p>Your data export is ready.</p><p>Sign in to <strong>${APP}</strong> and open <strong>Settings → Privacy &amp; Data</strong> to download it.</p><p>The download link expires in 7 days.</p>`
  return { subject, html, text }
}

export function deletionScheduledEmail(deletionDate: string): EmailContent {
  const subject = `Your ${APP} account is scheduled for deletion`
  const text = `We received a request to delete your ${APP} account. Your data will be permanently deleted on ${deletionDate}. If this was a mistake, sign in again before then to cancel. Required billing records are retained in anonymized form as the law requires.`
  const html = `<p>We received a request to delete your <strong>${APP}</strong> account.</p><p>Your data will be permanently deleted on <strong>${deletionDate}</strong>. If this was a mistake, sign in again before then to cancel.</p><p>Required billing records are retained in anonymized form as the law requires.</p>`
  return { subject, html, text }
}

export function deletionCompletedEmail(): EmailContent {
  const subject = `Your ${APP} account has been deleted`
  const text = `Your ${APP} account and personal data have been permanently deleted. Required billing records are retained in anonymized form as the law requires. Thank you for using ${APP}.`
  const html = `<p>Your <strong>${APP}</strong> account and personal data have been permanently deleted.</p><p>Required billing records are retained in anonymized form as the law requires.</p><p>Thank you for using ${APP}.</p>`
  return { subject, html, text }
}
```

- [ ] **Step 4: Run, confirm PASS** — `pnpm --filter convex test emails`.
- [ ] **Step 5: Checkpoint (NO COMMIT).**

---

## Task 2: Feed excludes pending-deletion authors

**Files:** Modify `convex/feed.ts`, `convex/feed.test.ts`

- [ ] **Step 1: Write the failing test** — add to `convex/feed.test.ts` (import `isAuthorFeedEligible` from `./feed`; add the import to the existing import line):

```ts
import { describe, it, expect } from 'vitest'
import { isAuthorFeedEligible } from './feed'

describe('isAuthorFeedEligible', () => {
  it('includes an active author', () => {
    expect(isAuthorFeedEligible({ subscriptionStatus: 'active' })).toBe(true)
  })
  it('excludes a trialing author', () => {
    expect(isAuthorFeedEligible({ subscriptionStatus: 'active', deletionScheduledAt: undefined })).toBe(true)
    expect(isAuthorFeedEligible({ subscriptionStatus: 'trialing' })).toBe(false)
  })
  it('excludes an author pending deletion', () => {
    expect(isAuthorFeedEligible({ subscriptionStatus: 'active', deletionScheduledAt: 123 })).toBe(false)
  })
  it('excludes a missing author', () => {
    expect(isAuthorFeedEligible(null)).toBe(false)
  })
})
```

> If `convex/feed.test.ts` already imports `{ describe, it, expect }` and `buildFeedFilter`, just add
> `isAuthorFeedEligible` to that existing import from `./feed` and append the new `describe` block —
> don't duplicate the vitest import.

- [ ] **Step 2: Run, confirm FAIL** — `pnpm --filter convex test feed` (no `isAuthorFeedEligible`).

- [ ] **Step 3: Implement** — in `convex/feed.ts`, add the pure helper (above `getFeed`):

```ts
/**
 * Author eligibility for the shared feed. Excludes trialing authors (their posts are hidden
 * until they activate) AND authors pending account deletion (their content disappears from the
 * feed the moment they request erasure, and reappears automatically if they cancel — no post
 * mutation needed).
 */
export function isAuthorFeedEligible(
  author: { subscriptionStatus?: string; deletionScheduledAt?: number } | null
): boolean {
  if (!author) return false
  if (author.subscriptionStatus === 'trialing') return false
  if (author.deletionScheduledAt) return false
  return true
}
```

Then replace the trial-filter block (currently lines ~147-151):

```ts
// Filter out posts from trialing users
allPosts = allPosts.filter(post => {
  const author = allAuthorMap.get(post.authorId)
  return author?.subscriptionStatus !== 'trialing'
})
```

with:

```ts
// Filter out posts whose author is trialing or pending account deletion
allPosts = allPosts.filter(post => isAuthorFeedEligible(allAuthorMap.get(post.authorId) ?? null))
```

- [ ] **Step 4: Run, confirm PASS** — `pnpm --filter convex test feed` (new + existing feed tests pass).
- [ ] **Step 5: Checkpoint (NO COMMIT).**

---

## Task 3: Export — bundle builder (pure) + gather query

**Files:** Create `convex/privacy/export.ts`, `convex/privacy/export.test.ts`

- [ ] **Step 1: Write the failing test** — `convex/privacy/export.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildExportBundle } from './export'

const USER = {
  _id: 'u1',
  _creationTime: 1,
  linkedinId: 'li-1',
  name: 'Jane',
  email: 'jane@example.com',
  linkedinAccessToken: 'SECRET',
  linkedinRefreshToken: 'SECRET2',
  tokenExpiresAt: 999,
  createdAt: 1
}

describe('buildExportBundle', () => {
  it('includes profile but strips secret token fields', () => {
    const bundle = buildExportBundle({ user: USER, posts: [], subscriptions: [], consents: [], audits: [] })
    expect(bundle.profile.name).toBe('Jane')
    expect(bundle.profile.email).toBe('jane@example.com')
    expect('linkedinAccessToken' in bundle.profile).toBe(false)
    expect('linkedinRefreshToken' in bundle.profile).toBe(false)
    expect('tokenExpiresAt' in bundle.profile).toBe(false)
  })

  it('includes the user posts, subscriptions and consents verbatim', () => {
    const bundle = buildExportBundle({
      user: USER,
      posts: [{ _id: 'p1', content: 'hi' }],
      subscriptions: [{ _id: 's1', tier: 'pro' }],
      consents: [{ _id: 'c1', purpose: 'marketing', granted: true }],
      audits: []
    })
    expect(bundle.posts).toHaveLength(1)
    expect(bundle.subscriptions[0].tier).toBe('pro')
    expect(bundle.consents[0].purpose).toBe('marketing')
  })

  it('redacts other actors from audit entries (keeps action + own target)', () => {
    const bundle = buildExportBundle({
      user: USER,
      posts: [],
      subscriptions: [],
      consents: [],
      audits: [
        { _id: 'a1', action: 'consent.granted', actor: 'admin', actorId: 'admin99', targetUserId: 'u1', metadata: 'x' }
      ]
    })
    expect(bundle.auditLog[0].action).toBe('consent.granted')
    expect('actorId' in bundle.auditLog[0]).toBe(false)
    expect('actor' in bundle.auditLog[0]).toBe(false)
  })

  it('stamps an exportedAt and a format version', () => {
    const bundle = buildExportBundle({
      user: USER,
      posts: [],
      subscriptions: [],
      consents: [],
      audits: [],
      exportedAt: 42
    })
    expect(bundle.exportedAt).toBe(42)
    expect(bundle.formatVersion).toBe(1)
  })
})
```

- [ ] **Step 2: Run, confirm FAIL** — `pnpm --filter convex test export` (no module).

- [ ] **Step 3: Implement** — `convex/privacy/export.ts`:

```ts
// convex/privacy/export.ts
// Right of access / data portability. buildExportBundle is pure (assembles + redacts);
// gatherUserData reads the user's own rows; the action stores the JSON bundle in Convex
// file storage behind a 7-day owner-only link and emails the user.
import { action, internalMutation, internalQuery, mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { resolveSession } from './lib/auth'
import { checkRateLimit } from './lib/rateLimit'
import { writeAuditLog } from './lib/audit'
import { sendEmail } from './lib/email'
import { exportReadyEmail } from './emails'

const EXPORT_TTL_MS = 7 * 24 * 60 * 60 * 1000

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- bundle assembles heterogeneous rows
type AnyDoc = Record<string, any>

export interface ExportInput {
  user: AnyDoc
  posts: AnyDoc[]
  subscriptions: AnyDoc[]
  consents: AnyDoc[]
  audits: AnyDoc[]
  exportedAt?: number
}

export function buildExportBundle(input: ExportInput) {
  const { linkedinAccessToken, linkedinRefreshToken, tokenExpiresAt, ...profile } = input.user
  return {
    formatVersion: 1 as const,
    exportedAt: input.exportedAt ?? 0,
    profile,
    posts: input.posts,
    subscriptions: input.subscriptions,
    consents: input.consents,
    // The user is entitled to data ABOUT them, not the internal admin trail — keep the
    // action + when, drop other actors' identifiers and internal fields.
    auditLog: input.audits.map(a => ({ action: a.action, createdAt: a.createdAt, metadata: a.metadata }))
  }
}

export const gatherUserData = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId)
    if (!user) return null
    const posts = await ctx.db
      .query('posts')
      .withIndex('by_author', q => q.eq('authorId', userId))
      .collect()
    const subscriptions = await ctx.db
      .query('subscriptions')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect()
    const consents = await ctx.db
      .query('consentRecords')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect()
    const audits = await ctx.db
      .query('auditLogs')
      .withIndex('by_target', q => q.eq('targetUserId', userId))
      .collect()
    return { user, posts, subscriptions, consents, audits }
  }
})

export const requestDataExport = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await resolveSession(ctx, sessionToken) // allow banned users to exercise access
    if (!user) throw new Error('Unauthorized')
    if (!user.isAdmin) await checkRateLimit(ctx, user._id, 'dataExport', 1, 24 * 60 * 60 * 1000, 'day')
    const requestId = await ctx.db.insert('dataExportRequests', {
      userId: user._id,
      status: 'pending',
      requestedAt: Date.now()
    })
    await writeAuditLog(ctx.db as unknown as { insert: (t: string, d: Record<string, unknown>) => Promise<string> }, {
      actor: 'user',
      actorId: user._id,
      action: 'dsr.export_requested',
      targetUserId: user._id
    })
    await ctx.scheduler.runAfter(0, internal.privacy.export.generateExport, { requestId, userId: user._id })
    return { requestId }
  }
})

export const generateExport = action({
  args: { requestId: v.id('dataExportRequests'), userId: v.id('users') },
  handler: async (ctx, { requestId, userId }) => {
    try {
      const data = await ctx.runQuery(internal.privacy.export.gatherUserData, { userId })
      if (!data) throw new Error('user not found')
      const bundle = buildExportBundle({ ...data, exportedAt: Date.now() })
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
      const fileStorageId = await ctx.storage.store(blob)
      await ctx.runMutation(internal.privacy.export.markExportReady, {
        requestId,
        fileStorageId,
        expiresAt: Date.now() + EXPORT_TTL_MS
      })
      const email = data.user.email as string | undefined
      if (email) {
        const m = exportReadyEmail()
        await sendEmail({ to: email, subject: m.subject, html: m.html, text: m.text })
      }
    } catch (err) {
      console.error('generateExport failed:', err instanceof Error ? err.message : String(err))
      await ctx.runMutation(internal.privacy.export.markExportFailed, { requestId })
    }
  }
})

export const markExportReady = internalMutation({
  args: { requestId: v.id('dataExportRequests'), fileStorageId: v.id('_storage'), expiresAt: v.number() },
  handler: async (ctx, { requestId, fileStorageId, expiresAt }) => {
    await ctx.db.patch(requestId, { status: 'ready', fileStorageId, expiresAt })
  }
})

export const markExportFailed = internalMutation({
  args: { requestId: v.id('dataExportRequests') },
  handler: async (ctx, { requestId }) => {
    await ctx.db.patch(requestId, { status: 'failed' })
  }
})

export const getExportStatus = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await resolveSession(ctx, sessionToken)
    if (!user) return null
    const latest = await ctx.db
      .query('dataExportRequests')
      .withIndex('by_user', q => q.eq('userId', user._id))
      .order('desc')
      .first()
    if (!latest) return null
    const expired = latest.expiresAt !== undefined && latest.expiresAt < Date.now()
    return { status: expired ? 'expired' : latest.status, requestedAt: latest.requestedAt }
  }
})

export const getExportDownloadUrl = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await resolveSession(ctx, sessionToken)
    if (!user) throw new Error('Unauthorized')
    const latest = await ctx.db
      .query('dataExportRequests')
      .withIndex('by_user', q => q.eq('userId', user._id))
      .order('desc')
      .first()
    if (!latest || latest.status !== 'ready' || !latest.fileStorageId) return null
    if (latest.expiresAt !== undefined && latest.expiresAt < Date.now()) return null
    return await ctx.storage.getUrl(latest.fileStorageId)
  }
})
```

- [ ] **Step 4: Run, confirm PASS** — `pnpm --filter convex test export` (the `buildExportBundle`
      tests pass). Then `pnpm --filter convex test` (whole suite green) and `pnpm lint`.

- [ ] **Step 5: Checkpoint (NO COMMIT).**

> Coverage note: `buildExportBundle` (the security-critical secret-stripping + audit redaction) is
> unit-tested. `generateExport`/`getExportDownloadUrl` are thin wrappers over Convex storage +
> `runQuery` and are verified by lint/typecheck + manual integration (same justification as `billing.ts`
> in Phase 1) — they have no business logic beyond orchestration.

---

## Task 4: Deletion — cascade (pure) + tests

**Files:** Create `convex/privacy/deletion.ts` (cascade portion), `convex/privacy/deletion.test.ts`

- [ ] **Step 1: Write the failing test** — `convex/privacy/deletion.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { cascadeDeleteUser } from './deletion'

function createMockDb(seed: Record<string, any[]>) {
  const tables: Record<string, any[]> = JSON.parse(JSON.stringify(seed))
  const deleted: { table: string; id: string }[] = []
  const patched: { id: string; data: any }[] = []
  const inserted: { table: string; doc: any }[] = []
  return {
    query: (table: string) => ({
      withIndex: (_name: string, _fn: any) => ({
        collect: async () => tables[table] ?? []
      })
    }),
    get: async (id: string) =>
      Object.values(tables)
        .flat()
        .find((r: any) => r._id === id) ?? null,
    patch: async (id: string, data: any) => {
      patched.push({ id, data })
    },
    insert: async (table: string, doc: any) => {
      inserted.push({ table, doc })
      return `${table}-new`
    },
    delete: async (id: string) => {
      for (const t of Object.keys(tables)) {
        const i = tables[t].findIndex((r: any) => r._id === id)
        if (i >= 0) {
          deleted.push({ table: t, id })
          tables[t].splice(i, 1)
          return
        }
      }
      deleted.push({ table: '?', id })
    },
    _deleted: deleted,
    _patched: patched,
    _inserted: inserted
  }
}

const SEED = {
  users: [{ _id: 'u1', email: 'j@x.com' }],
  posts: [
    { _id: 'p1', authorId: 'u1' },
    { _id: 'p2', authorId: 'u1' }
  ],
  postQueue: [{ _id: 'pq1', authorId: 'u1' }],
  subscriptions: [{ _id: 's1', userId: 'u1' }],
  sessions: [{ _id: 'se1', userId: 'u1' }],
  rateLimits: [{ _id: 'r1', userId: 'u1' }],
  featuredPostUsage: [{ _id: 'f1', userId: 'u1' }],
  planLimits: [{ _id: 'pl1', userId: 'u1' }],
  consentRecords: [{ _id: 'c1', userId: 'u1' }],
  dataExportRequests: [{ _id: 'de1', userId: 'u1', fileStorageId: 'stor1' }],
  auditLogs: [{ _id: 'al1', targetUserId: 'u1', actorId: 'u1', action: 'x' }]
}

describe('cascadeDeleteUser', () => {
  it('deletes the user and every owned row across all tables', async () => {
    const db = createMockDb(SEED)
    const storage = { delete: async (_id: string) => {} }
    await cascadeDeleteUser(db, storage, 'u1')
    const deletedTables = db._deleted.map(d => d.table)
    for (const t of [
      'users',
      'posts',
      'postQueue',
      'subscriptions',
      'sessions',
      'rateLimits',
      'featuredPostUsage',
      'planLimits',
      'consentRecords',
      'dataExportRequests'
    ]) {
      expect(deletedTables).toContain(t)
    }
    expect(db._deleted.filter(d => d.table === 'posts')).toHaveLength(2)
  })

  it('deletes the user document LAST', async () => {
    const db = createMockDb(SEED)
    await cascadeDeleteUser(db, { delete: async () => {} }, 'u1')
    expect(db._deleted[db._deleted.length - 1]).toEqual({ table: 'users', id: 'u1' })
  })

  it('deletes stored export files', async () => {
    const db = createMockDb(SEED)
    const storageDeletes: string[] = []
    await cascadeDeleteUser(
      db,
      {
        delete: async (id: string) => {
          storageDeletes.push(id)
        }
      },
      'u1'
    )
    expect(storageDeletes).toContain('stor1')
  })

  it('pseudonymizes audit rows (nulls targetUserId) instead of deleting them', async () => {
    const db = createMockDb(SEED)
    await cascadeDeleteUser(db, { delete: async () => {} }, 'u1')
    expect(db._patched).toContainEqual({ id: 'al1', data: { targetUserId: undefined, actorId: undefined } })
    expect(db._deleted.map(d => d.id)).not.toContain('al1')
  })

  it('writes a system audit entry recording the deletion', async () => {
    const db = createMockDb(SEED)
    await cascadeDeleteUser(db, { delete: async () => {} }, 'u1')
    const evt = db._inserted.find(i => i.table === 'auditLogs')
    expect(evt?.doc.actor).toBe('system')
    expect(evt?.doc.action).toBe('account.deleted')
  })
})
```

- [ ] **Step 2: Run, confirm FAIL** — `pnpm --filter convex test deletion` (no module).

- [ ] **Step 3: Implement the cascade** — create `convex/privacy/deletion.ts` with (registered fns added in Task 5; for now the pure cascade + its db interface):

```ts
// convex/privacy/deletion.ts
// Right to erasure. cascadeDeleteUser is pure (operates on a narrow db + storage interface) so the
// full multi-table deletion is unit-tested. Registered request/cancel/cron wrappers are added below.
import { writeAuditLog } from './lib/audit'

interface CascadeDb {
  query(table: string): {
    withIndex(
      name: string,
      fn: (q: unknown) => unknown
    ): { collect(): Promise<Array<Record<string, unknown> & { _id: string }>> }
  }
  get(id: string): Promise<(Record<string, unknown> & { _id: string }) | null>
  patch(id: string, fields: Record<string, unknown>): Promise<void>
  insert(table: string, doc: Record<string, unknown>): Promise<string>
  delete(id: string): Promise<void>
}
interface CascadeStorage {
  delete(storageId: string): Promise<void>
}

// Tables owned by a user and the index used to find their rows (first index field = userId-like).
const OWNED: Array<{ table: string; index: string; field: string }> = [
  { table: 'posts', index: 'by_author', field: 'authorId' },
  { table: 'postQueue', index: 'by_author', field: 'authorId' },
  { table: 'subscriptions', index: 'by_user', field: 'userId' },
  { table: 'sessions', index: 'by_userId', field: 'userId' },
  { table: 'rateLimits', index: 'by_user_and_action', field: 'userId' },
  { table: 'featuredPostUsage', index: 'by_user_month', field: 'userId' },
  { table: 'planLimits', index: 'by_user', field: 'userId' },
  { table: 'consentRecords', index: 'by_user', field: 'userId' }
]

export async function cascadeDeleteUser(db: CascadeDb, storage: CascadeStorage, userId: string): Promise<void> {
  // 1. Delete export jobs + their stored files first (needs storage cleanup).
  const exports = await db
    .query('dataExportRequests')
    .withIndex('by_user', (q: unknown) => (q as { eq(f: string, v: unknown): unknown }).eq('userId', userId))
    .collect()
  for (const e of exports) {
    if (typeof e.fileStorageId === 'string') await storage.delete(e.fileStorageId)
    await db.delete(e._id)
  }

  // 2. Delete all other owned rows.
  for (const { table, index, field } of OWNED) {
    const rows = await db
      .query(table)
      .withIndex(index, (q: unknown) => (q as { eq(f: string, v: unknown): unknown }).eq(field, userId))
      .collect()
    for (const r of rows) await db.delete(r._id)
  }

  // 3. Pseudonymize audit rows that target this user (keep action/metadata for accountability).
  const audits = await db
    .query('auditLogs')
    .withIndex('by_target', (q: unknown) => (q as { eq(f: string, v: unknown): unknown }).eq('targetUserId', userId))
    .collect()
  for (const a of audits) await db.patch(a._id, { targetUserId: undefined, actorId: undefined })

  // 4. Record the deletion itself (no PII).
  await writeAuditLog(db, { actor: 'system', action: 'account.deleted', metadata: JSON.stringify({ at: Date.now() }) })

  // 5. Delete the user document LAST.
  await db.delete(userId)
}
```

- [ ] **Step 4: Run, confirm PASS** — `pnpm --filter convex test deletion`.
- [ ] **Step 5: Checkpoint (NO COMMIT).**

> `OWNED` is the single list the cascade iterates. **If a future table gains a `userId`/`authorId`,
> add it here** — Task 6's completeness test guards this.

---

## Task 5: Deletion — request / cancel / Stripe / cron wrappers

**Files:** Modify `convex/privacy/deletion.ts` (append registered fns), `convex/crons.ts`

- [ ] **Step 1: Append registered functions** to `convex/privacy/deletion.ts`. Add imports at top:

```ts
import { action, internalMutation, internalQuery, mutation } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import Stripe from 'stripe'
import { resolveSession } from './lib/auth'
import { sendEmail } from './lib/email'
import { deletionScheduledEmail, deletionCompletedEmail } from './emails'
```

Add the functions:

```ts
const GRACE_MS = 30 * 24 * 60 * 60 * 1000
const DELETION_BATCH = 50

function formatDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10) // YYYY-MM-DD (Date.now passed in by callers)
}

export const requestAccountDeletion = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await resolveSession(ctx, sessionToken) // allow banned users to exercise erasure
    if (!user) throw new Error('Unauthorized')
    if (user.deletionScheduledAt) return { deletionScheduledAt: user.deletionScheduledAt } // idempotent
    const scheduledAt = Date.now() + GRACE_MS
    await ctx.db.patch(user._id, {
      deletionRequestedAt: Date.now(),
      deletionScheduledAt: scheduledAt,
      deletionReason: 'user_request'
    })
    await ctx.runMutation(internal.sessions.deleteAllForUser, { userId: user._id }) // revoke access now
    await writeAuditLog(ctx.db as unknown as CascadeDb, {
      actor: 'user',
      actorId: user._id,
      action: 'dsr.deletion_requested',
      targetUserId: user._id
    })
    await ctx.scheduler.runAfter(0, internal.privacy.deletion.onDeletionRequested, { userId: user._id, scheduledAt })
    return { deletionScheduledAt: scheduledAt }
  }
})

export const cancelAccountDeletion = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await resolveSession(ctx, sessionToken)
    if (!user) throw new Error('Unauthorized')
    await ctx.db.patch(user._id, {
      deletionRequestedAt: undefined,
      deletionScheduledAt: undefined,
      deletionReason: undefined
    })
    await writeAuditLog(ctx.db as unknown as CascadeDb, {
      actor: 'user',
      actorId: user._id,
      action: 'dsr.deletion_cancelled',
      targetUserId: user._id
    })
  }
})

// Internal: cancel the user's Stripe subscriptions immediately (stop billing during grace) and
// send the "deletion scheduled" email. Best-effort; failures are logged, never block the flow.
export const onDeletionRequested = action({
  args: { userId: v.id('users'), scheduledAt: v.number() },
  handler: async (ctx, { userId, scheduledAt }) => {
    const subs = await ctx.runQuery(internal.privacy.deletion.listUserSubscriptions, { userId })
    const key = process.env.STRIPE_SECRET_KEY
    if (key) {
      const stripe = new Stripe(key)
      for (const s of subs) {
        if (s.stripeSubscriptionId && s.status !== 'canceled') {
          try {
            await stripe.subscriptions.cancel(s.stripeSubscriptionId)
          } catch (err) {
            console.error('Stripe cancel failed for', s.stripeSubscriptionId, err instanceof Error ? err.message : err)
          }
        }
      }
    }
    const email = await ctx.runQuery(internal.privacy.deletion.getUserEmail, { userId })
    if (email) {
      const m = deletionScheduledEmail(formatDate(scheduledAt))
      await sendEmail({ to: email, subject: m.subject, html: m.html, text: m.text })
    }
  }
})

export const listUserSubscriptions = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) =>
    ctx.db
      .query('subscriptions')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect()
})

export const getUserEmail = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const u = await ctx.db.get(userId)
    return u?.email ?? null
  }
})

// Daily cron: hard-delete accounts past their grace window. Batched + self-rescheduling.
export const processAccountDeletions = internalMutation({
  args: {},
  handler: async ctx => {
    const now = Date.now()
    const due = await ctx.db
      .query('users')
      .filter(q => q.and(q.neq(q.field('deletionScheduledAt'), undefined), q.lte(q.field('deletionScheduledAt'), now)))
      .take(DELETION_BATCH)
    for (const user of due) {
      const email = user.email as string | undefined
      await cascadeDeleteUser(ctx.db as unknown as CascadeDb, ctx.storage as unknown as CascadeStorage, user._id)
      if (email) await ctx.scheduler.runAfter(0, internal.privacy.deletion.sendDeletionCompleted, { email })
    }
    if (due.length === DELETION_BATCH) {
      await ctx.scheduler.runAfter(0, internal.privacy.deletion.processAccountDeletions, {})
    }
  }
})

export const sendDeletionCompleted = action({
  args: { email: v.string() },
  handler: async (_ctx, { email }) => {
    const m = deletionCompletedEmail()
    await sendEmail({ to: email, subject: m.subject, html: m.html, text: m.text })
  }
})
```

> Note: `formatDate` uses `new Date(ms)` with an explicit millisecond argument — fine in production
> code (the restriction on argless `Date.now()`/`new Date()` applies only inside workflow scripts).

- [ ] **Step 2: Register the cron** — in `convex/crons.ts`, after the existing cleanup crons add:

```ts
// Hard-delete accounts whose 30-day deletion grace window has elapsed (self-service erasure
// + dormancy). Batched; reschedules itself when a run fills the batch.
crons.interval('process account deletions', { hours: 24 }, internal.privacy.deletion.processAccountDeletions, {})
```

- [ ] **Step 3: Run + verify** — `pnpm --filter convex test` (the Task 4 cascade tests still pass;
      no new unit tests for the thin wrappers). Then `pnpm lint`. Then `npx prettier --check "convex/privacy/*.ts" "convex/crons.ts" "convex/feed.ts"`.

> Coverage note: the cascade (Task 4) and feed eligibility (Task 2) — the logic with real
> branching — are unit-tested. `requestAccountDeletion`/`cancelAccountDeletion`/`onDeletionRequested`/
> `processAccountDeletions` are orchestration wrappers (set fields, schedule, call Stripe/email);
> verified by lint/typecheck + manual integration, consistent with the project's testing of `billing.ts`/
> `http.ts`. If desired, the `due`-selection filter can be extracted to a pure predicate and tested,
> but it is a direct Convex filter here.

- [ ] **Step 4: Checkpoint (NO COMMIT).**

---

## Task 6: Deletion-completeness guard test

**Files:** Modify `convex/privacy/deletion.test.ts`

This is the defensive test from spec §7 — it fails if a new user-owned table is added but not wired
into the cascade.

- [ ] **Step 1: Add the test** — append to `convex/privacy/deletion.test.ts`:

```ts
import schema from '../schema'

describe('deletion cascade completeness', () => {
  it('covers every table that references a user (userId/authorId), except auditLogs/users', async () => {
    // Tables intentionally NOT hard-deleted: users (deleted explicitly last), auditLogs (pseudonymized).
    const EXEMPT = new Set(['users', 'auditLogs'])
    const userRefTables = Object.keys(schema.tables).filter(name => {
      if (EXEMPT.has(name)) return false
      // a table "references a user" if it has a userId or authorId field
      const validators = (schema.tables as any)[name].validator.fields
      return validators && ('userId' in validators || 'authorId' in validators)
    })

    const db = createMockDb({ ...SEED })
    await cascadeDeleteUser(db, { delete: async () => {} }, 'u1')
    const deletedTables = new Set(db._deleted.map(d => d.table))
    for (const t of userRefTables) {
      expect(deletedTables.has(t), `cascade must delete rows from "${t}"`).toBe(true)
    }
  })
})
```

> If `schema.tables[name].validator.fields` shape differs in this Convex version, adapt the field
> introspection so the test enumerates user-referencing tables from the schema (the intent: derive the
> list from the schema, don't hardcode it). Verify the test FAILS if you temporarily remove an entry
> from `OWNED`, then restore it.

- [ ] **Step 2: Run, confirm PASS** — `pnpm --filter convex test deletion`. Temporarily delete the
      `posts` entry from `OWNED` and confirm this test FAILS; restore it and confirm PASS.

- [ ] **Step 3: Checkpoint (NO COMMIT).**

---

## Task 7: Documentation — extend §13B + cron table + deletion flow

**Files:** Modify `docs/PLATFORM.md`

- [ ] **Step 1: Add the cron** to the §13 Scheduled Jobs table:

```markdown
| `process account deletions` | every **24h** | `privacy/deletion.processAccountDeletions` | Hard-delete accounts past their 30-day deletion grace window (cascade + Stripe cancel + email). |
```

- [ ] **Step 2: Extend §13B** with a "Data-Subject Rights (Phase 2a)" subsection covering: export
      (`requestDataExport` → `generateExport` → 7-day storage link → `getExportDownloadUrl`; bundle strips
      secrets, redacts other actors from audit entries), and the deletion lifecycle (`requestAccountDeletion`
      → revoke sessions + immediate Stripe cancel + `deletion-scheduled` email; feed excludes pending-deletion
      authors via `isAuthorFeedEligible`; `cancelAccountDeletion` restores; `processAccountDeletions` cron
      runs `cascadeDeleteUser` after 30 days, pseudonymizing `auditLogs` and retaining billing in Stripe).
      Note deletion auth uses `resolveSession` so **banned users can still erase**.

- [ ] **Step 3: Add a Mermaid deletion-lifecycle flow** to §13B (mirror the spec §3.2 diagram).

- [ ] **Step 4: Update the footer** "Last updated" note to mention Phase 2a.

- [ ] **Step 5: Verify + Checkpoint (NO COMMIT)** — re-read §13B; confirm Markdown renders.

---

## Phase 2a completion check

- [ ] `pnpm --filter convex test` — all green (new: emails, feed eligibility, export bundle, cascade,
      completeness).
- [ ] `pnpm lint` — zero warnings.
- [ ] `npx prettier --check "convex/privacy/*.ts" "convex/crons.ts" "convex/feed.ts"` — clean.
- [ ] Deliverables present: `convex/privacy/{emails,export,deletion}.ts` (+ tests), feed eligibility
      helper, `processAccountDeletions` cron, `docs/PLATFORM.md` updated.
- [ ] **Nothing committed.**

## Self-Review (performed during authoring)

- **Spec coverage:** export access/portability (§3.1 → Tasks 3), erasure lifecycle + cascade map
  (§3.2 → Tasks 4–5), banned-user erasure (§8 → `resolveSession` in Tasks 3/5), feed removal on
  request + auto-restore (Task 2), pseudonymized audit retention (Task 4), emails (Task 1), the
  completeness guard test (§7 → Task 6), docs (§ "done" → Task 7). Dormancy + re-consent are Phase 3;
  the frontend is Phase 2b.
- **Placeholder scan:** the two "IMPLEMENTER NOTE" blocks intentionally show the data flow then give
  the exact clean code to ship — they are explicit instructions, not TBDs. No other placeholders.
- **Type consistency:** `cascadeDeleteUser(db, storage, userId)` signature matches its tests and the
  cron call site; `ExportInput`/`buildExportBundle` match the export tests; `OWNED` table/index/field
  names match `convex/schema.ts` indexes (`by_author`, `by_user`, `by_userId`, `by_user_and_action`,
  `by_user_month`).
- **No-commit rule:** every task ends in a no-commit checkpoint.

```

```
