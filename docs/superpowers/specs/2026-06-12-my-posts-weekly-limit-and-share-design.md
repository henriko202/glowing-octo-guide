# My Posts — Weekly Limit Pill + Manual Share

**Date:** 2026-06-12
**Status:** Approved, implementing

## Goal

Two changes to the **My Posts** page ([app/src/pages/MyPostsPage.tsx](../../../app/src/pages/MyPostsPage.tsx)):

1. Show the user's weekly post usage as a pill: `"2 of 5 posts this week"`.
2. Copy the manual-share composer (currently only on the Feed page) into My Posts as well.

## Decisions

| Question                        | Decision                                                           |
|---------------------------------|--------------------------------------------------------------------|
| Pill placement                  | Profile header, right-aligned (next to name/plan)                  |
| Composer appearance in My Posts | Re-themed **light** to match the white My Posts page               |
| At weekly limit                 | Pill turns **amber** + composer Submit is **disabled** with a hint |
| "This week" meaning             | **Rolling 7-day window** — identical to backend enforcement        |
| Composer on Feed                | **Unchanged** (copy, not move)                                     |

## Architecture

### Backend — `convex/posts.ts`

The weekly count and the plan limit already exist but are **internal-only**
(`countRecentPosts` internalQuery, `getPlanLimits` internalQuery). The frontend
needs a public query.

1. **Extract a pure helper** — single source of truth for the window count, so
   the pill can never drift from the enforcement check:

   ```ts
   export function countPostsSince(posts: { publishedAt: number }[], since: number): number {
     return posts.filter(p => p.publishedAt >= since).length
   }
   ```

   Refactor the existing `countRecentPosts` internalQuery to use it.

2. **Add a public query** `getWeeklyUsage`:
    - Resolves the user via `requireAuth`; returns `null` when not signed in
      (mirrors `getMe` / `getMyPosts`).
    - Counts posts over the **same rolling 7-day window** the action enforces
      (`Date.now() - 7 * 24 * 60 * 60 * 1000`), via `countPostsSince`.
    - Reads `postsPerWeek` via the existing `getPlanLimitsHelper`.
    - Returns `{ postsThisWeek: number, postsPerWeek: number }`.

> **Why a dedicated query (not folded into `getMe`):** `getMe` is called on every
> page (nav, settings, billing). Folding post-counting into it taxes every call.
> A focused query keeps the cost where it's needed and is trivially testable.

### Frontend — `app/src/components/PostComposer.tsx`

Additive, backward-compatible props (Feed keeps its current look with zero churn):

```ts
interface PostComposerProps {
  onSubmit: (url: string) => Promise<void>
  theme?: 'dark' | 'light' // default 'dark'
  atLimit?: boolean // default false
  limitHint?: string // helper text shown when atLimit
}
```

- `theme === 'light'` swaps slate-800/900 dark surfaces for white / light-slate.
- `atLimit` disables Submit (`!url.trim() || submitting || atLimit`) and shows
  `limitHint` in place of the "Paste your LinkedIn post URL" helper line.

> **Why props over a duplicate component:** one component, no drift. Defaults
> preserve the Feed page exactly.

### Frontend — `app/src/pages/MyPostsPage.tsx`

- Add `useQuery(api.posts.getWeeklyUsage, { sessionToken })` and
  `useAction(api.posts.submitPost)`.
- **Pill** in the profile header row (switch `gap-3` → `justify-between`),
  right-aligned:
    - Under limit: `bg-blue-50 text-blue-700`.
    - At limit (`postsThisWeek >= postsPerWeek`): `bg-amber-50 text-amber-700`.
    - Text: `"{postsThisWeek} of {postsPerWeek} posts this week"`,
      `title="In the last 7 days"`. Hidden while `usage` is loading/`null`.
- **Composer** below the profile header, above the "Your posts" section:
  `<PostComposer theme="light" atLimit={atLimit} limitHint="Weekly limit reached" onSubmit={handleSubmit} />`
  where `handleSubmit` calls the `submitPost` action.
- Reactivity: Convex `useQuery` auto-refreshes `getMyPosts` and `getWeeklyUsage`
  after a successful submit — no manual refetch.

## Testing

Follows the codebase convention of testing **pure logic directly** (cf.
`buildFeedFilter` in [feed.test.ts](../../../convex/feed.test.ts)).

- `convex/posts.test.ts` — `countPostsSince`: counts within window, excludes
  older posts, at-limit boundary.
- `app/src/components/PostComposer.test.tsx` — light theme renders; `atLimit`
  disables Submit and shows the hint. (Existing tests unaffected — defaults.)
- `app/src/pages/MyPostsPage.test.tsx` — **replace the call-order `useQuery` mock
  with reference-based dispatch** (there are now three queries), then assert:
  pill text, amber + disabled at-limit state, composer present.

## Scope guardrails (YAGNI)

- Feed composer behavior unchanged.
- No i18n added to MyPostsPage / PostComposer (they're already hardcoded English;
  matching the file being edited).
- No standalone pill component — inline (~10 lines) until reused.
- Rolling 7-day window, not a calendar week.
