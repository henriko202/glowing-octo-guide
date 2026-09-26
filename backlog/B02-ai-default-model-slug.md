# B02 — AI default model slug is invalid — all AI calls likely 404

> **Status:** TODO · **Priority:** P0 · **Effort:** S · **Category:** AI/Config
> **Depends on:** — · **Blocks:** every AI feature (reaction prediction + comment drafting) whenever `OPENROUTER_MODEL` is unset

## Summary

The OpenRouter client falls back to a hardcoded default model slug `google/gemma-4-26b-a4b-it:floor` when `OPENROUTER_MODEL` is unset. That slug does not match any real Google/Gemma model on OpenRouter's catalog (Gemma releases are `gemma-2-*`, `gemma-3-*`, `gemma-3n-*`), so a request using it returns a non-2xx status and both AI features fail. Because the failure is caught and re-thrown as a generic sanitized message, it looks like a transient "please try again" rather than a permanent misconfiguration. If the intended production posture is "run with the in-code default" (rather than always setting the env override), the AI product is dark.

## Evidence

- `convex/ai/openrouter.ts:25` — `const model = process.env.OPENROUTER_MODEL ?? 'google/gemma-4-26b-a4b-it:floor'`. The `:floor` suffix is OpenRouter's price-routing shortcut; the base slug `google/gemma-4-26b-a4b-it` is the suspect part.
- `convex/ai/openrouter.ts:35-43` — the model is sent in the POST body (`:38` `body: JSON.stringify({ model, messages, stream: false, provider: PROVIDER_ROUTING })`); on `!res.ok` it logs the real status + body (`:41`) and throws `Failed to ${opts.action}. Please try again.` (`:42`) — a generic message that hides "model not found".
- `convex/ai/openrouter.ts:14-17` — `PROVIDER_ROUTING = { data_collection: 'deny', zdr: true }` is the compliance-critical provider pin (intentionally not env-overridable per the `:6-8` comment). This is separate from the model slug and must be preserved.
- `convex/ai/openrouter.ts:20-24` — blank `OPENROUTER_API_KEY` short-circuits: logs `OPENROUTER_API_KEY not set` and throws `Failed to ${opts.action}. AI is not configured.` (so a missing key is a *distinct*, already-handled no-op).
- `convex/.env.local.example:22-23` — comment says `# Optional model slug override (default: google/gemma-4-26b-a4b-it)` (note: **without** `:floor`) and `OPENROUTER_MODEL=` is blank. So the documented default and the code default already disagree by the `:floor` suffix, and both use the suspect base slug.
- Blast radius — both AI call sites route through `callOpenRouter`:
  - `convex/ai/reactions.ts:18` — `callOpenRouter(...)` inside `predictReaction` (scheduled async after each submit, `convex/posts.ts:269`).
  - `convex/ai/comments.ts:34` — `callOpenRouter(buildCommentPrompt(...), { action: 'generate comment' })` (on-demand "Generate" button).
- `convex/ai/openrouter.test.ts:13,36-40` — existing tests: one deletes `OPENROUTER_MODEL` and asserts the **default** model is used in the request body; another sets an override. Changing the default slug requires updating this test's expected value.

## Root cause

A placeholder/typo'd model slug was left as the in-code default and never validated against OpenRouter's live catalog. Failures surface only as generic "please try again" strings and server-side `console.error`, so nothing distinguishes a permanent 404-on-model from a transient error. There is no startup or admin-visible check that the configured model actually resolves.

## What we need to do

1. **Verify the intended slug** against OpenRouter's current catalog (the project's intended provider path is OpenRouter → DeepInfra, US, Gemma fp8, zero-retention). Pick a real, currently-available Gemma slug served by DeepInfra with the ZDR/`data_collection:deny` posture (e.g. a valid `google/gemma-3-*` id — confirm the exact string on OpenRouter before committing). Do not guess; confirm the slug resolves.
2. **Replace the default** at `convex/ai/openrouter.ts:25` with the verified slug. Decide on the `:floor` suffix deliberately: with `provider: PROVIDER_ROUTING` already pinning ZDR + `data_collection:deny`, document whether price-floor routing is still wanted, and keep code and `.env.local.example:22` comment in agreement.
3. **Update `.env.local.example:22`** so the documented default exactly matches the code default (string-for-string, including or excluding `:floor`).
4. **Update `convex/ai/openrouter.test.ts`** (`:13`, and the default-model assertion) to expect the new slug.
5. **Add a fail-loud signal for a bad/404 model.** OpenRouter returns a distinguishable status/body when a model id is unknown. In `callOpenRouter`'s `!res.ok` branch (`:40-43`), detect the model-not-found case and throw a clearly different message (e.g. `AI model misconfigured`) instead of the generic "please try again", so a permanent misconfig is not mistaken for a transient blip. Keep the sanitized-to-client / real-error-to-logs split. (Optional, ponytail-minimal: a one-line admin-visible distinction is enough — do not build a full health-check subsystem.)

## Acceptance criteria

- [ ] With `OPENROUTER_MODEL` unset and a valid `OPENROUTER_API_KEY`, `predictReaction` and `generate comment` both return real content (no 404).
- [ ] `convex/ai/openrouter.ts:25` default and `convex/.env.local.example:22` comment reference the identical, verified, currently-available slug.
- [ ] A model-not-found response yields a distinct, non-"try again" error (surfaced in logs/admin), not a silent generic failure.
- [ ] `convex/ai/openrouter.test.ts` passes with the updated expected slug.
- [ ] `PROVIDER_ROUTING` ZDR + `data_collection:deny` pin is unchanged.
- [ ] `pnpm verify` is green (typecheck + lint + tests).
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- **Open question:** what was the *intended* model? "gemma-4-26b-a4b" resembles a garbled `gemma-3n-e4b`-style id. Confirm the real target with the product owner / OpenRouter catalog before picking.
- ZDR/`data_collection:deny` routing may not be offered by every provider for every model — verify the chosen slug is actually served by a compliant (DeepInfra) provider under those constraints, or the request could fail provider-routing even with a valid model.
- Compliance docs list the model/provider as an active sub-processor (memory `ai-reaction-comment-feature`); if the slug/provider changes materially, the compliance docs must reflect the real model.
- No prod data / pre-launch: safe to change freely; no migration.

## Docs to update

- `docs/PLATFORM.md` §11A (AI Reaction & Comment Assistance) — record the verified model slug and provider-routing/ZDR posture.
- `docs/PLATFORM.md` §16 (Environment Variables) — `OPENROUTER_MODEL` default/description kept in sync with code.

## References

- Related: [[B05]] (a fail-loud model error is exactly what monitoring should catch)
- Prior art / plan: `docs/superpowers/plans/2026-06-19-ai-reaction-comment.md`
- Memory: `ai-reaction-comment-feature` (OpenRouter → DeepInfra, US, Gemma fp8, ZDR)
