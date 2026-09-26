# R16 — Interaction history page (your words, your posts)

> **Status:** DONE 2026-09-07 · **Priority:** P2 · **Effort:** S · **Category:** Product / Backend / Frontend
> **Depends on:** [[R15]] (the window toggle, the nav pattern and the `recap.*` tone) · **Blocks:** —

## Principle

**Retention is built, not requested: what the member has accumulated is what leaving would cost.**
A list of every reaction and comment the member made, with the post it went to and the words
they wrote, is the personal archive this product can offer, the data-vault lever among the five
switching costs. It also closes a loop the feed leaves open: after the handoff to LinkedIn the
member has no way back to the post or to their own comment. The page shows facts from our own
database, never a LinkedIn-side number, so it stays inside the promise the app can keep.
Sources: [the five switching-cost levers](https://x.com/richardrx/status/2069382946214080985),
[the "words helped" surface](https://x.com/richardrx/status/2001408166404530231),
[design every state](https://x.com/richardrx/status/2005682912419606553).

## Summary

Henriko's direction (2026-09-05): a history page listing the interactions the member made in the
last 7 days and the last month, so they can open the post again and read the comment they wrote,
from our database. The engagement log already holds every row with the reaction type and the
submitted comment text; the page is a paginated reader over it. Only the member's own rows appear
here; received activity stays on the recap ([[R15]]).

## Evidence

- `convex/schema.ts:349-360` — `userInteractions` rows carry `kind`, `reaction`, `comment`, `postId` and `createdAt`; `by_user` plus the implicit `_creationTime` supports a descending range read.
- `convex/interactions.ts:214-243` — `commentOnPost` records the submitted text on the row; `userPostState.commentDraft` (`convex/schema.ts:368-377`) is the last AI draft, state that can differ from what was posted.
- `convex/lib/reactions.ts:7-25` — `reactionValidator` and `REACTIONS` (emoji plus `reactions.*` label keys, `app/src/i18n/locales/en.json:93`); the history reuses them.
- `convex/posts.ts:453-476` — `deletePost` is a soft delete (`deletedAt`, `hidden`), so a deleted post's row still exists and the page can render a "removed" state.
- `convex/privacy/deletion.ts:44`, `:64-66`, `:95-101` — erasure drains the member's own rows by user, and erasing an author drains the rows other members made on that author's posts by post; those history rows disappear with the post.
- `app/src/components/LinkedInEmbed.tsx:26-32` — the permalink builder (`/feed/update/<urn>/`).
- `convex/_generated/ai/guidelines.md:172-201` — pagination: `paginationOptsValidator` in `args`, `.paginate(args.paginationOpts)` in the handler.
- `app/src/components/shell/navItems.ts:6-13` — the main nav group; `app/src/components/shell/CommandPalette.tsx:55-62` renders the same items as quick actions; `app/src/App.tsx:84-140` — the route table.
- `convex/privacy/export.ts` — the rows are already part of the export; nothing new to export.

## Root cause

The log was built for the data-subject export, and the feed hands the member off to LinkedIn;
nothing in the app brings them back to the post or to their own words.

## What we need to do

1. **Query.** `interactions.listMyInteractions({ sessionToken, since, paginationOpts })`: `by_user` with `q.eq('userId', me._id).gte('_creationTime', since)`, `.order('desc')`, `.paginate(paginationOpts)`. For each row on the page, `ctx.db.get` the post and the author, then map through a pure `toHistoryRow(row, post, author)` in `convex/lib/history.ts` returning `{ id, kind, reaction, comment, createdAt, post: null | { id, permalink, excerpt, authorName, removed } }`, where `excerpt` is the first 140 characters of `content`, `authorName` is the display name only (no tokens, no PII, the `toSearchPerson` rule) and `removed` is `deletedAt !== undefined`. Unit-test the mapper: a comment row, a reaction row, a removed post, a missing post.
2. **`HistoryPage.tsx` at `/history`.** The [[R15]] window toggle (7 days, 30 days; `since` computed once per toggle), `usePaginatedQuery` with `initialNumItems: 20` and a "Load more" button. Each row: the date (relative, absolute in the title attribute), the reaction emoji and label or 💬 plus the comment text verbatim (`whitespace-pre-wrap`, clamped at six lines with "Show more"), the post excerpt with the author's name, and one "Open on LinkedIn" link (the permalink, new tab, `rel="noopener noreferrer"`). Removed post: the excerpt becomes "Post removed by its author" and the link stays, because the LinkedIn post may still exist. Missing post (author erased): the row is gone with it, nothing to render. Empty state: "Nothing in the last 7 days. React to a post in the feed and it shows up here." with one CTA to `/feed`.
3. **Nav and ⌘K.** Add `{ path: '/history', labelKey: 'nav.history', icon: History }` to the main group in `navItems.ts` after `/recap`; the palette picks it up. Add the route in `App.tsx`. The recap footer links here ("See every interaction").
4. **i18n.** Keys `nav.history` and `history.*` in en, pt and es.
5. **Tests.** `toHistoryRow`; `HistoryPage` with a mocked paginated query (both windows, empty state, a removed post, load more); `navItems.test.ts` and `Sidebar.test.tsx`.
6. **Docs.** See **Docs to update**.

## Do / Don't

For the implementing agent. Each line names the mechanism it relies on and links the source.

**Do**

- **Show the member's own words verbatim.** The comment on the row is the text they tapped Comment with. People value what they built about three times more, and the archive makes that effort visible again ([@richardrx · 2026-01-30](https://x.com/richardrx/status/2017274698699067466)).
- **Make every row a door back to the post**, one link, the LinkedIn permalink. A click is a decision, so give each row exactly one ([@richardrx · 2026-08-05](https://x.com/richardrx/status/2084988776053452923)).
- **Design the removed and empty states** with the same care as the list; the moments you did not design are the ones the member remembers ([@richardrx · 2025-12-29](https://x.com/richardrx/status/2005682912419606553), [@richardrx · 2026-05-12](https://x.com/richardrx/status/2054283657934758021)).
- **Keep it a personal archive.** Only the member's own rows, visible only to them; the vault is a switching cost because it is theirs ([@richardrx · 2026-06-23](https://x.com/richardrx/status/2069382946214080985)).
- **Stamp each row exactly.** A precise date reads as a record; "a while ago" reads as an estimate ([@richardrx · 2026-02-18](https://x.com/richardrx/status/2024141244717281514)).
- **Page at 20 and load more on demand.** A wall of rows slows the scan; every extra element is noise ([@richardrx · 2025-11-04](https://x.com/richardrx/status/1985828780838097317)).

**Don't**

- **Don't show the AI draft as the comment.** `commentDraft` is state; the row's `comment` is the fact (decision, 2026-09-05).
- **Don't add search, filters, export or a copy button in the first cut.** Each one is a Swiss Knife blade; the data export already lives in Privacy & Data ([@richardrx · 2026-05-26](https://x.com/richardrx/status/2059236567533650119)).
- **Don't show received activity here.** It lives on the recap ([[R15]]); two lists with two meanings on one page is the support ticket [[R15]] already warns about.
- **Don't turn it into streaks or a leaderboard.** The honest counterpart to the slot-machine playbook is a plain record ([@richardrx · 2025-12-22](https://x.com/richardrx/status/2003106841199276221)).
- **Don't put an upsell on the history.** The cap section lives on the recap at 80% ([[R15]]) and at the cap in My Posts ([[R08]]); an upsell that interrupts breeds resistance ([@richardrx · 2026-05-05](https://x.com/richardrx/status/2051672248348479691)).
- **Don't show LinkedIn-side counts on the rows.** The app cannot observe them, and a number it cannot stand behind is expectation debt ([@richardrx · 2026-04-29](https://x.com/richardrx/status/2049568514311172355)).
- **Don't render another member's comment text.** Only the member's own rows, never the `by_post` side.

## Acceptance criteria

- [x] `/history` lists the member's reactions and comments for 7 and 30 days, newest first, each with the reaction label or the comment text stored on the row.
- [x] Each row links to the post's LinkedIn permalink; a soft-deleted post shows the removed state with the link kept.
- [x] "Load more" pages past 20 rows.
- [x] "History" appears in the sidebar and in the ⌘K quick actions; the recap footer links to it.
- [x] Export and erasure behaviour are unchanged (the existing privacy tests stay green).
- [x] `pnpm verify` is green (typecheck + lint + tests).
- [x] `docs/PLATFORM.md` updated (see **Docs to update**).

## Risks / edge cases / open questions

- **Rows vanish with an erased author.** Erasure drains the rows other members made on that author's posts, so those history rows disappear. Acceptable, the post is gone too; document it in §13B.
- **Long comments.** LinkedIn allows 1,250 characters in a comment; clamp and expand, never truncate silently.
- **Window versus reactive pagination.** `since` is fixed when the toggle changes; new rows appear at the top reactively, which is fine.
- **Join cost.** Two `db.get` calls per row per page of 20; fine at launch volumes, and the page never reads the whole log.
- **Hidden posts.** A post the author hid still renders its row and link; hiding affects other members' feeds, not LinkedIn.

## Docs to update

- `docs/PLATFORM.md` §11 (Feed & Engagement) — `listMyInteractions` and `toHistoryRow`.
- `docs/PLATFORM.md` §11B (Search & Command Palette) — the new quick action.
- `docs/PLATFORM.md` §13B (Privacy & Compliance) — note that rows made on an erased author's posts leave the history.
- `docs/PLATFORM.md` §14 (HistoryPage, navItems) — the page and the nav entry.

## References

- Related: [[R05]], [[R08]], [[R15]].
- Prior art / plan: `docs/PLATFORM.md` §11 engagement actions table (`:1509-1510`); memory `linkedin-api-access-constraints` (no member API for comments or reactions; in-app record plus manual handoff).
- Principle sources: [@richardrx · 2026-06-23](https://x.com/richardrx/status/2069382946214080985), [@richardrx · 2025-12-17](https://x.com/richardrx/status/2001408166404530231), [@richardrx · 2025-12-29](https://x.com/richardrx/status/2005682912419606553).

## Decisions (2026-09-07)

- Windows 7d/30d/all (All time added). Comments verbatim with Show more past 280 chars / 6 lines. Removed = deleted or hidden post; a missing post row also renders the badge.
- **No analytics event on History.** The page fires nothing — deliberately, and named as such in the implementation spec §4.7, which lists no History event. The recap is the instrumented surface (`recap_viewed`); the archive is a place the member reads, not a funnel step.
- **"All time" is `since = 0`,** the same query path as the two rolling windows, so the toggle needed no second code path; `WindowToggle` is shared with the recap (which offers only 7d/30d).
- **A missing post renders the same `removed` badge as a soft-deleted one.** Item 2 above said a row whose post is gone "is gone with it, nothing to render"; in practice `toHistoryRow` returns `post: null` and the page shows the row with the removed badge, so the member's own words never silently disappear from their archive.
- **Deferred in the implementation spec §10, so nothing is claimed for it:** a History analytics event.
