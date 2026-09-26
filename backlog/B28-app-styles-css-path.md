# B28 — Verify `app/index.html` stylesheet path resolves in prod (`/dist/styles.css` 404 concern)

> **Status:** TODO · **Priority:** P2 · **Effort:** S · **Category:** Ops / Frontend
> **Depends on:** — · **Blocks:** the D2.5 "confirm the stylesheet loads" prod check in [[B24]]

## Summary

The Cloudflare deployment plan flagged that `app/index.html` references `/dist/styles.css`, which "if it 404s in prod" is a pre-existing path quirk to fix separately. **On verification against the current tree, `app/index.html` contains no such reference** — CSS enters through the Vite JS bundle (`main.tsx` imports `./index.css`), and Vite injects a hashed `<link>` into the built `dist/index.html` automatically. So the concern appears already resolved/moot; this item is to **confirm** the built stylesheet loads under Cloudflare Workers static-asset serving and fix only if a real 404 surfaces.

## Evidence

- `docs/superpowers/plans/2026-06-22-cloudflare-deployment.md:599-601` — the flag: "confirm the stylesheet loads (watch the `/dist/styles.css` reference in `app/index.html`; if it 404s in prod, raise it — that's a pre-existing path quirk to fix separately, out of this plan's scope)."
- `app/index.html:1-42` (whole file) — **no `/dist/styles.css` reference exists.** The only linked asset is `/favicon.ico` (`app/index.html:5-9`); the module entry is `/src/main.tsx` (`app/index.html:37-40`), i.e. the standard Vite dev entry.
- `app/src/main.tsx:2` — `import './index.css'` — the app's CSS is bundled through the JS module graph, not a static `<link>`.
- `app/vite.config.ts:1-40` — Tailwind v4 via `@tailwindcss/vite` (`:17`); **no `base` option**, so build output is served from `/` and Vite emits hashed `/assets/index-[hash].css` + `/assets/index-[hash].js` referenced from the built `dist/index.html`.
- `app/wrangler.jsonc:5-8` — app Worker serves `./dist` as static assets with `single-page-application` not-found handling; the built `dist/index.html` and its `/assets/*` are what production serves.
- Repo-wide grep for `styles.css` / `dist/` under `app/` — the only hits are in `app/scripts/gen-headers.mjs:1,53` (writes `dist/_headers`); **no source references `/dist/styles.css`.**

## Root cause

The plan's note reflects an **older state of `app/index.html`** (or a cautious assumption). The current source uses the idiomatic Vite pattern: CSS imported in `main.tsx`, hashed and linked automatically at build. There is no hardcoded `/dist/styles.css` to 404. The remaining risk is purely "does the Vite-emitted hashed CSS resolve through the Worker's static-asset + SPA-fallback serving," which is standard but worth one confirmation.

## What we need to do

1. Re-read `app/index.html` and `app/src/main.tsx` (done above) to confirm no hardcoded `/dist/styles.css` reference remains. If a future edit reintroduces a hardcoded `/dist/...` path, replace it with the Vite-injected hashed link (i.e. let the import in `main.tsx` do it) — never hardcode `/dist/styles.css`.
2. Confirm the built output: after a local `pnpm build` (mentally trace / inspect `app/dist/index.html`), the built HTML should reference `/assets/index-[hash].css` and `/assets/index-[hash].js`, and `app/dist/assets/` should contain those hashed files. **Do not execute the build as part of authoring this doc** — this is the verification step the executor runs.
3. Under Cloudflare Workers static assets (`app/wrangler.jsonc` → `./dist`, SPA fallback), confirm `/assets/index-[hash].css` resolves (200, `text/css`) and is **not** swallowed by the `single-page-application` not-found handler. Hashed asset paths are real files in `dist/assets/`, so SPA fallback should not intercept them — verify in the D2.5 prod check.
4. If (and only if) a stylesheet request 404s in prod, trace the actual failing URL from the built `dist/index.html` and fix the reference/base config — do not fix a path that isn't broken.

## Acceptance criteria

- [ ] Confirmed: no hardcoded `/dist/styles.css` in `app/index.html` (current tree already satisfies this).
- [ ] Built `dist/index.html` references a hashed `/assets/*.css`, present in `dist/assets/`.
- [ ] In prod, `https://app.linkintothessi.com` loads styled (stylesheet 200, no unstyled flash), satisfying [[B24]] D2.5.
- [ ] No code change unless a real 404 is observed; if changed, `pnpm verify` is green.
- [ ] `docs/PLATFORM.md` — update only if a fix changes the documented build/serve path (see **Docs to update**).

## Risks / edge cases / open questions

- **Likely a no-op:** the current source already avoids the flagged pattern; this is a confirmation, not a fix. Resist "fixing" a non-existent `/dist/styles.css`.
- **SPA fallback vs real assets:** `not_found_handling: single-page-application` returns `index.html` for unknown routes; a mistyped/hardcoded CSS path would then return HTML (200 with wrong content-type), which reads as "styles don't load" rather than a clean 404 — watch the content-type, not just the status, during the prod check.
- **Vite `base`:** none set → `/`. If a future custom sub-path deploy is introduced, the injected asset URLs change accordingly; keep `base` unset for the current root-domain app.

## Docs to update

- `docs/PLATFORM.md §18` (Tooling) / build-and-serve notes — record that the app's CSS is Vite-bundled + hashed (no static `/dist/styles.css`) and served from `dist/assets/` via the Worker. Only edit if a real fix lands.

## References

- Related: [[B24]] (Phase D D2.5 prod stylesheet-loads verification)
- Prior art / plan: `docs/superpowers/plans/2026-06-22-cloudflare-deployment.md:599-601`; `app/index.html`, `app/src/main.tsx`, `app/vite.config.ts`, `app/wrangler.jsonc`
