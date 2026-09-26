# B09 — AI suggested reaction not generated for Apify-synced posts

> **Status:** TODO · **Priority:** P2 · **Effort:** S · **Category:** AI
> **Depends on:** — · **Blocks:** —

## Summary

The AI "suggested reaction" prediction only runs for posts created via the manual submit flow.
Posts that arrive through the Apify cron sync never get a `suggestedReaction`, so their reaction
picker silently defaults to LIKE forever. The fix is a one-line scheduler call on the Apify insert
path — but it must fire only for genuinely new posts and respect the existing cost/rate guards.

## Evidence

- `convex/posts.ts:293` — `submitPost` schedules the prediction after upsert:
  `await ctx.scheduler.runAfter(0, internal.ai.reactions.predictReaction, { postId })`. (Was `:269`; moved by `8417b51`.)
- `convex/ai/reactions.ts:12-29` — `predictReaction` is best-effort: it no-ops on missing post,
  calls OpenRouter, and swallows every failure (incl. missing `OPENROUTER_API_KEY`) leaving the
  post at its default LIKE.
- `convex/jobs/syncPostsApify.ts:111-116` — the Apify path calls
  `internal.jobs.syncPosts.upsertPost` for each post and **never** schedules `predictReaction`.
- `convex/jobs/syncPosts.ts:33-58` — `upsertPost` returns `existing._id` on the **update** branch
  (line 57) and a fresh id on the **insert** branch (line 111); on a queued-limit insert it returns
  `null` (line 93). Callers cannot currently tell "new" from "re-synced" from the return value
  alone.
- `grep predictReaction` — the only scheduler call is `convex/posts.ts:293`; nothing in the cron
  paths (or the rewritten `convex/interactions.ts`) references it.

## Root cause

`predictReaction` scheduling was added to the manual submit path only. The Apify sync path
(`syncUserPostsViaApify`) upserts posts directly and was never given the same follow-up scheduling.

## What we need to do

1. **Schedule `predictReaction` from the Apify upsert path**, mirroring `convex/posts.ts:269`:
   `await actionCtx.scheduler.runAfter(0, internal.ai.reactions.predictReaction, { postId })`.
2. **Only for genuinely new posts.** `upsertPost` already branches new-vs-existing
   (`convex/jobs/syncPosts.ts:39` existing → update, else insert). It returns `existing._id`
   unchanged on update, `null` on queue, and a new id on insert — but the caller can't distinguish
   "new id" from "existing id". Fix by having `upsertPost` signal newness, e.g. return
   `{ postId, created: boolean }` (or a separate `createdPostId`), then schedule only when
   `created === true`. Do **not** re-schedule on every re-sync (the cron runs repeatedly and re-syncs
   the same URNs — see the `by_urn` dedup at `convex/jobs/syncPosts.ts:36`).
3. **Cost/rate awareness.** Apify sync can insert many posts per run (`maxPosts: 3` per user ×
   many users — `convex/jobs/syncPostsApify.ts:90,133`). Each prediction is an OpenRouter call.
   `predictReaction` already no-ops when AI is unconfigured and is best-effort; confirm the OpenRouter
   client's rate limiting covers a burst of scheduled predictions, and consider a small stagger or a
   cap if a single sync fans out to a large batch.
4. Leave the queued path (`upsertPost` returns `null` at limit) alone — those posts are predicted
   later when `processQueue` promotes them (or add the same scheduling there — see
   `convex/jobs/processQueue.ts:88-105` — if predicting queued posts is desired).

## Acceptance criteria

- [ ] A new Apify-synced post gets a `suggestedReaction` (when AI is configured), same as a
      manually-submitted post.
- [ ] Re-running the sync over the same posts does **not** re-schedule predictions (no duplicate
      OpenRouter spend).
- [ ] With AI unconfigured, the sync still succeeds and posts keep the default LIKE (no thrown
      errors).
- [ ] `pnpm verify` is green (typecheck + lint + tests)
- [ ] `docs/PLATFORM.md` updated (see **Docs to update**)

## Risks / edge cases / open questions

- **Re-sync storm**: the biggest risk is scheduling on the update branch and burning OpenRouter
  budget every cron tick. The new-vs-existing signal from `upsertPost` is the crux.
- **Batch cost**: decide whether to predict for trial-hidden posts (`hidden` at
  `convex/jobs/syncPostsApify.ts:109`) now, or defer until they're unhidden.
- **Queued posts**: if you also want predictions for posts promoted out of the overflow queue, wire
  the same call in `processQueue`; otherwise document that queued posts get a prediction only if the
  submit path created them.

## Docs to update

- `docs/PLATFORM.md` — the AI Reaction & Comment Assistance section: note that suggested reactions
  are now generated on **both** the manual-submit and Apify-sync insert paths (new posts only).

## References

- Related: — (mirrors the `submitPost` scheduling at `convex/posts.ts:293`)
- Prior art / plan: —

## Update — 2026-08-20

Re-verified against `8417b51` (onboarding) and `5fe86b8` (toast + `interactions.ts` rewrite). **Status unchanged: TODO.**

- The `5fe86b8` rewrite of `convex/interactions.ts` did **not** change how `predictReaction` is scheduled — it never touches prediction (it handles the comment/react engagement handoff). `predictReaction` is still referenced only in `convex/ai/reactions.ts:12-29` and scheduled only from `submitPost`. The Apify path still never schedules it.
- `convex/jobs/syncPostsApify.ts:111-116` still upserts each post with **no** `predictReaction` follow-up.
- `upsertPost` return semantics are unchanged — update→`existing._id` (`convex/jobs/syncPosts.ts:57`), queue→`null` (`:93`), insert→new id (`:111`), `by_urn` dedup (`:36`) — so the new-vs-existing signal in step 2 is still the crux and still unimplemented.

Evidence correction: the `submitPost` scheduling call moved **`convex/posts.ts:269` → `:293`** (the `8417b51` rewrite inserted a `markFirstPostPrompted` call + comments above it).

**Remains to do:** the whole fix — schedule `predictReaction` from the Apify insert branch, new posts only (steps 1-2). Unblocked and actionable.
