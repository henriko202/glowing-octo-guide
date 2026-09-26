# B14 — Real support email (BannedScreen placeholder)

> **Status:** TODO · **Priority:** P2 · **Effort:** S · **Category:** Config / Frontend
> **Depends on:** — · **Blocks:** —

## Summary

The "Account suspended" screen a banned user sees has a `mailto:` "Contact support" button pointing at a
placeholder address, `contact@email.com`, with a `// TODO` next to it. A suspended user who clicks it lands
on a dead inbox. The compliance/privacy docs already use a real rights address — `contact@linkintothessi.com` —
so the two are inconsistent. Fix: use the real monitored address, and ideally centralize it so it is defined
once rather than copied per screen.

## Evidence

- `app/src/components/BannedScreen.tsx:6` — `const SUPPORT_EMAIL = 'contact@email.com' // TODO: replace with the real support address`
- `app/src/components/BannedScreen.tsx:37` — the value is used in the button: `href={`mailto:${SUPPORT_EMAIL}`}`
- `docs/compliance/README.md:42-43` — the data-subject rights address is `contact@linkintothessi.com`
  ("currently `contact@linkintothessi.com` in the UI — confirm this is monitored and correct"), i.e. the
  compliance surface already commits to a different, real address than BannedScreen's placeholder.

## Root cause

Placeholder left in during scaffolding (explicit `TODO`) and never reconciled with the address the
compliance work later standardized on. No single constant/env holds the support address, so it drifted.

## What we need to do

1. Confirm the correct monitored address with Henriko — almost certainly `contact@linkintothessi.com` for
   consistency with `docs/compliance/README.md:42-43` and the `/privacy` + `/terms` landing pages.
2. Replace the placeholder at `BannedScreen.tsx:6`, dropping the `TODO`.
3. **Centralize** (lazy, one place): the address appears (or will appear) on BannedScreen, the privacy/terms
   pages, and compliance copy. Define it once — a small exported constant (e.g. `SUPPORT_EMAIL` in a shared
   `app/src/lib/` module) or a build-time env var if it must differ per environment — and import it wherever
   a support/contact address is shown. Do not scatter the literal.
4. When this string is localized in [[B16]], keep the *address* as data (a constant), and only translate the
   surrounding label ("Contact support").

## Acceptance criteria

- [ ] No occurrence of `contact@email.com` remains in `app/`.
- [ ] BannedScreen's "Contact support" button links to the confirmed real address.
- [ ] The address is defined in a single shared location (constant or env), not duplicated as a literal.
- [ ] `pnpm verify` is green (typecheck + lint + tests).
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- Open question: is `contact@linkintothessi.com` actually monitored? `docs/compliance/README.md:43` itself
  flags "confirm this is monitored and correct" — this is a human confirmation, not an engineering guess.
- If a separate, dedicated support alias exists (distinct from the compliance/rights address), use that
  instead — but then document both so they don't re-diverge.

## Docs to update

- `docs/PLATFORM.md §14` (Frontend — Authenticated App / gate screens) — note the shared support-email
  constant and where BannedScreen sources it.

## References

- Related: [[B16]] (localize BannedScreen strings), [[B13]] (env/config placeholders)
- Prior art / plan: `docs/compliance/README.md:42-43`
