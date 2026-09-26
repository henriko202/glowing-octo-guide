# B13 — Replace env/config placeholders before production

> **Status:** ✅ DONE (2026-08-29, uncommitted) · **Priority:** P1 · **Effort:** S · **Category:** Config
> **Depends on:** — · **Blocks:** [[B24]] (a prod deploy is meaningless until every real value is set)

## Summary

Every `.env*.example` in the repo still ships placeholder values (`price_xxx`, `sk_test_your_key`,
`whsec_your_secret`, `your_linkedin_client_id`, `your-deployment.convex.cloud`, …). These files are
**templates that stay as placeholders** — the real values belong in the **Convex dashboard** (backend
secrets) and the **Cloudflare Worker build settings** (`VITE_*` / `NEXT_PUBLIC_*` build-time vars), not
in committed files. This item is a **deployment checklist**: a definitive matrix of every variable, where
it lives, and exactly what breaks at runtime if it is left unset or placeholder. Several unset values fail
loudly (a thrown error), but at least one fails **silently** (wrong Stripe tier billed), which is why the
matrix matters. Secret entry itself is a human task — never paste real keys into the repo.

## Evidence

Backend template — `convex/.env.local.example`:
- `:1-2` — `LINKEDIN_CLIENT_ID=your_linkedin_client_id`, `LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret` (placeholder)
- `:3` — `LINKEDIN_REDIRECT_URI=http://localhost:5173/auth/linkedin/callback` (dev value; prod callback differs)
- `:4` — `APP_URL=http://localhost:5173` (dev value; `billingNode.ts:37` falls back to this)
- `:5` — `STRIPE_SECRET_KEY=sk_test_your_key` (placeholder)
- `:6` — `STRIPE_WEBHOOK_SECRET=whsec_your_secret` (placeholder)
- `:7-9` — `STRIPE_STARTER_PRICE_ID` / `STRIPE_GROWTH_PRICE_ID` / `STRIPE_PRO_PRICE_ID` all `=price_xxx`
- `:12-14` — `STRIPE_STARTER_ANNUAL_PRICE_ID` / `STRIPE_GROWTH_ANNUAL_PRICE_ID` / `STRIPE_PRO_ANNUAL_PRICE_ID` all `=price_xxx`
- `:15` — `APIFY_API_TOKEN=your_apify_api_token` (placeholder)
- `:16-17` — `APIFY_TASK_ID` / `APIFY_TASK_ID_PROFILE_SCRAPE` (real default task slugs, no change needed)
- `:21` — `OPENROUTER_API_KEY=` (blank ⇒ AI features no-op; see comment `:18-20`)
- `:22` — `OPENROUTER_MODEL=` (blank ⇒ in-code default `google/gemma-4-26b-a4b-it` — that default is itself broken, see [[B02]])
- `:26-27` — `OPENROUTER_SITE_URL` / `OPENROUTER_SITE_NAME` (optional attribution, safe blank)

App template — `app/.env.example` (Vite, `VITE_` prefix, **build-time**):
- `:1` — `VITE_CONVEX_URL=https://your-deployment.convex.cloud` (placeholder)
- `:2` — `VITE_CONVEX_SITE=https://your-deployment.convex.site` (placeholder)
- `:4` and `:12` — `VITE_LANDING_URL` defined **twice** with different values (dup — see [[B15]])
- `:5-7` — `VITE_STRIPE_STARTER_PRICE_ID` / `_GROWTH_` / `_PRO_` all `=price_xxx`
- `:9-11` — `VITE_STRIPE_STARTER_ANNUAL_PRICE_ID` / `_GROWTH_` / `_PRO_` all `=price_xxx`
- `:15` — `VITE_COOKIE_DOMAIN=` (blank = host-only cookie; prod wants `.linkintothessi.com`)

Landing template — `landing/.env.example` (Next.js, `NEXT_PUBLIC_` prefix, **build-time**):
- `:1` — `NEXT_PUBLIC_APP_URL=https://app.linkintothessi.com` (real default)
- `:3` — `NEXT_PUBLIC_CONVEX_SITE=https://your-deployment.convex.site` (placeholder; landing CTAs deep-link `${NEXT_PUBLIC_CONVEX_SITE}/auth/linkedin`)
- `:7` — `NEXT_PUBLIC_COOKIE_DOMAIN=` (blank = host-only; prod wants `.linkintothessi.com`)

Runtime failure points:
- `convex/billingNode.ts:13-15` — `stripe()` throws `'STRIPE_SECRET_KEY is not configured'` if the key is unset.
- `convex/billingNode.ts:26` — `if (!ALLOWED_PRICE_IDS.has(priceId)) throw new Error('Invalid price ID')` — every checkout fails if the backend Stripe price IDs are unset (empty `ALLOWED_PRICE_IDS`) or if the app sends the placeholder `price_xxx`.
- `convex/lib/stripePrices.ts:22-28` — `resolveTier` logs and **silently defaults an unknown/blank `priceId` to `starter`**; a webhook whose price isn't in the map bills the user as starter regardless of what they bought.
- `convex/lib/stripePrices.ts:30-31` — `ALLOWED_PRICE_IDS` is built once at module load from `process.env`; if none of the six `STRIPE_*_PRICE_ID` vars are set it is an empty `Set`.

## Root cause

The `.example` files are the checked-in templates; production values are intentionally kept out of the
repo (secrets) and supplied through the deployment platforms. Nobody has yet produced the authoritative
"what to set where" list, so a launch could ship with placeholders and only discover it when checkout or
OAuth fails — or worse, when a customer is silently billed the wrong tier.

## What we need to do

1. **Do not edit the `.example` files' placeholder values** — they stay as templates. (The only exception
   is the [[B15]] duplicate-line cleanup and the [[B02]] default-model fix, which are their own items.)
2. **Produce the env-var MATRIX** in `docs/PLATFORM.md §16` (already the Environment Variables section, with
   sub-sections at "Convex backend", "Frontend build-time", "App (`app/`)", "Landing (`landing/`)"). For
   each variable list: **name · where it lives · required?/optional · what breaks if unset**. Suggested rows:

   | Variable | Home | If unset / placeholder |
   |---|---|---|
   | `STRIPE_SECRET_KEY` | Convex dashboard | `billingNode.ts:13` throws on any checkout/portal call |
   | `STRIPE_WEBHOOK_SECRET` | Convex dashboard | Stripe webhook signature check fails → no subscription sync |
   | `STRIPE_{STARTER,GROWTH,PRO}_PRICE_ID` + `_ANNUAL_` | Convex dashboard | empty `ALLOWED_PRICE_IDS` → `billingNode.ts:26` `'Invalid price ID'`; webhook tier silently defaults to `starter` (`stripePrices.ts:22-28`) |
   | `LINKEDIN_CLIENT_ID` / `_SECRET` | Convex dashboard | OAuth login fails |
   | `LINKEDIN_REDIRECT_URI`, `APP_URL` | Convex dashboard | OAuth callback / Stripe return URLs point at localhost |
   | `APIFY_API_TOKEN` | Convex dashboard | Apify post/profile sync fails (feature is dev-gated regardless) |
   | `OPENROUTER_API_KEY` | Convex dashboard | AI no-op: reactions default `LIKE`, Generate reports "AI unavailable" |
   | `OPENROUTER_MODEL` | Convex dashboard (optional) | falls back to in-code default — currently broken, see [[B02]] |
   | `VITE_CONVEX_URL` / `VITE_CONVEX_SITE` | Cloudflare (app build) | app cannot reach the backend at all |
   | `VITE_STRIPE_*_PRICE_ID` (6) | Cloudflare (app build) | app sends `price_xxx` → `billingNode.ts:26` `'Invalid price ID'` |
   | `VITE_LANDING_URL`, `VITE_COOKIE_DOMAIN` | Cloudflare (app build) | sign-out redirect / cross-site cookie misconfigured |
   | `NEXT_PUBLIC_CONVEX_SITE` | Cloudflare (landing build) | landing "Sign in" CTA deep-links to a broken OAuth URL |
   | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_COOKIE_DOMAIN` | Cloudflare (landing build) | app links / cross-site cookie misconfigured |

3. **Cross-check parity:** every `VITE_STRIPE_*_PRICE_ID` must equal the corresponding Convex
   `STRIPE_*_PRICE_ID` (the app passes the ID the backend then validates), and the six annual IDs must be
   created in Stripe first. Note this coupling in the matrix.
4. **Human step (not code):** Henriko enters real secrets in the Convex dashboard and Cloudflare build env
   during the [[B24]] deploy. This item's deliverable is the checklist/matrix, not the values.

## Acceptance criteria

- [ ] `docs/PLATFORM.md §16` contains the full matrix (home + failure mode per variable), including the
      silent-`starter`-default warning and the app↔backend price-ID parity requirement.
- [ ] The `.example` files remain placeholder-only (no real secrets committed).
- [ ] `pnpm verify` is green (typecheck + lint + tests) — no code change expected from this item.
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- The `starter` silent-default (`stripePrices.ts:22-28`) is the dangerous one: a misconfigured webhook
  price map under-bills without any error. Consider whether the matrix should recommend hardening that to
  throw/alert instead of defaulting — but that is a behavior change, out of scope here (flag it).
- `OPENROUTER_MODEL` blank relies on the in-code default, which [[B02]] says is invalid — the matrix should
  point at [[B02]] rather than imply blank is safe.
- Placeholders that are *already real* (`APIFY_TASK_ID*`, `NEXT_PUBLIC_APP_URL`) should be marked "no change"
  so nobody wastes time replacing them.

## Docs to update

- `docs/PLATFORM.md §16` (Environment Variables) — add the per-variable home + failure-mode matrix.

## References

- Related: [[B02]] (default AI model slug), [[B14]] (support email placeholder), [[B15]] (duplicate `VITE_LANDING_URL`), [[B24]] (Cloudflare Phase D deploy)
- Prior art / plan: `plans/README.md` (worktree integration notes)
