# R21 — Interacted posts leave the feed after 24 hours, with a "Hide now"

> **Status:** DONE 2026-09-07 · **Priority:** P2 · **Effort:** M · **Category:** Retention / Feed / Backend / Frontend
> **Depends on:** [[R05]] (done: the empty-feed state this item must not reuse) · **Related:** [[R16]] (the history page is why there is no unhide list), [[R15]], [[R18]] · **Blocks:** —

## Principle

**The feed is a to-do list, not a timeline; a good dashboard answers "what do I do now?"**
([@richardrx · 2026-02-13](https://x.com/richardrx/status/2022255404743381289)). Every post the
member already handled is a line they re-read and re-decide on the next visit; that is cognitive
load, and every choice removed can lift conversion
([@richardrx · 2026-01-20](https://x.com/richardrx/status/2013597792447394034)). The Zeigarnik effect
cuts both ways: an open loop nags, and a closed one has to leave, or the member keeps re-opening
their own finished work ([@richardrx · 2025-11-17](https://x.com/richardrx/status/1990429269487386865)).

The honest counterpart of the infinite feed is a session that ends. "You're caught up" is a
stopping cue, the opposite of the slot-machine playbook
([@richardrx · 2025-12-22](https://x.com/richardrx/status/2003106841199276221)), and it passes the
Swiss Knife filter because it removes surface instead of adding it: the only new control is one
"Hide" on a card the member already finished
([@richardrx · 2026-05-26](https://x.com/richardrx/status/2059236567533650119)). For retention the
mechanism is progress: a feed that empties as you work makes tomorrow's new posts visible, which is
the return-rate loop [[R18]] measures.

## Summary

Henriko's note (2026-09-06): "Posts you already interacted with disappears after 24 hours, option
in the post to hide it immediately from the feed." Scope decided 2026-09-07:

- A post the viewer reacted to or commented on stays in **their** feed for 24 hours from the tap,
  rendered as a done card (what you did, when it leaves, the one action still open), then leaves
  for that viewer.
- A **"Hide"** on the done card removes it at once. The control exists **only on interacted posts**:
  hide means "done", never "not interested". No skip, no unhide, no hidden list.
- Other viewers are unaffected; the post keeps its `inFeed`, its counts, its cap and its place in the
  author's My Posts.
- An empty feed that is empty because the member handled everything shows a **caught-up** state, not
  the [[R05]] "feed fills as members post" state.

## Evidence

- `convex/feed.ts:187-231` `fetchFeedPage`: walks `by_feed_rank` with `inFeed = true` (`:197-201`),
  loads the authors (`:204-206`), then filters per viewer in memory (`:212-223`: own post, visibility,
  industry filter) and enriches (`:224-227`). No per-viewer state is read anywhere in the walk.
- `convex/feed.ts:108-122` `isPostVisibleToViewer` is the access gate, shared with search (own posts
  excluded at `:114`). The hide is a preference, not access; it does not belong there.
- `convex/schema.ts:390-399` `userPostState { userId, postId, reactedAt?, commentDraft? }` with
  `by_user_and_post [userId, postId]` and `by_post [postId]`. `:371-382` `userInteractions`, the
  append-only log with `createdAt`.
- `convex/interactions.ts:180-182` `incrementLikeCount` stamps `reactedAt` (the dedup for billing);
  `:118-160` `incrementCommentCount` writes nothing to `userPostState`. A comment leaves no
  current-state mark (grep `commentedAt` in `convex/`: none). `:76-87` `recordInteraction` appends to
  the log best-effort, so the log cannot be the filter's source of truth.
- `app/src/components/PostCard.tsx:11-28` `PostWithAuthor` carries no viewer state; `:132-180` the
  footer (reaction button, comment button, View on LinkedIn) renders the same before and after the tap.
- `app/src/pages/FeedPage.tsx:34-38` `usePaginatedQuery(api.feed.getFeed, …)`; `:109-115` the
  auto-load effect returns when there is no last item, so a page filtered to nothing never auto-loads;
  `:146-156` `posts.length === 0` renders `EmptyFeed`; `:238-248` the manual Load more.
- `app/src/pages/FeedPage.tsx:192-213` the reaction handoff (toast → mutation → `HANDOFF_DELAY_MS` →
  `openLinkedIn`) and `app/src/components/CommentBox.tsx:84-114` the comment handoff (copy → mutation →
  delay → open → close): the tap is optimistic and the real action happens on LinkedIn. The 24-hour
  window is the way back to a post whose LinkedIn tab was closed or blocked.
- `app/src/lib/handoff.ts:7` `HANDOFF_DELAY_MS = 1500`.
- `app/src/components/EmptyFeed.tsx` (props `gated`, `hasOwnPost`, `made`, `trialStatus`; `:37`
  `showBanner = gated && hasOwnPost`): the [[R05]] semantics are "nothing to show yet" plus the
  activation checklist, not "all done".
- `convex/privacy/export.ts:65-66` and `convex/privacy/deletion.ts:44-45`, `:66`: `userPostState` is
  already exported and erased; new fields on it ride along.
- `convex/feed.test.ts:27-37` `feedCtx(page, authors)`: the mock covers `query → withIndex → order →
  paginate` and `db.get`; the new per-viewer lookup needs `withIndex('by_user_and_post').unique()` added.
- `convex/lib/feedRank.ts:52-57` `computeFeedFields`: `inFeed` is global (hidden, cap, deleted); the
  engagement refresh cron reads `inFeed = true` (§11) and is untouched by a per-viewer hide.
- `docs/PLATFORM.md:669-686` §5 `userPostState`; `:1625` onward §11 feed resolution with the F1/F2
  Mermaid steps; `:1728-1790` §11 interactions; `:2615-2626` §14 FeedPage.
- `app/src/i18n/locales/en.json:48-78` `feed.*`. `app/src/lib/observability/analytics.ts:51`
  `captureEvent`.

## Root cause

The feed is a global ranked index with viewer-side access filters, and "done" was never a state.
`reactedAt` was stored for billing dedup, not display, and comments store nothing, so neither the
server nor the card knows what the viewer already did. A member who works the feed daily re-reads
yesterday's posts on top and cannot tell "nothing new" from "nothing left".

## What we need to do

1. **Pure rule, tested.** `convex/lib/feedHygiene.ts`: `INTERACTED_TTL_MS = 24 * 60 * 60 * 1000`;
   `lastInteractedAt(state)` = the later of `reactedAt` and `commentedAt`;
   `viewerPostStatus(state, now)` → `'fresh' | 'done' | 'gone'` (`gone` when `hiddenAt` is set or
   the TTL has elapsed; `done` when interacted and inside the TTL). `canHide(state)` → interacted and
   not yet hidden. Tests on the boundary, the hidden case and the untouched case.
2. **Schema, widen only.** `userPostState` gains `commentedAt: v.optional(v.number())` and
   `hiddenAt: v.optional(v.number())`. No new table, no new index: the lookup is `by_user_and_post`.
3. **Stamp comments.** `incrementCommentCount` (`interactions.ts:118`) upserts `commentedAt` when
   unset, the same presence semantics as `reactedAt` at `:180-182`.
4. **Hide mutation.** `interactions.hidePost({ sessionToken, postId })`: `requireAuth`, read the
   viewer's row, `canHide` or throw `ConvexError('NOT_INTERACTED')`, patch `hiddenAt: Date.now()`.
   Idempotent on repeat.
5. **Feed filter.** In `fetchFeedPage` after the author fetch (`feed.ts:204-206`): read the viewer's
   row for each post on the page in one `Promise.all` (`by_user_and_post` `.unique()`, at most
   `numItems` point reads), drop `gone`, and attach to `done` posts an allow-listed
   `viewerState: { reacted, commented, hidesAt }` (never `commentDraft`). `now` is already in scope.
6. **Done card.** `PostCard`: when `post.viewerState` is set, the footer shows the done line
   ("Reacted · leaves your feed in 18 h" / "Commented · …"), keeps the action not yet taken (a
   reacted card still offers Comment, a commented card still offers React), keeps View on LinkedIn,
   and adds one ghost "Hide" that calls `hidePost`. Hours = `ceil((hidesAt - now) / 3 600 000)`
   computed at render, no ticking timer.
7. **Caught-up state.** `interactions.getCaughtUp({ sessionToken })` → true when the member's most
   recent `userInteractions` row is younger than 24 h (the by-user index [[R16]] reads,
   `.order('desc').first()`; add it if R16 has not). `FeedPage` queries it only when
   `posts.length === 0` and `status === 'Exhausted'`; when true it renders the new caught-up state
   ("You're caught up. Posts you handled leave after 24 hours; new posts appear as members share
   them.") with no checklist and no CTA; otherwise the [[R05]] `EmptyFeed` as today.
8. **Auto-load fix.** `FeedPage.tsx:109-115`: when `posts.length === 0 && status === 'CanLoadMore'`,
   call `loadMore` instead of returning; cap the automatic chase at five consecutive empty pages, then
   fall back to the manual Load more (`ponytail:` note naming the ceiling).
9. **Analytics.** `captureEvent('post_hidden', { after: 'react' | 'comment' | 'both' })` on Hide.
   Nothing for the automatic expiry.
10. **i18n.** `feed.doneReacted`, `feed.doneCommented`, `feed.doneBoth`, `feed.leavesIn`
    (`{{hours}}`), `feed.hideNow`, `feed.caughtUpTitle`, `feed.caughtUpBody` in en, pt-BR and es.
11. **Privacy.** No new table; two timestamps on a row already in export and erasure. Add the fields
    to the §13B data inventory line for `userPostState`.
12. **Tests.** `feedHygiene.test.ts`; `feed.test.ts`: a done post is enriched, a gone post is dropped,
    another viewer sees the plain card; `interactions`: `canHide` covers the guard; `PostCard.test.tsx`:
    the done state renders the remaining action and Hide; `FeedPage.test.tsx`: caught-up versus
    [[R05]] empty, auto-load on an empty `CanLoadMore` page.
13. **Docs.** See **Docs to update**.

## Do / Don't

For the implementing agent. Each line names the mechanism it relies on and links the source.

**Do**

- **Make "done" a designed state**: what you did, when it leaves, the one action left ([@richardrx · 2025-12-29](https://x.com/richardrx/status/2005682912419606553)).
- **Keep View on LinkedIn on the done card.** The tap was optimistic; the real action lives on LinkedIn (§11 handoff), and the 24-hour window exists for the member who lost that tab.
- **End the session honestly.** "You're caught up" is the stopping cue; it is the counterpart of the slot-machine loop, not a weaker version of it ([@richardrx · 2025-12-22](https://x.com/richardrx/status/2003106841199276221)).
- **Hide means done, only after a tap** (decided 2026-09-07). The feed stays a reciprocity engine; the member's job is to handle posts, not to curate them.
- **Keep it per viewer.** `inFeed`, the counts, the caps, the refresh cron and the author's My Posts are untouched; the hide lives on `userPostState` only.
- **Cut instead of adding.** No hidden-posts list, no unhide, no setting; [[R16]] is the record of what you did ([@richardrx · 2026-05-26](https://x.com/richardrx/status/2059236567533650119)).
- **Precise hours**, "leaves in 18 h", never "soon" ([@richardrx · 2026-02-18](https://x.com/richardrx/status/2024141244717281514)).
- **Measure** `post_hidden` and the return rate on the [[R18]] panel; the item exists to move the second.

**Don't**

- **Don't add a "not interested" skip** (decided 2026-09-07). A skip turns the to-do list back into a timeline and lets a member browse past the posts that need them.
- **Don't sort done posts to the bottom.** Pagination walks a global index (`by_feed_rank`); a per-viewer re-rank breaks the cursor. In place, then gone.
- **Don't use the `userInteractions` log as the filter's truth.** It is best-effort; the state row is authoritative.
- **Don't reuse the [[R05]] copy for the caught-up state.** "Your feed fills as members post" is false to a member who cleared it; design the state ([@richardrx · 2025-12-29](https://x.com/richardrx/status/2005682912419606553)).
- **Don't touch `isPostVisibleToViewer`.** It is the access gate shared with search; a hidden post stays reachable by search and by its permalink.
- **Don't make the TTL configurable.** One constant; a setting is a feature nobody asked for ([@richardrx · 2026-05-26](https://x.com/richardrx/status/2059236567533650119)).
- **Don't reward the disappearance**: no confetti, no streak, no "3 handled today" badge. Variable reward is the line this item stays on the right side of ([@richardrx · 2025-12-22](https://x.com/richardrx/status/2003106841199276221)).
- **Don't add a ticking countdown** to the card; an hour figure computed at render is precise enough and costs no timer.

## Acceptance criteria

- [x] A post the viewer reacted to or commented on renders the done state with the remaining action, View on LinkedIn and Hide; every other viewer sees the normal card. — shipped as: `feed.getFeed` attaches `viewerState` per post and `PostCard` renders the done footer; the taken action's control is **removed** (`!done?.reacted` / `!done?.commented`) rather than disabled, so the remaining one is still live.
- [x] The post leaves the viewer's feed 24 h after the tap with no action, and at once on Hide; both reactive, no reload needed after Hide. — shipped as: `viewerPostStatus(row, now)` → `fresh` / `done` / `gone` at `INTERACTED_TTL_MS`, with `gone` dropped from the page; `interactions.hidePost` stamps `hiddenAt` (idempotent, `ConvexError('NOT_INTERACTED')` unless `canHide`) and the query re-runs on its own.
- [x] Empty because everything was handled → caught-up state; empty because nothing exists → the [[R05]] state; an empty page with more to load auto-loads. — shipped as: `feed.getCaughtUp` (newest interaction younger than 24 h) queried **only** while the page is empty, after up to `MAX_EMPTY_LOADS` (**5**, ≈100 posts) auto-loads; an empty state renders **only** when the status is `Exhausted` — while it is settling, or once the budget is spent and the manual Load more shows, **no** empty state renders at all — so the checklist never flashes between two empty pages and "You're caught up" never sits next to Load more (review fix, 2026-09-07).
- [x] `inFeed`, counts, caps, the refresh cron, search and the author's My Posts are unchanged. — shipped as: hygiene is per-viewer only; nothing touches the post row.
- [x] The DSR export contains `commentedAt` and `hiddenAt`; erasure removes the row as today. — shipped as: both are fields on the existing `userPostState` row, so the whole-row export and erasure cover them with no new code path.
- [x] `post_hidden` fires on Hide, consent-gated. — shipped as: props `{ after }`, the whole hours between the interaction and the tap.
- [x] `pnpm verify` green. — exit 0 on 2026-09-07 (convex 456/456, app 370/370).
- [x] `docs/PLATFORM.md` updated in the same change (see below).

**Shipped as (whole-item notes).** `toFeedViewerState(row)` takes **no `now`**: it returns `{ reacted, commented, hidesAt }` and lets the client turn `hidesAt` into a label, so the server never bakes a clock reading into a cached value. Hours-left is computed once from a `now` captured at mount and floored at 1 — a fact, not a ticking countdown (the "don't add a countdown" rule above). There is **no unhide**: [[R16]]'s history page is the record, which is why the rule needs no second list.

## Risks / edge cases / open questions

- **Page cost.** Up to `numItems` extra indexed point reads per page (at most 100). Fine at this scale; `ponytail:` note the ceiling, no denormalised hidden set.
- **Short pages.** A heavy user's first page can filter to near-empty; step 8 covers the empty case and the existing auto-load effect covers near-empty.
- **Expiry is not a timer.** Convex re-runs a query on data changes, not on the clock; a post past its 24 h leaves on the next run (any feed change, a reload), not at the exact minute. Document it in §11.
- **A done post that then reaches its cap** leaves everyone's feed (`inFeed = false`); the viewer's done state is moot. No conflict.
- **Comment after Hide** cannot happen from the feed (the card is gone); the permalink and search paths still allow it and re-stamp nothing (`hiddenAt` stays). Acceptable.
- **The caught-up query reads the best-effort log**; a missing row shows the [[R05]] state instead of caught-up. Acceptable, never the reverse.
- **Own posts** are never in the feed (`feed.ts:114`); nothing to hide.

## Docs to update

Updated 2026-09-07 to the sections actually touched:

- `docs/PLATFORM.md` §5 `userPostState` — the two new fields, the widen-only/no-backfill note and the index line.
- §11 feed resolution — a new node in the Mermaid chart plus the "Per-viewer hygiene (R21)" prose, including the
  empty-page client contract.
- §11 — the `hidePost` row in the interactions table and a **new "24-hour feed hygiene (R21)" subsection** with its
  own chart: the stamps, the three pure helpers, `getCaughtUp`, `MAX_EMPTY_LOADS`.
- §14 — FeedPage (auto-load, settling, caught-up branch), `PostCard`'s done footer and `EmptyFeed`'s `caughtUp` prop,
  and the i18n key entry (**+7** keys).
- §17 — `post_hidden` in the complete event list.
- §21 — a mapping row after all: `lib/feedHygiene.ts`, `hidePost` and `getCaughtUp` are new seams the existing
  feed row does not name.
- **Not touched: §13B.** No new personal-data category — both fields sit on a row the inventory already covers.
- `backlog/revenue/README.md`: **Status** flipped to DONE.

## References

- Code: `convex/feed.ts`, `convex/interactions.ts`, `convex/schema.ts`, `convex/lib/feedRank.ts`, `convex/feed.test.ts`, `app/src/pages/FeedPage.tsx`, `app/src/components/PostCard.tsx`, `app/src/components/EmptyFeed.tsx`, `app/src/components/CommentBox.tsx`.
- Related items: [[R05]] (the empty state this must not reuse), [[R16]] (the record; why no unhide), [[R15]] (the recap counts interactions, not feed rows), [[R18]] (return rate).
- Sources: [@richardrx · 2026-02-13](https://x.com/richardrx/status/2022255404743381289), [@richardrx · 2026-01-20](https://x.com/richardrx/status/2013597792447394034), [@richardrx · 2025-11-17](https://x.com/richardrx/status/1990429269487386865), [@richardrx · 2025-12-22](https://x.com/richardrx/status/2003106841199276221), [@richardrx · 2026-05-26](https://x.com/richardrx/status/2059236567533650119), [@richardrx · 2025-12-29](https://x.com/richardrx/status/2005682912419606553), [@richardrx · 2026-02-18](https://x.com/richardrx/status/2024141244717281514).
