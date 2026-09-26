# B21 — Remove or wire written-never-read columns

> **Status:** TODO (re-verified 2026-08-20) · **Priority:** P3 · **Effort:** S · **Category:** Data cleanup
> **Depends on:** — · **Blocks:** — (per-field: `featuredAt` is subsumed by [[B07]])

## Summary

Four schema columns are **written by application code but never read** by any query, UI, or business
logic. Each is either a value worth surfacing to the user (so wire it up) or a genuine "mystery
column" (so stop writing it and drop it). None is load-bearing today, so this is pure hygiene; the
goal is that every persisted field has a reader or a reason. Pre-launch, **no prod data** — dropping
any column is a plain schema edit, no backfill.

## Evidence

- `convex/schema.ts:151` — `subscriptions.currentPeriodEnd: v.optional(v.number())`. **Written**:
  `convex/stripe.ts:90` and `:98` (`currentPeriodEnd: args.currentPeriodEnd` on patch/insert),
  fed from the webhook at `convex/http.ts:147` and `:158`
  (`sub.current_period_end ? sub.current_period_end * 1000 : undefined`). **No reader**: no query
  returns it — `getSubscriptionInfo` (`convex/users.ts:204-247`) returns only
  `tier`/`status`/`cancelAtPeriodEnd`/`stripeSubscriptionId` (`:231-236`, `:240-245`) — and no UI
  reads `.currentPeriodEnd` (only doc/inventory mentions: `docs/PLATFORM.md:423`,
  `docs/compliance/DATA-INVENTORY.md:151,406`).
- `convex/schema.ts:57` — `users.emailVerified: v.optional(v.boolean())`. **Written**:
  `convex/linkedin/auth.ts:48` and `:67`, from the OIDC `email_verified` claim at
  `convex/http.ts:95`. **No prod reader** — the only read is a test assertion
  (`convex/linkedin/auth.test.ts:66` `expect(inserted.emailVerified).toBe(true)`), which merely
  proves it was persisted.
- `convex/schema.ts:60` — `users.deletionRequestedAt: v.optional(v.number())`. **Written**
  `convex/privacy/deletion.ts:135` (on deletion request) and **cleared**
  `convex/privacy/deletion.ts:157` (on cancel). **No reader** — all deletion-lifecycle logic keys on
  `deletionScheduledAt` (the cron target and the idempotency guard at `deletion.ts:132`), never on
  `deletionRequestedAt`.
- `convex/schema.ts:101` — `posts.featuredAt: v.optional(v.number())`. **Only ever written as
  `undefined`**: `convex/jobs/syncPosts.ts:113` (`featuredAt: undefined`). Never set to a real value,
  never read. The whole featured-posts write path is missing — tracked by [[B07]].
- Note: `currentPeriodEnd`, `emailVerified`, and `deletionRequestedAt` all ride along in the DSR
  export because it returns whole docs (`convex/privacy/export.ts:96` returns `user` and
  `subscriptions` as-is). That is a pass-through, not a functional read — dropping a field just
  removes an always-present-or-absent key from the export bundle.

## Root cause

Each column was added when its writer was built, on the assumption a reader would follow:
`currentPeriodEnd` for a future "renews on" display, `emailVerified` mirroring the OIDC claim,
`deletionRequestedAt` for a DSR audit trail, `featuredAt` for the unbuilt featured-posts feature. The
readers were never built, leaving values written into the void.

## What we need to do

Per field, **decide surface-it vs stop-writing-and-drop**, then execute:

1. **`subscriptions.currentPeriodEnd` → surface (recommended).** It is the subscription renewal/period
   end and is genuinely useful. Return it from the billing query and render it on `BillingPage`
   (§14 Pages / §8 Billing) as "Renews on {date}" / "Access until {date}". Keep the column; add the
   reader. (If product decides billing UI won't show it, then instead stop writing it at
   `stripe.ts:90/98` + `http.ts:147/158` and drop `schema.ts:151`.)
2. **`users.emailVerified` → drop (recommended).** LinkedIn OIDC emails are provider-verified, so the
   flag carries no decision value. Stop writing it at `linkedin/auth.ts:48,67` and `http.ts:95`,
   remove the arg from the `upsertUser` validator (`linkedin/auth.ts:85`), drop `schema.ts:57`, and
   update the test at `auth.test.ts:63,66` (it asserts the field — it must change or it will fail).
3. **`users.deletionRequestedAt` → decide.** It is a real audit datapoint (when the user asked, vs
   when the cron will act). Either **surface** it (e.g. in the DSR/account-deletion status shown to
   the user, or an admin/audit view) — in which case keep it and add the reader — **or drop** it if
   `deletionScheduledAt` (already written/read) is sufficient for the audit story, stopping the
   writes at `deletion.ts:135,157` and removing `schema.ts:60`. Confirm with the privacy owner before
   dropping, since it touches the erasure audit trail.
4. **`posts.featuredAt` → defer to [[B07]].** Do nothing here beyond leaving the `undefined` write in
   place; [[B07]] owns the featured-posts write path and will either give this field a real writer +
   reader or remove it. Do not drop it independently or you will collide with that item.
5. For any field dropped: it **is a schema change** — grep first to confirm no reference survives
   (`rg "\.<field>\b" convex app`), remove the writers **before or with** the schema edit so the
   validator and code stay consistent, and rely on the no-prod-data posture (no backfill; dev reset
   acceptable) rather than a migration.

## Acceptance criteria

- [ ] Each of the four fields has a recorded decision (wired-with-reader, or writers-removed +
      dropped, or — for `featuredAt` — explicitly deferred to [[B07]]).
- [ ] For any dropped field: no remaining reference in `convex/` or `app/` (`rg` clean), and its
      writers are removed in the same change.
- [ ] If `emailVerified` is dropped, `convex/linkedin/auth.test.ts` is updated and passes.
- [ ] `pnpm verify` is green (typecheck + lint + tests).
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- `emailVerified` and `deletionRequestedAt` appear in the DSR export pass-through; dropping either
  changes the export bundle shape slightly. Harmless (the fields are effectively always absent/noise),
  but note it so a DSR-format assertion, if one exists, is updated.
- `deletionRequestedAt` is the only field touching the erasure audit trail — get privacy sign-off
  before removing it; when in doubt, surface rather than drop.
- Don't touch `featuredAt` here — it is owned by [[B07]]; a lone drop would fight that item.

## Docs to update

- `docs/PLATFORM.md` §5 (Data Model → Table reference) — for any dropped field, remove its row from
  the `subscriptions` / `users` field tables (e.g. `currentPeriodEnd` row at `:423`).
- `docs/PLATFORM.md` §8 (Billing) and §14 (Pages → BillingPage) — if `currentPeriodEnd` is surfaced,
  document the renewal-date display.
- `docs/compliance/DATA-INVENTORY.md` — if `currentPeriodEnd` is dropped, remove it from the
  `subscriptions` data-category rows (`:151`, `:406`).

## References

- Related: [[B07]] (featured posts — owns `posts.featuredAt`), [[B20]] (dead indexes — sibling
  data-hygiene cleanup), [[B04]] (`trialEndsAt` unwired — the inverse bug: a field that *should* be
  written but isn't).
- Convex guideline: `convex/_generated/ai/guidelines.md` §"Schema guidelines" — removing a column is
  a schema change; keep validators and writers consistent.

## Update — 2026-08-20

Re-verified against current code after commits `8417b51` (onboarding) and `5fe86b8` (toast). **Status unchanged: TODO.** All four fields still written-never-read.

- **`emailVerified` and `deletionRequestedAt` both SURVIVED the onboarding rework** (the concern for this pass). `8417b51` reworked ownership/profile (removed the self-typed `publicIdentifier` onboarding step) but did **not** remove either field. `emailVerified` still written at `linkedin/auth.ts:48,67` (+ validator `:85`, source claim `http.ts:95`), read only by the test at `auth.test.ts:66`. `deletionRequestedAt` still written/cleared at `deletion.ts:135,157`, no keyed reader.
- `subscriptions.currentPeriodEnd` still written (`stripe.ts:90,98` ← `http.ts:147,158`), still unread — re-confirmed `getSubscriptionInfo` (`users.ts:204-247`) does not return it.
- `posts.featuredAt` still only ever `undefined` (`syncPosts.ts:113`) — remains deferred to [[B07]].
- DSR export still returns whole `user`/`subscriptions` docs (`export.ts:96`), so the three ride along as pass-through only.
- Evidence lines corrected (schema.ts grew via `firstPostPromptedAt`): `currentPeriodEnd` `:150`→`:151`; `emailVerified` `:56`→`:57`; `deletionRequestedAt` `:59`→`:60`; `featuredAt` `:100`→`:101`. Writer lines (`stripe.ts`, `http.ts`, `auth.ts`, `deletion.ts`, `syncPosts.ts`, `auth.test.ts`) were not touched by either commit — still exact. PLATFORM.md `currentPeriodEnd` row `:424`→`:423`.
