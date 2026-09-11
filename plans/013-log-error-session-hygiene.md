# Plan 013: Backend log redaction, error-type, and session-revocation hygiene

> **Executor instructions**: Follow step by step and run every verification. Honor STOP conditions.
> When done, update this plan's row in `plans/README.md`.
> **Repo rule (`CLAUDE.md`/`AGENTS.md`): NEVER commit or push.** Keep `docs/PLATFORM.md` in sync (Step 5).
>
> **Drift check (run first)**:
>
`git status --porcelain -- convex/lib/auth.ts convex/admin.ts convex/linkedin/client.ts convex/lib/apify.ts convex/lib/email.ts convex/http.ts convex/linkedin/verifyPostOwnership.ts convex/privacy/consent.ts convex/privacy/export.ts convex/privacy/deletion.ts convex/motd/motd.ts convex/sessions.ts`
> Plans 010 and 012 also touch some of these files; if they ran first, compare only the excerpts below
> and leave their changes intact. On a genuine mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S plus an M-sized review surface (many small sites)
- **Risk**: LOW. Log text and error classes change; no control flow changes except the two batched
  deletion loops.
- **Depends on**: plan 010 (verifyPostOwnership), plan 012 (http.ts, sessions.ts) recommended but not
  required; read the drift-check note.
- **Category**: security
- **Planned at**: working tree at commit `ced69ac`, 2026-09-10

## Why this matters

Three consistency gaps against the documented posture:

1. **Redaction gaps.** `docs/PLATFORM.md:5586-5587` says the backend redactor "runs everywhere". Four
   call sites log raw upstream text or PII: `linkedin/client.ts:26` logs the raw response body of a
   request that carried the user's `Authorization` header, `lib/apify.ts:67` logs the raw Apify body,
   `lib/email.ts:34` logs the recipient address, and `http.ts:56` logs caller-influenced OAuth error
   parameters. If an upstream ever echoes request context, a secret or an email lands in Convex logs.
2. **Error-type drift.** `docs/PLATFORM.md:779-787` says user-facing validation, authorization,
   ownership, and gate failures throw `ConvexError`, whose message survives production redaction.
   Many guards still throw plain `Error`, so in production the client sees a generic server error
   instead of the intended message (`lib/auth.ts:52,66`; `admin.ts:17,51`;
   `verifyPostOwnership.ts:48-61`; `privacy/consent.ts:36,71,89`; `privacy/export.ts` Unauthorized
   sites; `privacy/deletion.ts:171,195`; `motd/motd.ts` validation and admin not-found sites).
3. **Incomplete revocation.** `sessions.deleteAllForUser` deletes at most 200 sessions and stops
   (`convex/sessions.ts:96-105`), yet `users.forceLogoutAll` (`convex/users.ts:395-401`) and account
   deletion (`privacy/deletion.ts:179`) rely on it meaning ALL. `deleteExpiredSessions` has the same
   single-batch behavior, so a large expiry backlog can outpace the 6-hour cron.

## Current state

Logging sites:

```ts
// convex/linkedin/client.ts:24-27
if (!res.ok) {
  if (opts.soft?.includes(res.status)) return null
  console.error(`LinkedIn ${opts.action} failed: ${res.status}`, await res.text())
  throw new Error(`Failed to ${opts.action}. Please try again.`)
}

// convex/lib/apify.ts:65-68
if (!res.ok) {
  const body = await res.text()
  console.error(`Apify task run failed: ${res.status}`, body)
  throw new Error(`Apify task run failed: ${res.status}`)
}

// convex/lib/email.ts:33-36
if (!apiKey || !from) {
  console.warn('[email] RESEND_API_KEY/EMAIL_FROM unset — skipping send to', args.to)
  return { sent: false, skipped: true }
}
```

`scrubError` (`convex/lib/scrubError.ts:52-59`) takes any value, redacts sensitive key names,
JSON-parses string bodies, and caps at 500 chars. `linkedin/oauth.ts:56,86`, `ai/openrouter.ts:53`,
and `lib/email.ts:56` already use it, so the pattern is established.

Error-type sites (exact throws to convert):

- `convex/lib/auth.ts:52` `throw new Error('Account suspended')`; `:66` `throw new Error('Unauthorized')`
  (both in `requireAuth`; `requireAuthAction` throws `'Unauthorized'` at `:78` and `:83`).
- `convex/admin.ts:17` `throw new Error('Forbidden: admin access required')`; `:51`
  `throw new Error(disabledMessage)`.
- `convex/linkedin/verifyPostOwnership.ts:48,55,58,61` (ownership mismatch, format hint,
  no stored identifier, vanity mismatch).
- `convex/privacy/consent.ts:36,71,89` `throw new Error('Unauthorized')`.
- `convex/privacy/export.ts` the `Unauthorized` throws (around `:131` and `:246`; grep first).
- `convex/privacy/deletion.ts:171,195` `throw new Error('Unauthorized')`.
- `convex/motd/motd.ts:42,47,52,55` (validation) and `:131,151,162` (not-found / invalid input).

Do NOT convert: internal invariants (`Failed to upsert post`, missing `STRIPE_SECRET_KEY`), the
sanitized external-call errors in `linkedin/client.ts` and `lib/apify.ts` (they are logged with the
real error and deliberately generic to the client), and `lib/rateLimit.ts`'s "Rate limit exceeded".

Session revocation (`convex/sessions.ts:82-105`):

```ts
export const deleteExpiredSessions = internalMutation({
  args: {},
  handler: async ctx => {
    const now = Date.now()
    const expired = await ctx.db.query('sessions').withIndex('by_expires_at', q => q.lt('expiresAt', now)).take(200)
    await Promise.all(expired.map(s => ctx.db.delete(s._id)))
  }
})

export const deleteAllForUser = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const sessions = await ctx.db.query('sessions').withIndex('by_userId', q => q.eq('userId', userId)).take(200)
    await Promise.all(sessions.map(s => ctx.db.delete(s._id)))
  }
})
```

Test styles: `convex/lib/auth.test.ts` (pure guards), `convex/sessions.test.ts` (pure helpers),
`convex/motd/motd.test.ts`, `convex/linkedin/verifyPostOwnership.test.ts`.

## Commands you will need

| Purpose      | Command                     | Expected |
|--------------|-----------------------------|----------|
| Convex tests | `pnpm --filter convex test` | all pass |
| Typecheck    | `pnpm typecheck`            | exit 0   |
| Lint         | `pnpm lint`                 | exit 0   |
| Full gate    | `pnpm verify`               | exit 0   |

## Scope

**In scope**: `convex/lib/auth.ts`, `convex/admin.ts`, `convex/linkedin/client.ts`,
`convex/lib/apify.ts`, `convex/lib/email.ts`, `convex/http.ts` (line 56 only),
`convex/linkedin/verifyPostOwnership.ts`, `convex/privacy/consent.ts`, `convex/privacy/export.ts`,
`convex/privacy/deletion.ts`, `convex/motd/motd.ts`, `convex/sessions.ts`, plus the matching test
files, plus `docs/PLATFORM.md`. **Out of scope**: control flow, messages, status codes, the OAuth cookie/rate-limit work
from plan 012,
and any conversion of internal-invariant errors.

## Git workflow

- Branch: `advisor/013-log-error-session-hygiene`. Do NOT commit or push.

## Steps

### Step 1: Redact the four log sites

- `convex/linkedin/client.ts`: add `import { scrubError } from '../lib/scrubError'`; change to
  `console.error(\`LinkedIn ${opts.action} failed: ${res.status}\`, scrubError (await res.text ()))`.
- `convex/lib/apify.ts`: add the import; change to
  `console.error(\`Apify task run failed: ${res.status}\`, scrubError (body))`.
- `convex/lib/email.ts:34`: drop the recipient, log only the event:
  `console.warn('[email] RESEND_API_KEY/EMAIL_FROM unset — skipping send')`.
- `convex/http.ts:56`: wrap the parameters:
  `console.error('LinkedIn OAuth error param:', scrubError({ error, error_description: url.searchParams.get('error_description') }))`.
  (`scrubError` is already imported in `http.ts:9`.)

**Verify**: `grep -n "res.text()" convex/linkedin/client.ts` shows the `scrubError(` wrapper;
`pnpm --filter convex test` passes.

### Step 2: Convert user-facing guards to `ConvexError`

For each site listed in "Current state", import `ConvexError` from the right module and change
`new Error(<same message>)` to `new ConvexError(<same message>)`. In `convex/motd/motd.ts` and
`convex/linkedin/verifyPostOwnership.ts`, the modules are pure but may import `ConvexError` from
`convex/values` (it works outside a Convex runtime; tests already import these modules directly).
If plan 010 already landed, the new vanity cross-check throw in `verifyPostOwnership.ts` is converted
too. Do not reword any message.

**Verify**: `pnpm --filter convex test` passes. The existing `toThrow('…')` assertions stay valid
because `ConvexError` preserves the message. Add one assertion to `convex/lib/auth.test.ts` that
`assertNotBanned({ isBanned: true })` throws an `instanceof ConvexError` (import from `convex/values`),
so the class is pinned.

### Step 3: Make session revocation complete

In `convex/sessions.ts`:

1. Add a pure helper (exported for tests, mirroring the repo's pure-helper convention):

```ts
export function shouldContinueSessionPurge(deletedCount: number, batchSize: number): boolean {
  return deletedCount === batchSize
}
```

2. `deleteExpiredSessions`: after the batch delete, reschedule when the batch was full:

```ts
if (shouldContinueSessionPurge(expired.length, 200)) {
  await ctx.scheduler.runAfter(0, internal.sessions.deleteExpiredSessions, {})
}
```

3. `deleteAllForUser`: same pattern, rescheduling `internal.sessions.deleteAllForUser` with `{ userId }`.
   Account deletion already tolerates asynchronous completion (the erasure cascade re-selects the
   account), and `forceLogoutAll` revokes the first 200 immediately and the rest within a moment.

4. Ensure `internal` is imported from `./_generated/api` (plan 012 may have added it already).

**Verify**: add tests for `shouldContinueSessionPurge` to `convex/sessions.test.ts`
(true at 200/200, false at 199/200 and 0/200). `pnpm --filter convex test` passes.

### Step 4: Correct the doc claims that this plan makes true

`docs/PLATFORM.md` §17:

- The redaction paragraph (`:5717-5725`) already promises full coverage; add `linkedin/client.ts`
  and `lib/apify.ts` to the wired-at list so it is accurate.
- §6 error convention (`:779-795`): add `lib/auth.ts`, `admin.assertAdmin`, `verifyPostOwnership`,
  the DSR `Unauthorized` guards, and MOTD validation to the enumerated `ConvexError` set.
- §7 sessions bullet: note that `forceLogoutAll` and the expiry purge drain in self-rescheduling
  200-row batches until none remain.

## Test plan

- `convex/lib/auth.test.ts`: `assertNotBanned` now throws a `ConvexError` (message unchanged).
- `convex/sessions.test.ts`: `shouldContinueSessionPurge` cases.
- Existing message assertions in `motd.test.ts` and `verifyPostOwnership.test.ts` must keep passing
  unchanged; that is the regression check that no message was reworded.
- Verification: `pnpm --filter convex test` all pass.

## Done criteria (ALL must hold)

- [ ] `pnpm verify` exits 0
- [ ] `grep -n "console.error" convex/linkedin/client.ts convex/lib/apify.ts convex/http.ts` shows every
  logged dynamic value wrapped in `scrubError` (or dropped, for the email recipient)
- [ ] `grep -rn "new Error('Unauthorized')" convex/lib/auth.ts convex/privacy/` returns no matches
- [ ] `grep -n "ConvexError" convex/linkedin/verifyPostOwnership.ts convex/admin.ts convex/motd/motd.ts`
  finds the conversions
- [ ] `shouldContinueSessionPurge` is used by both session deletions and reschedules on a full batch
- [ ] No error message text changed (diff review)
- [ ] `docs/PLATFORM.md` updated
- [ ] Only in-scope files changed; no commit made
- [ ] `plans/README.md` row updated

## STOP conditions

- A converted guard is matched anywhere by string comparison or caught by a call site that checks
  `err.message`; grep for each message before converting and report any match instead of converting.
- Converting a guard changes a read's soft-fail behavior (for example `getMe` relies on catching a
  specific class): reads catch any `Error` today, but if a `instanceof` check exists, STOP.
- `deleteAllForUser`'s reschedule creates a loop that never drains because deleting 200 rows takes
  more than one scheduler tick repeatedly: report; do not raise the batch size blindly.

## Maintenance notes

- New user-facing guards should use `ConvexError`; the §6 list is the reference.
- `RATE_LIMIT_ACTIONS` (plan 014) adds names; `resetUserRateLimits` handles erasure.
- Reviewer: confirm no `console.error` still logs a raw `await res.text()` body, and that internal
  invariants remain plain `Error` on purpose.
