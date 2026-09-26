# LinkIntoTheSSI — Engineering Backlog

Generated **2026-08-20** from a four-agent codebase audit (schema/data layer, frontend,
backend & integrations, docs/specs/roadmap). Every item below is a **self-contained doc** with
grounded `file:line` evidence and a detailed to-do. Authoring format: [_TEMPLATE.md](_TEMPLATE.md).

> **Repo rule (from `CLAUDE.md`): NEVER commit to git.** These docs are file changes only —
> Henriko makes all commits. When an item is executed, keep `docs/PLATFORM.md` in sync in the
> **same change** (it is the canonical platform doc).

**Status:** TODO · IN PROGRESS · DONE · BLOCKED · REJECTED
**Priority:** 🔴 P0 launch-blocker / silent bug · 🟠 P1 high · 🟡 P2 medium · ⚪ P3 low / cleanup
**Tags:** ⛔ blocked by external (LinkedIn API) · ⚖️ human/legal (not engineering)

> **Reviewed 2026-08-20** against commits `8417b51` (onboarding rework) + `5fe86b8` (toast/handoff).
> **B11 & B12 → ✅ DONE** (LinkedIn post-ownership hardened; vestigial member-API client trimmed).
> **B16 → PARTIAL** (the Settings "LinkedIn Identity" block was removed, resolving those strings; the rest are still hardcoded).
> **B10** dead placeholder code removed, but native sync stays ⛔ blocked on LinkedIn API access.
> Everything else re-verified against current code — statuses unchanged, evidence line-refs refreshed. See each file's `## Update — 2026-08-20`.

> **Executed 2026-08-21 (all 5 P0 items → ✅ DONE, uncommitted — Henriko commits).** Subagent-driven: fresh implementer + task review + fix loop per item, then a whole-branch review. Notes:
> **B02** — the audit's "invalid slug / 404" premise was **stale**: `google/gemma-4-26b-a4b-it` is live on OpenRouter (DeepInfra fp8). Kept the slug, dropped `:floor`, added a fail-loud model-not-found (404) branch. **Compliance flag for legal:** DeepInfra's ZDR has a documented exception — Google logs Gemma prompts/responses for abuse-monitoring.
> **B05** — the planned `@convex-dev/sentinel` component is **not published to npm** (uninstallable), so per Henriko it fell back to a **minimal** build: a top-level React error boundary + a pure PII-scrub helper hardening the existing backend log seams. A durable capture dashboard (Sentinel) remains deferred until the package ships. **B01/B03** required `npx convex codegen`. `pnpm verify`'s format:check still fails on pre-existing repo-wide Prettier drift; the touched files are Prettier-clean and convex 270/270 + app 195/198 (3 pre-existing jsdom) pass.

> **Executed 2026-08-29 (P1 engineering items B06, B07, B13 → ✅ DONE, uncommitted — Henriko commits).** Subagent-driven: fresh implementer + task review + fix loop per item, then a whole-branch review + one scoped fix-wave re-review. B24/B29/B30 stay TODO (⚖️ human/legal — Cloudflare deploy, legal sign-off, DPAs — not engineering). Notes:
> **B06** — shipped the **user-default** visibility model (lists on `users`, copied by all 3 writers at insert). `users.setPostVisibility` validates against `INDUSTRIES`/`COUNTRY_CODES` and enforces the Pro/Contact gate server-side; downgrade **keeps** existing restrictions (no silent reopen).
> **B07** — `featurePost`/`unfeaturePost` with a per-tier monthly cap (`featuredPerMonth`, seeded starter 0 / growth 1 / pro 3 / contact 9999-sentinel), UTC month key, `feedRank` recomputed on **both** paths; **no refund** on unfeature (documented). The 9999 sentinel renders as "unlimited" in the My Posts quota pill.
> **B13** — docs-only env-var matrix in `docs/PLATFORM.md §16` (home + failure-mode per variable, incl. the silent-`starter`-default warning and app↔backend price-ID parity). No code change.
> ⚠️ A stray untracked `app/src/lib/_diag.test.ts` (a failing cookie-diagnostic probe from an unrelated concurrent session) is **not** part of this work — do not commit it with P1.

> **Executed 2026-08-29 (P2 engineering items B09, B14, B16, B27, B28, B32 → ✅ DONE, uncommitted — Henriko commits).** Subagent-driven: fresh implementer + task review + fix loop per item, then a whole-branch **opus** review + one controller-applied fix. B08 was already ✅ DONE (2026-08-21). B25/B26 (Convex `_generated/` regen + worktree integration — need deploy creds + git, human-only) and B31 (⚖️ legal) stay TODO. Gates: convex 292/292 + app 204/204, `tsc` clean, touched files Prettier+ESLint-clean. Notes:
> **B09** — `jobs/syncPosts.upsertPost` now returns `{ postId, created }`; the Apify sync schedules `predictReaction` gated on a pure `shouldPredictReaction` (created-only, no double-schedule). Covers all 3 Apify triggers (cron/Stripe/admin). Queued→promoted posts still bypass prediction (pre-existing, documented `§11A`).
> **B14** — real support address centralized in `app/src/lib/support.ts` (`SUPPORT_EMAIL='contact@linkintothessi.com'`), consumed by `BannedScreen` + `BillingPage`; the test asserts the constant (drift-proof).
> **B16** — 40 i18n keys / 120 leaf strings across en/pt/es (now **structurally identical**, 245 keys each); 9 components de-hardcoded. English values kept textually identical → **0 test edits**. Flips B16 **PARTIAL → DONE**.
> **B27** — approach **B** (in-code, no deploy): `buildTierDefaultRow` single source of truth + self-healing `updateTierDefault` (insert-then-patch). The final review's one MINOR (a 4th hardcoded copy in `admin.ts` `effectiveContactLimits`) was fixed in the same pass → **0 hand-maintained tier-default copies remain**.
> **B28** — verified **no code change** needed: Vite emits hashed `/assets/*.css` (no `/dist/styles.css`); the SPA fallback can't swallow real hashed files. Live-prod-load check deferred to B24 (no prod env yet).
> **B32** — docs-only: fixed **12** stale `PLATFORM.md` claims (Vercel/Railway→Cloudflare, CSP→`dist/_headers`, Plan 2C shipped, AI-comment-generator live, consent index wording, landing draft-banner, `§19` stubs). Skipped its own "add a global-search-deferred stub" (B08 shipped ⌘K) and "keep the SUPPORT_EMAIL stub" (B14 resolved) items — both falsified by later work.
> ⚠️ **Observation (not a bug fixed here):** the AI comment generator is **ungated by subscription tier** (only the trial card-gate + a 30/h rate limit) despite the old roadmap "Pro+" intent — a product-entitlement decision if Pro+ gating is wanted (`convex/ai/comments.ts`).

> **Executed 2026-08-29 (P3 cleanup items B17–B23 → ✅ DONE, uncommitted — Henriko commits).** Subagent-driven: fresh implementer + task review + fix loop per item (3 dispatches A/B/C; B took 1 fix round), then a whole-branch **opus** review → **SHIP-READY** (0 critical / 0 important). Gates: convex 292/292 + app 207/207, `tsc`/ESLint exit 0, touched files Prettier-clean. Notes:
> **B17** — deleted the dead `admin.*` locale namespace from en/pt/es (kept the trio structurally identical).
> **B18** — MyPostsPage delete `window.confirm()`→shared `Modal`; BillingPage 2×`alert()`→`toast()`.
> **B19** — AdminPage render-time `navigate('/')`→declarative `if(!isAdmin) return <Navigate to="/" replace/>` (also fixed a missing-`return` fall-through that painted admin JSX for a non-admin for one frame); admin stays URL-only in nav **by design** (`navItems.test.ts` already asserts its absence).
> **B20** — removed 3 dead indexes. **Trap avoided:** `dataExportRequests.by_status` *looks* dead but is LIVE (`privacy/retention.ts`) — kept.
> **B21** — `emailVerified` dropped (schema+auth+http+test; raw OIDC `email_verified` kept = external contract); `deletionRequestedAt` retained + documented (erasure audit, no reader); `currentPeriodEnd` surfaced in `getSubscriptionInfo` (**both** union branches) + rendered in BillingPage.
> **B22** — narrowed the deprecated `feedback` response columns + deleted the orphaned backfill mutation **atomically** (no prod data → backfill not run).
> **B23** — removed the `location_enrichment` reservation comment (Apify is DEV-only; purpose union unchanged).
> **+4 review follow-ups (F1–F4) → ✅ DONE 2026-08-29** (own task-review → SHIP, 0 findings): **F1** BillingPage cancel+no-date label is now three-way + new `billing.renewal` key (locales now **241** each); **F2** MyPostsPage confirm test now asserts `deletePost` actually fired (per-ref `useMutation` spy); **F3** removed a stale `responseText` fixture in `export.test.ts` (column gone since B22 — reply-text coverage preserved via the `feedbackResponses` test); **F4** added `overscroll-contain` to the shared `DialogContent` (app-wide modal scroll containment).

---

## 🔴 P0 — fix first (three of these are silent bugs, not roadmap)

| # | Item | Category | Effort | Status |
|------|------|----------|--------|--------|
| B01 | [LinkedIn token refresh — never implemented (tokens die at ~60d)](B01-linkedin-token-refresh.md) | Auth / Cron | M | ✅ DONE (2026-08-21) |
| B02 | [AI default model slug — validated (slug is live; `:floor` dropped, fail-loud added)](B02-ai-default-model-slug.md) | AI / Config | S | ✅ DONE (2026-08-21) |
| B03 | [Feed backfill migration missing — legacy posts silently dropped](B03-feed-backfill-migration.md) | Data / Feed | M | ✅ DONE (2026-08-21) |
| B04 | [`trialEndsAt` never written — trial countdown always 0](B04-trial-ends-at-unwired.md) | Billing | S | ✅ DONE (2026-08-21) |
| B05 | [No production error monitoring wired](B05-error-monitoring.md) | Ops / Observability | M | ✅ DONE (minimal, 2026-08-21) |

## 🟠 P1 — high value / launch-critical

| # | Item | Category | Effort | Status |
|------|------|----------|--------|--------|
| B06 | [Post-visibility controls UI (backend enforced, no UI/setter)](B06-post-visibility-controls-ui.md) | Frontend / Feature | M | ✅ DONE (2026-08-29) |
| B07 | [Featured-posts feature — no write path, quota table unwired](B07-featured-posts-feature.md) | Feature / Billing | M | ✅ DONE (2026-08-29) |
| B13 | [Replace env/config placeholders before production](B13-env-config-placeholders.md) | Config | S | ✅ DONE (2026-08-29) |
| B24 | [⚖️ Cloudflare Phase D — prod deploy, domains, CI](B24-cloudflare-phase-d-deploy.md) | Ops / Deploy | L | TODO |
| B29 | [⚖️ Legal sign-off on compliance DRAFTs + remove banners](B29-legal-signoff-drafts.md) | Legal | M | TODO |
| B30 | [⚖️ Sign sub-processor DPAs (incl. OpenRouter)](B30-sign-subprocessor-dpas.md) | Legal | M | TODO |

## 🟡 P2 — medium

| # | Item | Category | Effort | Status |
|------|------|----------|--------|--------|
| B08 | [Global search / ⌘K command palette — built](B08-global-search-command-palette.md) | Frontend / Feature | M | ✅ DONE (2026-08-21) |
| B09 | [AI suggested reaction not generated for Apify-synced posts](B09-ai-reaction-apify-posts.md) | AI | S | ✅ DONE (2026-08-29) |
| B14 | [Real support email (BannedScreen placeholder)](B14-support-email-placeholder.md) | Config / Frontend | S | ✅ DONE (2026-08-29) |
| B16 | [Hardcoded English — i18n gaps (Settings identity block now removed)](B16-hardcoded-english-i18n.md) | i18n | M | ✅ DONE (2026-08-29) |
| B25 | [Regenerate Convex `_generated/` after ^1.41 bump](B25-convex-codegen-regen.md) | Ops | S | ✅ DONE (2026-08-29, Henriko regen; `pnpm typecheck` green) |
| B26 | [Integrate uncommitted worktree (plans 001–008)](B26-integrate-worktree-plans.md) | Ops | S | ✅ DONE (2026-08-29, merged by Henriko; verified in-tree) |
| B27 | [Automate / run `seedPlanLimits`](B27-seed-plan-limits.md) | Ops | S | ✅ DONE (2026-08-29, approach B) |
| B28 | [Confirm built CSS path resolves in prod (likely already fine)](B28-app-styles-css-path.md) | Ops / Frontend | S | ✅ VERIFIED (2026-08-29, no code change) |
| B31 | [⚖️ Lawful-basis, DPO/EU-rep, ANPD/LGPD assessments](B31-legal-basis-dpo-lgpd-assessments.md) | Legal | L | TODO |
| B32 | [Fix `PLATFORM.md` doc drift (still stale after the rewrite)](B32-platform-doc-drift.md) | Docs | S | ✅ DONE (2026-08-29) |

## ⚪ P3 — cleanup / low priority

| # | Item | Category | Effort | Status |
|------|------|----------|--------|--------|
| B15 | [Duplicate `VITE_LANDING_URL` in `app/.env.example`](B15-duplicate-vite-landing-url.md) | Config | S | ✅ DONE (2026-08-29, removed stray line-12 dup) |
| B17 | [Dead `admin.*` locale namespace vs hardcoded admin UI](B17-dead-admin-locale-namespace.md) | i18n | S | ✅ DONE (2026-08-29) |
| B18 | [Replace native `confirm()`/`alert()` with app Modal/toast](B18-native-confirm-alert-dialogs.md) | UX | S | ✅ DONE (2026-08-29) |
| B19 | [AdminPage render-time redirect + missing nav entry](B19-admin-page-guard-and-nav.md) | Frontend / Access | S | ✅ DONE (2026-08-29) |
| B20 | [Remove or justify dead indexes](B20-dead-indexes.md) | Data cleanup | S | ✅ DONE (2026-08-29) |
| B21 | [Remove or wire written-never-read columns](B21-written-never-read-columns.md) | Data cleanup | S | ✅ DONE (2026-08-29) |
| B22 | [Finalize deprecated feedback response columns (backfill + narrow)](B22-deprecated-feedback-columns.md) | Data / Migration | M | ✅ DONE (2026-08-29) |
| B23 | [consent `location_enrichment` purpose not in validator](B23-consent-location-enrichment-purpose.md) | Data / Consent | S | ✅ DONE (2026-08-29) |

## LinkedIn API-gated — B10 ⛔ blocked · B11–B12 ✅ resolved (2026-08-20)

| # | Item | Category | Effort | Status |
|------|------|----------|--------|--------|
| B10 | [Native LinkedIn post sync — blocked (dead placeholder removed)](B10-native-post-sync-blocked.md) | LinkedIn | M | BLOCKED |
| B11 | [Post-ownership hardened — name-anchored, vanity auto-derived](B11-ugc-ownership-verification-blocked.md) | LinkedIn / Security | S | ✅ DONE (2026-08-20) |
| B12 | [Vestigial `callMemberApi` client & dead `fetchUserPosts` (write scopes already trimmed)](B12-api-comment-react-scopes.md) | LinkedIn / Cleanup | S | ✅ DONE (2026-08-20) |

---

### How to work an item

1. Open the item's `.md`, re-verify the evidence against current code.
2. Follow **What we need to do**; tick the **Acceptance criteria**.
3. Update `docs/PLATFORM.md` in the same change; flip **Status** here to `DONE`.
4. Do **not** commit — leave the changes for Henriko.

---

### Sub-backlogs

- **Revenue-centric design (R01–R15):** [revenue/README.md](revenue/README.md) — trial, billing, landing and retention items from the 2026-09-05 RCD audit. Each item is an input for a brainstorming session (SDD), not a finished spec.
