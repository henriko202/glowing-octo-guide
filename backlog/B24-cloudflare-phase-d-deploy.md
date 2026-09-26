# B24 — Cloudflare Phase D: prod Convex, manual deploy, domains, Git CI

> **Status:** TODO · **Priority:** P1 · **Effort:** L · **Category:** Ops / Deploy
> **Depends on:** [[B13]] (env values to paste), Cloudflare plan Phases A–C landed · **Blocks:** production launch (public site + app + billing + auth)

## Summary

The Cloudflare deployment plan is code-complete through Phase C, but **Phase D is entirely human/dashboard work an agent cannot do**: create the production Convex deployment, set every secret in the Convex dashboard, repoint the LinkedIn OAuth redirect and Stripe webhook at the prod `*.convex.site`, `wrangler login` + deploy both Workers, attach custom domains with DNS/TLS, and wire Cloudflare Workers Builds for git push-to-deploy. Until this is done there is no production site. Secrets are held by Henriko and entered in dashboards — never in the repo.

## Evidence

- `docs/superpowers/plans/2026-06-22-cloudflare-deployment.md:565` — `## Phase D — Convex prod, manual deploy, DNS, Git automation (Henriko-performed)`; header note: "account/dashboard/DNS actions an agent cannot perform… Henriko executes dashboard steps and holds the secrets."
- `docs/superpowers/plans/2026-06-22-cloudflare-deployment.md:570-583` — Task D1 (prod Convex deploy from repo root; dashboard env vars; LinkedIn redirect; Stripe webhook).
- `docs/superpowers/plans/2026-06-22-cloudflare-deployment.md:585-606` — Task D2 (prod `.env.local` matrices, `wrangler login`, `pnpm deploy:app`/`deploy:landing`, custom domains + www→apex redirect, prod verification).
- `docs/superpowers/plans/2026-06-22-cloudflare-deployment.md:608-620` — Task D3 (Cloudflare Workers Builds connect-repo per Worker, build-env matrices, production branch `master`, monorepo install fallback).
- `docs/superpowers/plans/2026-06-22-cloudflare-deployment.md:543-548` — root `package.json` deploy scripts (`deploy:app`, `deploy:landing`, `preview:landing`) that D2 relies on (Phase C, Task C1).
- `docs/superpowers/plans/2026-06-22-cloudflare-deployment.md:27-30` — prod values (verbatim): apex `https://linkintothessi.com`, app `https://app.linkintothessi.com`, cookie domain `.linkintothessi.com`, Convex `https://<prod>.convex.cloud` + `https://<prod>.convex.site`.
- `app/wrangler.jsonc:5-8` — app Worker serves `./dist` as static assets with `single-page-application` not-found handling (the app Worker D2 deploys).

## Root cause

Not a bug — a **deferred manual milestone**. These steps require account ownership, DNS control, and production secrets that only Henriko has; the plan explicitly scoped them out of agent execution ("Henriko-performed"). Nothing in the repo can complete them.

## What we need to do

Turn Phase D into an explicit, ticked checklist. Every step is dashboard/CLI work Henriko performs; Claude may supply exact commands and verify results but cannot execute the account actions.

### D1 — Production Convex deployment + secrets

1. From the **repo root** (never inside `convex/` — that wipes the deployment), run `npx convex deploy`. Record the prod URLs: `https://<prod>.convex.cloud` and `https://<prod>.convex.site`.
2. In **Convex dashboard → Settings → Environment Variables** (per `docs/PLATFORM.md §16`), set:
   - `APP_URL=https://app.linkintothessi.com`
   - `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`
   - `LINKEDIN_REDIRECT_URI=https://<prod>.convex.site/auth/linkedin/callback`
   - every `STRIPE_*`: secret key, publishable key (if read server-side), monthly price id, annual price id, **and the webhook signing secret** (fill after D1.4).
   - **Leave `ALLOW_ADMIN_SHARE_ANY_POST` UNSET** (dev/test-only escape hatch; enabling it in prod would let admins share any post).
   - Pull the actual values from the [[B13]] placeholder inventory — resolve each placeholder to its real prod secret.
3. In the **LinkedIn developer app** (dev app is reused for prod), set the OAuth **Authorized redirect URL** to `https://<prod>.convex.site/auth/linkedin/callback`.
4. In **Stripe**, set the webhook endpoint to `https://<prod>.convex.site/stripe/webhook`, copy its signing secret, and paste it into the Convex `STRIPE_*` webhook var from D1.2.
5. **Verify:** `curl -sI https://<prod>.convex.site/auth/linkedin` returns `302` to `linkedin.com` (confirms HTTP router + `buildAuthUrl` are live with the right client id/redirect).

### D2 — Manual smoke deploy + custom domains

1. Create prod env files locally (git-ignored, never committed): `app/.env.local` (full `VITE_*` matrix, plan spec §5) and `landing/.env.local` (`NEXT_PUBLIC_*` matrix), all pointing at the real `<prod>` + `linkintothessi.com`.
2. `wrangler login` (one-time browser auth).
3. `pnpm deploy:app` then `pnpm deploy:landing`. Each prints a deployed `*.workers.dev` URL.
4. In **Cloudflare dashboard → each Worker → Settings → Domains & Routes → Custom Domains**: add `app.linkintothessi.com` to the app Worker and `linkintothessi.com` to the landing Worker (DNS + TLS auto-provisioned since the zone is in Cloudflare). Add a **Redirect Rule**: `www.linkintothessi.com/*` → `https://linkintothessi.com/$1` (301).
5. **Verify (production):**
   - `curl -sI https://linkintothessi.com/` → 307/308 to a locale; `curl -sI https://www.linkintothessi.com/` → 301 to apex.
   - Browse `https://app.linkintothessi.com/feed`, hard-refresh → SPA loads (no 404) **and the stylesheet loads** — see [[B28]] for the `/dist/styles.css` path check (the plan flags it here as a separate quirk to confirm).
   - Full sign-in: app → LinkedIn → callback → `/auth/success` lands in the app.
   - Toggle theme/language on the landing, navigate to the app → preference persists (shared `.linkintothessi.com` cookie).
   - Header scan (e.g. securityheaders.com): HSTS + `frame-ancestors 'none'` present, **no CSP console violations**.
6. Run the plan-limits seed against prod as part of first-deploy — see [[B27]] (`npx convex run migrations/seedPlanLimits:seedPlanLimits` from repo root).
7. **Before opening sign-ups: at least 15 live posts in the feed** ([[R05]] — never ship a blank feed). Henriko and a
   handful of real members submit real posts through the normal composer; `convex/seed.ts`'s dev seed data must never
   run against prod.

### D3 — Cloudflare Workers Builds (Git push-to-deploy)

1. In **Cloudflare dashboard → Workers & Pages → connect the GitHub repo** twice, once per Worker:
   - **Landing:** root dir `landing/`, build `npx opennextjs-cloudflare build`, deploy `npx opennextjs-cloudflare deploy`.
   - **App:** root dir `app/`, build `pnpm build`, deploy `npx wrangler deploy`.
2. Set each Worker's **build environment variables** to the spec §5 matrix (landing → `NEXT_PUBLIC_*`; app → `VITE_*`). Set the production branch to `master`.
3. If the pnpm-workspace install fails in Workers Builds, prefix the build command with a repo-root install, e.g. landing: `cd .. && pnpm install --frozen-lockfile && cd landing && npx opennextjs-cloudflare build` (analogous for app). Confirm via the build log.
4. **Verify:** push a trivial commit to `master` → both Workers rebuild and redeploy → live sites reflect the change. (Henriko performs the commit/push; agents never run git.)

## Acceptance criteria

- [ ] Prod Convex deployment exists; all env vars from D1.2 set; `ALLOW_ADMIN_SHARE_ANY_POST` unset.
- [ ] `curl -sI https://<prod>.convex.site/auth/linkedin` → 302 to linkedin.com.
- [ ] Both Workers deployed; `app.linkintothessi.com`, `linkintothessi.com`, and `www`→apex 301 all resolve over TLS.
- [ ] Prod verification checklist in D2.5 all green (sign-in, cookie persistence, security headers, no CSP violations).
- [ ] [[B27]] seed run against prod; [[B28]] stylesheet-loads check confirmed.
- [ ] Workers Builds connected for both Workers; a push to `master` auto-redeploys both.
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- **Secrets discipline:** every secret goes into a dashboard, never the repo. Do not paste real values into `.md` files or commit `.env.local`.
- **CWD footgun:** running the Convex CLI from inside `convex/` wipes the deployment — always run from repo root.
- **Stripe webhook secret ordering:** the signing secret only exists after the endpoint is created (D1.4), so D1.2's `STRIPE_*` webhook var must be filled after, not before.
- **LinkedIn dev-app reuse:** the same LinkedIn app serves dev and prod; changing the redirect to prod may break local dev unless both redirect URLs are registered.
- **Monorepo install in Workers Builds:** pnpm workspace resolution can fail from a sub-directory root; D3.3 is the known fallback.
- **Convex not on Cloudflare:** Cloudflare hosts only the two frontends; the backend stays on Convex cloud.

## Docs to update

- `docs/PLATFORM.md §16` — record the prod env-var inventory and that secrets live in the Convex dashboard.
- `docs/PLATFORM.md §17` — confirm the shipped prod CSP/HSTS/`frame-ancestors` posture (Cloudflare plan Phase E, Task E1 §17).
- `docs/PLATFORM.md §18` — "Deploys via Cloudflare Workers Builds (Git push-to-`master`); Convex via `npx convex deploy`."
- `docs/PLATFORM.md §2` / §19 — deploy targets are Cloudflare Workers (landing OpenNext, app Static Assets), removing the stale Vercel/Railway mismatch note.

## References

- Related: [[B13]] (env/config placeholders to resolve), [[B02]] (AI model slug must be valid before AI features run in prod), [[B14]] (real support email before launch), [[B25]] (codegen regen), [[B27]] (seed plan limits on deploy), [[B28]] (app stylesheet path check in D2.5), [[R05]] (minimum live posts before sign-ups open, D2 step 7)
- Prior art / plan: `docs/superpowers/plans/2026-06-22-cloudflare-deployment.md` (Phase D §565-620; Phase E doc-sync §624-659); spec `docs/superpowers/specs/2026-06-22-cloudflare-deployment-design.md`
