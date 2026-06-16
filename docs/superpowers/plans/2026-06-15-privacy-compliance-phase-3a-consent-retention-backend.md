# Privacy & Compliance — Phase 3a: Consent + Retention/Dormancy + Re-consent (Backend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

> ⚠️ **DO NOT COMMIT TO GIT.** The owner (Henriko) commits. Every task ends in a **Checkpoint (no commit)**. (Per `CLAUDE.md`.)

> ⚠️ **Prerequisite:** Phases 1 + 2 in the tree (uses `consentRecords`, `dataExportRequests`,
> `auditLogs`, `users.{lastLoginAt,deletionScheduledAt,deletionReason,acknowledgedPolicyVersion}`,
> `lib/policy.POLICY_VERSION`, `lib/audit.writeAuditLog`, `lib/email.sendEmail`, `privacy/emails.ts`,
> and the Phase 2a `processAccountDeletions` cron). Tests use the `convex-mocks` shim (no regen needed).

> **Plan 3a of the program.** Backend only. Phase 3b (frontend: consent toggles, `PolicyUpdateModal` +
> `RequireAuth` interception, cookie notice, landing `/cookies`) follows. Phase 4 = legal docs.

**Goal:** Build the backend for **consent** (append-only records + read/record/check + re-consent
acknowledgment) and **retention/minimization** (a daily `enforceDataRetention` cron: expire LinkedIn
tokens, purge old export files + audit logs, and **dormancy auto-deletion** at 24 months feeding the
existing deletion cron).

**Architecture:** New `convex/privacy/consent.ts` and `convex/privacy/retention.ts`, following the
Phase 2a pattern: the logic that matters lives in **pure, unit-tested helpers**
(`latestConsentByPurpose`, `isTokenExpired`, `isExportExpired`, `isAuditExpired`, `isDormant`);
registered mutations/queries/crons are thin wrappers. Dormancy reuses Phase 2a's deletion lifecycle
(set `deletionScheduledAt` + `deletionReason='dormancy'` → `processAccountDeletions` cascades after the
grace window; re-login → CancelDeletionScreen → cancel, exactly like a user request).

**Tech Stack:** Convex (TS), Vitest (`pnpm --filter convex test`).

**Spec:** `docs/superpowers/specs/2026-06-15-privacy-compliance-design.md` §4.1 (consent), §4.3
(retention), §3.5 (dormancy), §4.5 (re-consent).

**Read first:** `convex/_generated/ai/guidelines.md`.

## Conventions (from Phase 2a, verified)
- Files in `convex/privacy/` import registration fns from `../_generated/server`, libs from `../lib/*`,
  siblings from `./*`. Tests resolve these through the `convex/server` mock.
- **Unit-test the pure helpers**; thin wrappers are lint/typecheck + integration-verified.
- No `any` in source (`eslint . --max-warnings 0`); `as unknown as` casts like the existing privacy code.
- Cron pattern: bounded `.take(BATCH)` + self-reschedule when full (`processAccountDeletions`/`processQueue`).
- Test commands: `pnpm --filter convex test [substring]`; lint `pnpm lint`; format `npx prettier --check`.

## Config constants (this phase)
- `TOKEN`: null LinkedIn tokens once `tokenExpiresAt < now`.
- `EXPORT_TTL` already 7 days (Phase 2a sets `expiresAt`); retention deletes the file + flips status.
- `AUDIT_TTL_MS = 24 * 30 * 24*60*60*1000` (~24 months).
- `DORMANCY_MS = 24 * 30 * 24*60*60*1000` (~24 months); excludes `active`/`trialing` subscribers.
- `RETENTION_BATCH = 100`.

---

## File Structure

| File | Responsibility |
|---|---|
| `convex/privacy/consent.ts` (create) + test | `latestConsentByPurpose` (pure) + `recordConsent`/`getConsents`/`hasConsent` + `acknowledgePolicy` |
| `convex/privacy/emails.ts` (modify) + test | add `dormancyWarningEmail` |
| `convex/privacy/retention.ts` (create) + test | `isTokenExpired`/`isExportExpired`/`isAuditExpired`/`isDormant` (pure) + `enforceDataRetention` cron + `sendDormancyWarning` action |
| `convex/crons.ts` (modify) | register `enforce data retention` (daily) |
| `docs/PLATFORM.md` (modify) | §13B (consent + retention/dormancy + re-consent) + §13 cron row |

---

## Task 1: Consent helpers + re-consent acknowledgment

**Files:** Create `convex/privacy/consent.ts`, `convex/privacy/consent.test.ts`

- [ ] **Step 1: Write the failing test** — `convex/privacy/consent.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { latestConsentByPurpose } from './consent'

describe('latestConsentByPurpose', () => {
  it('returns an empty map for no records', () => {
    expect(latestConsentByPurpose([])).toEqual({})
  })

  it('takes the latest record per purpose (by createdAt)', () => {
    const records = [
      { purpose: 'marketing', granted: true, createdAt: 100 },
      { purpose: 'marketing', granted: false, createdAt: 200 }, // newer withdrawal wins
      { purpose: 'analytics', granted: true, createdAt: 50 }
    ]
    expect(latestConsentByPurpose(records)).toEqual({ marketing: false, analytics: true })
  })

  it('is order-independent (uses createdAt, not array order)', () => {
    const records = [
      { purpose: 'marketing', granted: false, createdAt: 200 },
      { purpose: 'marketing', granted: true, createdAt: 100 }
    ]
    expect(latestConsentByPurpose(records)).toEqual({ marketing: false })
  })
})
```

- [ ] **Step 2: Run, confirm FAIL** — `pnpm --filter convex test consent`.

- [ ] **Step 3: Implement** — `convex/privacy/consent.ts`:

```ts
// convex/privacy/consent.ts
// Consent (GDPR/LGPD). consentRecords is an append-only log; the current effective consent for a
// purpose is the LATEST record (by createdAt). latestConsentByPurpose is pure + unit-tested.
// Re-consent: acknowledgePolicy stamps the user's acknowledgedPolicyVersion to the current POLICY_VERSION.
import { mutation, query } from '../_generated/server'
import { v } from 'convex/values'
import type { QueryCtx } from '../_generated/server'
import { resolveSession } from '../lib/auth'
import { writeAuditLog } from '../lib/audit'
import { POLICY_VERSION } from '../lib/policy'

export type ConsentPurpose = 'marketing' | 'analytics'

type AuditDb = { insert: (t: string, d: Record<string, unknown>) => Promise<string> }

export function latestConsentByPurpose(
  records: Array<{ purpose: string; granted: boolean; createdAt: number }>
): Record<string, boolean> {
  const latest: Record<string, { granted: boolean; createdAt: number }> = {}
  for (const r of records) {
    const cur = latest[r.purpose]
    if (!cur || r.createdAt > cur.createdAt) latest[r.purpose] = { granted: r.granted, createdAt: r.createdAt }
  }
  const out: Record<string, boolean> = {}
  for (const k of Object.keys(latest)) out[k] = latest[k].granted
  return out
}

export const recordConsent = mutation({
  args: {
    sessionToken: v.string(),
    purpose: v.union(v.literal('marketing'), v.literal('analytics')),
    granted: v.boolean()
  },
  handler: async (ctx, { sessionToken, purpose, granted }) => {
    const user = await resolveSession(ctx, sessionToken)
    if (!user) throw new Error('Unauthorized')
    await ctx.db.insert('consentRecords', {
      userId: user._id,
      purpose,
      granted,
      policyVersion: POLICY_VERSION,
      createdAt: Date.now()
    })
    await writeAuditLog(ctx.db as unknown as AuditDb, {
      actor: 'user',
      actorId: user._id,
      action: granted ? 'consent.granted' : 'consent.withdrawn',
      targetUserId: user._id,
      metadata: JSON.stringify({ purpose })
    })
  }
})

export const getConsents = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await resolveSession(ctx, sessionToken)
    if (!user) return null
    const records = await ctx.db
      .query('consentRecords')
      .withIndex('by_user', q => q.eq('userId', user._id))
      .collect()
    return latestConsentByPurpose(records)
  }
})

// Server-side gate for future consent-based processing (e.g. analytics). Returns false unless the
// latest record for the purpose is `granted`.
export async function hasConsent(ctx: QueryCtx, userId: string, purpose: ConsentPurpose): Promise<boolean> {
  const records = await ctx.db
    .query('consentRecords')
    .withIndex('by_user_and_purpose', q => q.eq('userId', userId as never).eq('purpose', purpose))
    .collect()
  return latestConsentByPurpose(records)[purpose] === true
}

export const acknowledgePolicy = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await resolveSession(ctx, sessionToken)
    if (!user) throw new Error('Unauthorized')
    await ctx.db.patch(user._id, { acknowledgedPolicyVersion: POLICY_VERSION })
    await writeAuditLog(ctx.db as unknown as AuditDb, {
      actor: 'user',
      actorId: user._id,
      action: 'policy.acknowledged',
      targetUserId: user._id,
      metadata: JSON.stringify({ version: POLICY_VERSION })
    })
  }
})
```

> If the `QueryCtx` import path or `hasConsent`'s `withIndex` typing fights the shim, simplify
> `hasConsent` to accept a minimal `{ db }` and cast like the other privacy helpers — keep it `any`-free.

- [ ] **Step 4: Run, confirm PASS** — `pnpm --filter convex test consent`, then full suite, then
  `pnpm lint`, then `npx prettier --check "convex/privacy/consent.ts" "convex/privacy/consent.test.ts"`.

- [ ] **Step 5: Checkpoint (NO COMMIT).**

> Coverage: `latestConsentByPurpose` (the latest-wins logic) is unit-tested. `recordConsent`/
> `getConsents`/`acknowledgePolicy`/`hasConsent` are thin DB wrappers, integration-verified.

---

## Task 2: Dormancy-warning email template

**Files:** Modify `convex/privacy/emails.ts`, `convex/privacy/emails.test.ts`

- [ ] **Step 1: Add the failing test** — append to `convex/privacy/emails.test.ts`:

```ts
import { dormancyWarningEmail } from './emails' // add to the existing import from './emails'

describe('dormancyWarningEmail', () => {
  it('names the deletion date and the reactivation action', () => {
    const m = dormancyWarningEmail('June 30, 2026')
    expect(m.subject).toMatch(/inactive|deletion/i)
    expect(m.html).toContain('June 30, 2026')
    expect(m.text).toContain('June 30, 2026')
  })
})
```

(Merge `dormancyWarningEmail` into the existing `import { ... } from './emails'` line — don't duplicate it.)

- [ ] **Step 2: Run, confirm FAIL** — `pnpm --filter convex test emails`.

- [ ] **Step 3: Implement** — add to `convex/privacy/emails.ts`:

```ts
export function dormancyWarningEmail(deletionDate: string): EmailContent {
  const subject = `Your ${APP} account is inactive — action needed`
  const text = `Your ${APP} account has been inactive for a long time. To comply with data-minimization rules, it is scheduled for deletion on ${deletionDate}. Simply sign in before then to keep your account and cancel the deletion.`
  const html = `<p>Your <strong>${APP}</strong> account has been inactive for a long time.</p><p>To comply with data-minimization rules, it is scheduled for deletion on <strong>${deletionDate}</strong>. Simply sign in before then to keep your account and cancel the deletion.</p>`
  return { subject, html, text }
}
```

- [ ] **Step 4: Run, confirm PASS** — `pnpm --filter convex test emails`, then `pnpm lint`, then prettier check.
- [ ] **Step 5: Checkpoint (NO COMMIT).**

---

## Task 3: Retention predicates + `enforceDataRetention` cron

**Files:** Create `convex/privacy/retention.ts`, `convex/privacy/retention.test.ts`; modify `convex/crons.ts`

- [ ] **Step 1: Write the failing test** — `convex/privacy/retention.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isTokenExpired, isExportExpired, isAuditExpired, isDormant } from './retention'

const NOW = 1_000_000_000_000
const DAY = 24 * 60 * 60 * 1000

describe('retention predicates', () => {
  it('isTokenExpired: true only when a token exists and is past expiry', () => {
    expect(isTokenExpired({ linkedinAccessToken: 't', tokenExpiresAt: NOW - 1 }, NOW)).toBe(true)
    expect(isTokenExpired({ linkedinAccessToken: 't', tokenExpiresAt: NOW + DAY }, NOW)).toBe(false)
    expect(isTokenExpired({ tokenExpiresAt: NOW - 1 }, NOW)).toBe(false) // no token to clear
  })

  it('isExportExpired: true only for ready exports past expiresAt', () => {
    expect(isExportExpired({ status: 'ready', expiresAt: NOW - 1 }, NOW)).toBe(true)
    expect(isExportExpired({ status: 'ready', expiresAt: NOW + DAY }, NOW)).toBe(false)
    expect(isExportExpired({ status: 'pending', expiresAt: NOW - 1 }, NOW)).toBe(false)
  })

  it('isAuditExpired: true when older than the TTL', () => {
    expect(isAuditExpired({ createdAt: NOW - 100 }, NOW, 50)).toBe(true)
    expect(isAuditExpired({ createdAt: NOW - 10 }, NOW, 50)).toBe(false)
  })

  it('isDormant: inactive past threshold, no active/trialing sub, not already scheduled', () => {
    const base = { lastLoginAt: NOW - 1000, subscriptionStatus: 'canceled' as const }
    expect(isDormant(base, NOW, 500)).toBe(true)
    expect(isDormant({ ...base, subscriptionStatus: 'active' }, NOW, 500)).toBe(false)
    expect(isDormant({ ...base, subscriptionStatus: 'trialing' }, NOW, 500)).toBe(false)
    expect(isDormant({ ...base, deletionScheduledAt: 123 }, NOW, 500)).toBe(false)
    expect(isDormant({ subscriptionStatus: 'canceled' }, NOW, 500)).toBe(false) // no lastLoginAt
    expect(isDormant({ ...base }, NOW, 5_000_000)).toBe(false) // within threshold
  })
})
```

- [ ] **Step 2: Run, confirm FAIL** — `pnpm --filter convex test retention`.

- [ ] **Step 3: Implement** — `convex/privacy/retention.ts`:

```ts
// convex/privacy/retention.ts
// Data minimization / storage limitation. A daily cron expires LinkedIn tokens, purges old export
// files + audit logs, and flags dormant accounts for deletion (feeding the Phase 2a deletion cron).
// The predicates are pure + unit-tested; the cron orchestrates with bounded batches.
import { action, internalMutation } from '../_generated/server'
import { v } from 'convex/values'
import { internal } from '../_generated/api'
import { sendEmail } from '../lib/email'
import { dormancyWarningEmail } from './emails'

const AUDIT_TTL_MS = 24 * 30 * 24 * 60 * 60 * 1000 // ~24 months
const DORMANCY_MS = 24 * 30 * 24 * 60 * 60 * 1000 // ~24 months
const GRACE_MS = 30 * 24 * 60 * 60 * 1000
const RETENTION_BATCH = 100

export function isTokenExpired(u: { linkedinAccessToken?: string; tokenExpiresAt?: number }, now: number): boolean {
  return !!u.linkedinAccessToken && typeof u.tokenExpiresAt === 'number' && u.tokenExpiresAt < now
}

export function isExportExpired(r: { status: string; expiresAt?: number }, now: number): boolean {
  return r.status === 'ready' && typeof r.expiresAt === 'number' && r.expiresAt < now
}

export function isAuditExpired(a: { createdAt: number }, now: number, ttlMs: number): boolean {
  return a.createdAt < now - ttlMs
}

export function isDormant(
  u: { lastLoginAt?: number; subscriptionStatus?: string; deletionScheduledAt?: number },
  now: number,
  thresholdMs: number
): boolean {
  if (u.deletionScheduledAt) return false
  if (typeof u.lastLoginAt !== 'number') return false
  if (u.subscriptionStatus === 'active' || u.subscriptionStatus === 'trialing') return false
  return now - u.lastLoginAt >= thresholdMs
}

function dayStr(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export const enforceDataRetention = internalMutation({
  args: {},
  handler: async ctx => {
    const now = Date.now()

    // 1. Null expired LinkedIn tokens.
    const usersWithTokens = await ctx.db
      .query('users')
      .filter(q => q.neq(q.field('linkedinAccessToken'), undefined))
      .take(RETENTION_BATCH)
    for (const u of usersWithTokens) {
      if (isTokenExpired(u, now)) {
        await ctx.db.patch(u._id, { linkedinAccessToken: undefined, linkedinRefreshToken: undefined })
      }
    }

    // 2. Expire + delete old export files.
    const readyExports = await ctx.db
      .query('dataExportRequests')
      .filter(q => q.eq(q.field('status'), 'ready'))
      .take(RETENTION_BATCH)
    for (const r of readyExports) {
      if (isExportExpired(r, now)) {
        if (r.fileStorageId) await ctx.storage.delete(r.fileStorageId)
        await ctx.db.patch(r._id, { status: 'expired' })
      }
    }

    // 3. Purge old audit logs.
    const oldAudits = await ctx.db
      .query('auditLogs')
      .withIndex('by_created', q => q.lt('createdAt', now - AUDIT_TTL_MS))
      .take(RETENTION_BATCH)
    for (const a of oldAudits) await ctx.db.delete(a._id)

    // 4. Dormancy: flag long-inactive non-subscribers for deletion (feeds processAccountDeletions).
    const dormancyThreshold = now - DORMANCY_MS
    const candidates = await ctx.db
      .query('users')
      .filter(q => q.and(q.eq(q.field('deletionScheduledAt'), undefined), q.lt(q.field('lastLoginAt'), dormancyThreshold)))
      .take(RETENTION_BATCH)
    for (const u of candidates) {
      if (isDormant(u, now, DORMANCY_MS)) {
        const scheduledAt = now + GRACE_MS
        await ctx.db.patch(u._id, { deletionScheduledAt: scheduledAt, deletionReason: 'dormancy' })
        const email = u.email as string | undefined
        if (email) await ctx.scheduler.runAfter(0, internal.privacy.retention.sendDormancyWarning, { email, deletionDate: dayStr(scheduledAt) })
      }
    }
  }
})

export const sendDormancyWarning = action({
  args: { email: v.string(), deletionDate: v.string() },
  handler: async (_ctx, { email, deletionDate }) => {
    const m = dormancyWarningEmail(deletionDate)
    await sendEmail({ to: email, subject: m.subject, html: m.html, text: m.text })
  }
})
```

> The `by_created` index exists on `auditLogs` (Phase 1). Token/export/dormancy steps use bounded
> `.filter().take()` scans (consistent with `deleteExpiredSessions`/`processAccountDeletions`); the
> pure predicates are the source of truth and re-check each row. `new Date(ms)` with an explicit arg
> is fine (only argless `Date.now()`/`new Date()` are restricted, in workflow scripts).

- [ ] **Step 4: Register the cron** — in `convex/crons.ts`, before `export default crons`:

```ts
// Data minimization: expire tokens, purge old export files + audit logs, flag dormant accounts.
crons.interval('enforce data retention', { hours: 24 }, internal.privacy.retention.enforceDataRetention, {})
```

- [ ] **Step 5: Run + verify** — `pnpm --filter convex test retention`, then full suite
  `pnpm --filter convex test`, then `pnpm lint`, then `npx prettier --check "convex/privacy/retention.ts" "convex/privacy/retention.test.ts" "convex/crons.ts"` (write+recheck if needed).

- [ ] **Step 6: Checkpoint (NO COMMIT).**

---

## Task 4: Documentation — §13B + §13 cron

**Files:** Modify `docs/PLATFORM.md`

- [ ] **Step 1: Add the cron row** to §13:

```markdown
| `enforce data retention` | every **24h** | `privacy/retention.enforceDataRetention` | Null expired LinkedIn tokens; purge expired export files + audit logs (>24mo); flag dormant accounts (24mo, non-subscribers) for deletion. Batched. |
```

- [ ] **Step 2: Extend §13B** with a "Consent & Retention (Phase 3a)" subsection covering: consent
  (`consentRecords` append-only; `recordConsent`/`getConsents`/`hasConsent`; latest-record-wins via
  `latestConsentByPurpose`), re-consent (`acknowledgePolicy` stamps `acknowledgedPolicyVersion` to
  `POLICY_VERSION`), and retention (`enforceDataRetention`: token nulling, export-file expiry,
  audit-log TTL, **dormancy** at 24mo excluding active/trialing subscribers → sets `deletionScheduledAt`
  + `deletionReason='dormancy'` → reuses the Phase 2a `processAccountDeletions` cascade; re-login →
  CancelDeletionScreen → cancel, same as a user request). Note `getMe` already exposes
  `acknowledgedPolicyVersion` for the Phase 3b re-consent prompt.

- [ ] **Step 3: Update the footer** "Last updated" note to mention Phase 3a.

- [ ] **Step 4: Verify + Checkpoint (NO COMMIT)** — re-read §13B; confirm Markdown renders.

---

## Phase 3a completion check
- [ ] `pnpm --filter convex test` — all green (new: consent, emails dormancy, retention predicates).
- [ ] `pnpm lint` — zero warnings.
- [ ] `npx prettier --check` on the new/modified convex files — clean.
- [ ] Deliverables: `consent.ts`, `retention.ts` (+ tests), `dormancyWarningEmail`, `enforce data
  retention` cron, `docs/PLATFORM.md` updated.
- [ ] **Nothing committed.**

## Self-Review (performed during authoring)
- **Spec coverage:** consent records + record/get/check (§4.1 → Task 1), re-consent backend (§4.5 →
  Task 1 `acknowledgePolicy`), retention rules (§4.3 → Task 3), dormancy (§3.5 → Task 3 `isDormant` +
  cron, reusing Phase 2a's cascade), dormancy email (Task 2), docs (Task 4). Consent toggles UI +
  PolicyUpdateModal + cookie notice/page are Phase 3b.
- **Placeholder scan:** none; complete code throughout (the `hasConsent` note offers a fallback, not a TODO).
- **Type/name consistency:** `latestConsentByPurpose` shape matches its tests + `getConsents`/`hasConsent`;
  retention predicates match their tests + the cron's per-row re-checks; `deletionReason='dormancy'`
  and `deletionScheduledAt` match the Phase 1 schema + Phase 2a cascade; `internal.privacy.retention.*`
  matches the defined exports.
- **No-commit rule:** every task ends in a no-commit checkpoint.
```
