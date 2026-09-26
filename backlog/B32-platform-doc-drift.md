# B32 — Fix `PLATFORM.md` doc drift (stale claims)

> **Status:** TODO (re-verified 2026-08-20 — the heavy `PLATFORM.md` rewrites in `8417b51` + `5fe86b8` did **not** touch a single listed claim; all still stale, plus 2 more found) · **Priority:** P2 · **Effort:** S · **Category:** Docs
> **Depends on:** — · **Blocks:** Trustworthy canonical docs (the CLAUDE.md "keep `docs/PLATFORM.md` in sync" rule)

## Summary

`docs/PLATFORM.md` is the canonical platform doc, but several sections still describe features as future/deferred that
are **already built and documented live elsewhere in the same file**, and the repo-layout tree still names **dead deploy
targets** and a **moved CSP location**. One env-var claim is factually wrong (calls a gitignored file "committed"), and
the §19 stubs list is missing the one genuinely-deferred feature. This is pure documentation cleanup: correct each stale
claim in place. Every claim below was re-verified against current code; **the executor edits `docs/PLATFORM.md` when
working this item — not now** (this backlog file only records the plan).

## Evidence

**Verified stale — AI comment generator (it IS built):**
- `docs/PLATFORM.md:2551` — "**AI comment generator** — `CommentBox` advertises 'AI suggestions coming soon'; no
  integration." → **FALSE**. `app/src/components/CommentBox.tsx:36` = `const generate = useAction(api.ai.comments.generateComment)`;
  `convex/ai/openrouter.ts`, `convex/ai/comments.ts`, `convex/ai/reactions.ts` all exist; the feature is documented
  **live** at `§11A` (`docs/PLATFORM.md:1286-1310+`).
- `docs/PLATFORM.md:84` — tiers table row "AI comment generator | ✗ (future) …" is stale.
- `docs/PLATFORM.md:88` — "AI is a UI placeholder" is stale.
- `docs/PLATFORM.md:2559` — Roadmap line still lists "AI comment generator (Pro+)".

**Verified stale — trial UI Plan 2C (it IS shipped):**
- `docs/PLATFORM.md:102` and `docs/PLATFORM.md:1210` — "**Plan 2C, deferred to after the app/ UI revamp**" → stale. Built:
  `app/src/hooks/useCardGate.ts`, consumed by `app/src/pages/FeedPage.tsx` and `app/src/components/shell/Sidebar.tsx`;
  documented **shipped** at `§14 "Trial UI (Plan 2C)"` (`docs/PLATFORM.md:2071+`).
- `docs/superpowers/plans/2026-06-20-plan-2b-trial-backend.md:350` — carries the same stale "Plan 2C (deferred to
  post-revamp)" note; a historical plan doc (correcting it is optional; primary target is `PLATFORM.md`).

**Verified stale — repo-layout tree names dead deploy targets & moved CSP (§4):**
- `docs/PLATFORM.md:187` — "`landing/ … → Vercel`" → now **Cloudflare Workers (OpenNext)**; contradicts `§2:112`;
  `landing/wrangler.jsonc` exists.
- `docs/PLATFORM.md:203` — "`app/ … → Railway`" → now **Cloudflare Workers (Static Assets)**; contradicts `§2:113`;
  `app/wrangler.jsonc` exists.
- `docs/PLATFORM.md:204` — "`index.html # mount point + strict CSP meta`" → stale. `app/index.html` has **no** CSP meta
  (grep finds none); the CSP now lives in the generated `app/dist/_headers`, produced by `app/scripts/gen-headers.mjs`.

**Verified inaccurate — webhook-secret wording (§19):**
- `docs/PLATFORM.md:2554-2555` — "`STRIPE_WEBHOOK_SECRET=whsec_your_secret` in the committed `.env.local`" → inaccurate
  on two counts: (1) `.env.local` is **gitignored** (`.gitignore:2-4`: `.env*` ignored, only `!.env.example` /
  `!.env.local.example` tracked), so it is **not committed**; (2) the placeholder actually lives in the tracked
  `convex/.env.local.example:6`. `plans/README.md:73` records this as a rejected finding: "**Committed secrets — FALSE**
  … never tracked."

**Verified doc gap — deferred global search not in stubs (§19):**
- `docs/PLATFORM.md:2547-2555` (Stubs / planned) lists post-visibility, AI comment generator, featured-posts quota,
  LinkedIn token refresh, placeholder constants — but **no** entry for the deferred **global search / ⌘K command
  palette** (`docs/superpowers/plans/2026-06-20-topbar-search-command-palette.md`). Cross-ref [[B08]].

## Root cause

The AI-assist feature and the Plan-2C trial UI were built and documented in their own sections (`§11A`, `§14`) and the
frontends were migrated to Cloudflare Workers (`§2`, `wrangler.jsonc`), but the **older summary/overview/tree sections**
(`§1`, `§4`, `§11`, `§19`) were never updated in the same change — the "keep docs in sync" step was skipped. The result
is a doc that contradicts itself.

## What we need to do

Edit **`docs/PLATFORM.md`** (the executor does this when working the item):

1. **§1 tiers table + notes** — `:84` change the AI-comment-generator row from "✗ (future) … ✓ (future)" to reflect the
   live feature (per `§11A`); `:88` drop "AI is a UI placeholder" (keep the accurate `featuredPostUsage`-unwired note).
2. **§1 / §11 trial-UI status** — `:102` and `:1210` remove "Plan 2C, deferred to after the app/ UI revamp"; state it is
   **shipped** and point to `§14`.
3. **§4 repo tree + deploy targets** — `:187` `landing/ … → Vercel` → **Cloudflare Workers (OpenNext)**; `:203`
   `app/ … → Railway` → **Cloudflare Workers (Static Assets)**; `:204` replace "strict CSP meta" — CSP now generated into
   `dist/_headers` via `app/scripts/gen-headers.mjs` (add/point to that).
4. **§19 stubs** — remove the "AI comment generator … no integration" stub (`:2551`); move AI comment generation out of
   the Roadmap line (`:2559`) or reword to reflect it is shipped.
5. **§19 webhook-secret wording** — `:2554-2555` reword to: the placeholder `STRIPE_WEBHOOK_SECRET=whsec_your_secret`
   lives in the **tracked** `convex/.env.local.example`; real `.env.local` files are gitignored and never committed.
6. **§19 add global-search-deferred entry** — add a Stubs/planned bullet for the deferred global search / ⌘K palette,
   citing `docs/superpowers/plans/2026-06-20-topbar-search-command-palette.md` and cross-linking [[B08]].
7. **Re-verify each `:line` against current code before editing** (line numbers drift as the file changes).

## Acceptance criteria

- [ ] `§1` no longer describes AI comment generation as future / a UI placeholder.
- [ ] `§1` + `§11` no longer call the trial UI "Plan 2C, deferred"; they reference the shipped `§14` implementation.
- [ ] `§4` repo tree names **Cloudflare Workers** for both `landing/` and `app/`, and the CSP location points to the
      generated `dist/_headers` (not `index.html`).
- [ ] `§19` has no "AI comment generator … no integration" stub; the webhook-secret bullet is accurate; a
      global-search-deferred bullet exists.
- [ ] No other `PLATFORM.md` section still contradicts `§2` / `§11A` / `§14`.
- [ ] `pnpm verify` is green (docs-only change — should be a no-op, confirm it still passes).
- [ ] `docs/PLATFORM.md` updated **is** the deliverable here (see **Docs to update**).

## Risks / edge cases / open questions

- **Do not fix anything now** — this backlog file only records the plan; edits happen when the item is executed.
- Line numbers will have drifted; treat every `:line` above as "approximately here — re-grep the quoted string".
- Keep the accurate parts intact: `featuredPostUsage`-unwired, post-visibility "Coming soon", LinkedIn token refresh, and
  `BannedScreen.SUPPORT_EMAIL` placeholder are all still valid stubs — do not delete them.
- The AI default model slug (`google/gemma-4-26b-a4b-it`, `§11A:1290`) may itself be invalid (separate item B02) — that
  is out of scope here; only the "no integration" framing is being corrected.
- Optional: also correct the mirrored stale note in `docs/superpowers/plans/2026-06-20-plan-2b-trial-backend.md:350`, but
  historical plan docs are lower priority than the canonical `PLATFORM.md`.

## Docs to update

- `docs/PLATFORM.md` §1, §4, §11, §19 — the corrections above (this item **is** a `PLATFORM.md` edit).
- (Optional) `docs/superpowers/plans/2026-06-20-plan-2b-trial-backend.md` — annotate the shipped status of Plan 2C.

## References

- Related: [[B08]] (the deferred global search / ⌘K palette that §19 should list)
- Prior art / plan: `docs/PLATFORM.md` §2, §11A, §14 (the correct, live descriptions); `plans/README.md:73` (committed-
  secrets = FALSE); `docs/superpowers/plans/2026-06-20-topbar-search-command-palette.md`

## Update — 2026-08-20

Two commits (`8417b51` first-post onboarding, `5fe86b8` HoverCard→toast) rewrote large swaths of `docs/PLATFORM.md`
(~192 + ~1759 lines). Re-verified every claim above against the **current** file (HEAD = `8417b51`). **Result: none of
the listed claims were fixed** — the rewrites reworked the onboarding/AI-flow/toast prose but left the stale
overview/tree/stubs sections (§1, §4, §11, §19) untouched. Line numbers drifted; refreshed below. **Status stays TODO.**

| # | Claim | State | Current location |
|---|-------|-------|------------------|
| 1 | AI comment generator "no integration" / "UI placeholder" / "✗ (future)" | ❌ still stale | table row `:84`; "AI is a UI placeholder" `:88`; §19 stub "…no integration." `:2561`; Roadmap "AI comment generator (Pro+)" `:2569` — feature is live (§11A `:1293/:1346/:1369`, `CommentBox` → `api.ai.comments.generateComment`, `convex/ai/comments.ts` edited in `5fe86b8`) |
| 2 | Trial UI "Plan 2C, deferred to after the app/ UI revamp" | ❌ still stale | `:102` and `:1214` (was `:1210`) — contradicts §14 "Trial UI (Plan 2C)" `:2078`, which documents it **shipped** (`app/src/hooks/useCardGate.ts` present) |
| 3 | §4 repo tree names Vercel/Railway + "strict CSP meta" in index.html | ❌ still stale | `landing/ … → Vercel` `:187`; `app/ … → Railway` `:203`; `index.html … strict CSP meta` `:204` — real CSP is generated into `dist/_headers` by `app/scripts/gen-headers.mjs` (correctly described elsewhere at `:2454-2455`, `:2530`) |
| 4 | `STRIPE_WEBHOOK_SECRET=whsec_your_secret` "in the committed `.env.local`" | ❌ still stale | `:2565` — `.env.local` is gitignored; the placeholder lives in the tracked `convex/.env.local.example` |
| 5 | §19 stubs missing the deferred global-search / ⌘K entry | ❌ still missing | stubs list `:2559-2565` (post-visibility, AI comment gen, featured-posts, token refresh, placeholder constants) — no global-search bullet; cross-ref [[B08]] |

**Two additional drift claims confirmed (fold into the same fix):**

- **§5 consent — "Queried via `by_user_and_purpose` index" is FALSE** (`docs/PLATFORM.md:511`). The only reader,
  `getConsents`, queries via **`by_user`** (`convex/privacy/consent.ts:61`, then `latestConsentByPurpose` filters in JS).
  The `by_user_and_purpose` index (`convex/schema.ts:247`, doc `:523`) has **no query call site** — it is dead. Reword to
  "queried via `by_user`; latest-per-purpose resolved in code," and note the index is unused. Cross-ref [[B20]] (dead
  index) / [[B23]] (same doc block).
- **§15 landing legal — "A draft banner (translated) is shown in all locales" is FALSE** (`docs/PLATFORM.md:2277`, heading
  `:2262`). Per [[B29]] and re-grep of `landing/app/[lang]/{privacy,terms,cookies}/content/{en,pt,es}.tsx`: the landing
  legal pages render **no** literal DRAFT banner in any locale (only an inline "drafted by counsel" note in
  `terms/content/en.tsx:132` and unrelated "draft comment" AI copy in `privacy/content/en.tsx:122`). Reword so it does not
  claim a shown banner; the "drafts pending legal review" characterization is fine as internal status but not as a rendered
  user-facing banner. Cross-ref [[B29]].

All `:line` refs are current as of 2026-08-20; re-grep the quoted strings before editing (the file drifts on every commit).
