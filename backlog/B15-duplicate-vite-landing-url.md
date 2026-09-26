# B15 — Duplicate `VITE_LANDING_URL` in `app/.env.example`

> **Status:** TODO · **Priority:** P3 · **Effort:** S · **Category:** Config
> **Depends on:** — · **Blocks:** —

## Summary

`app/.env.example` declares `VITE_LANDING_URL` twice with different values. A `.env` file's last assignment
wins, so the first is dead and misleading. Trivial tidy: keep the correct one, delete the other.

## Evidence

- `app/.env.example:4` — `VITE_LANDING_URL=https://linkintothessi.com` (under a comment: "Marketing/landing
  site … Sign-out redirects here. Dev: http://localhost:3000")
- `app/.env.example:12` — `VITE_LANDING_URL=http://localhost:3000` (second definition, no comment)
- `plans/README.md:54` — already noted: "duplicate `VITE_LANDING_URL` line in `app/.env.example`
  (pre-existing; tidy before tracking)."

## Root cause

Two edits to the example file added the var independently; the duplicate was never reconciled.

## What we need to do

1. Decide the intended template value. Since this is `.env.example` (the local-dev template) and every other
   dev value in the file points at localhost, the correct kept value is the **localhost** one
   (`http://localhost:3000`); the prod URL lives in the Cloudflare app build env (see [[B13]]), not in the
   dev template.
2. Delete the redundant line and keep a single `VITE_LANDING_URL` with the appropriate comment.
3. Leave the surrounding cross-site-cookie comment block intact.

## Acceptance criteria

- [ ] `app/.env.example` defines `VITE_LANDING_URL` exactly once.
- [ ] The kept value matches the file's dev-template convention (localhost).
- [ ] `pnpm verify` is green (no code path reads the example file, so this is purely cosmetic).
- [ ] `docs/PLATFORM.md` updated only if §16 quotes the example (see **Docs to update**).

## Risks / edge cases / open questions

- Purely a template file; nothing at runtime reads it. No behavior change — do not overthink it.

## Docs to update

- `docs/PLATFORM.md §16` — only if the App env sub-section lists `VITE_LANDING_URL` twice; otherwise `— n/a`.

## References

- Related: [[B13]] (env/config placeholder matrix)
- Prior art / plan: `plans/README.md:53-54`
