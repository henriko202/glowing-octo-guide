# Interaction Graph, Notifications & 3-Day Digest - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship backlog/revenue R22 (people lists + rankings from the existing interaction log), R23 (in-app
notifications with bell, toast and `/notifications`) and R24 (3-day digest email with in-platform preference and
one-click unsubscribe), in that order, with `docs/PLATFORM.md` and the compliance docs updated in the same change and
nothing committed.

**Architecture:** Every new rule lives in a pure `convex/lib/*` module with a unit test; Convex functions are thin
I/O wrappers. People lists and personal rankings aggregate `userInteractions` on read with the existing `by_user` /
`by_author` indexes and `_creationTime` ranges (same pattern as `interactions.getRecap`). The site-wide board is a
daily `rankingSnapshots` row built by one bounded internal mutation per window. Notifications are rows written in the
same transaction as the interaction. The digest is a daily sweep of eligible users that reuses the snapshot for site
tops and the same tallies for personal numbers.

**Tech Stack:** Convex (queries/mutations/internalMutations/internalAction, `ConvexError`, `v` validators),
TypeScript, React 19 + react-router-dom + `convex/react`, react-i18next with `app/src/i18n/locales/{en,pt,es}.json`,
shadcn-style primitives in `app/src/components/ui/`, Tailwind v4 tokens, vitest + @testing-library/react (jest-dom via
`app/src/test/setup.ts`), Resend via `convex/lib/email.ts`, WebCrypto (`crypto.subtle`) for HMAC.

**Spec:** `docs/superpowers/specs/2026-09-14-interaction-graph-notifications-digest-design.md` - read it first; this
plan argues from it.

**DEVIATIONS from the spec (3, all deliberate):**

1. **Snapshot scan (spec §5.6).** One bounded internal mutation per window reads up to `SNAPSHOT_ROW_CEILING`
   (10,000) rows per table newest-first and sets `partial: true` when the take fills, instead of a cursor-paginated
   self-rescheduling chain. Passing accumulating tallies as function args across invocations risks arg-size limits for
   no benefit at this scale; the `partial` flag preserves honesty and the spec's read-cost section already names the
   upgrade path.
2. **`notifications.getLatest` instead of `getLatestId` (spec §5.3).** The toast needs the actor name and kind to
   build its message, so the one-row query returns `{ _id, actorName, kind }`. Same cost, one less client join.
3. **HMAC via WebCrypto, not `node:crypto` (spec §5.8).** `convex/lib/pkce.ts` already uses `crypto.subtle` in the
   default runtime; `node:crypto` would force `'use node'`, which this repo confines to `billingNode.ts`. The plan
   exports the existing `base64UrlEncode` from `pkce.ts` and signs with `crypto.subtle`.

## Global Constraints

- **Never commit. Never run any git state-changing command** (`commit`, `push`, `add`, `stash`, `checkout`, `reset`,
  `restore`, `clean`). Henriko commits everything himself. Read-only git (`git status`, `git diff`) is fine.
- **Change files only with the Edit and Write tools.** Bash is for read-only work and for running tests, lint,
  typecheck and Prettier. Never rewrite a file through `sed`, heredocs or a script - the repo mixes CRLF and LF and
  shell rewrites have failed repeatedly.
- **Never run `pnpm format`.** After each task run `pnpm exec prettier --write <the code files you touched>` (from the
  repo root) on code and config files only, never on Markdown prose. The root gate is `pnpm verify` (=
  `pnpm format:check && pnpm lint && pnpm typecheck && pnpm -r test && pnpm --filter convex test:integration`) and it
  must stay green.
- **pnpm, never npm.** Unit test one file with `pnpm --filter ./convex test <path>` or `pnpm --filter ./app test
  <path>`. Integration tests: `pnpm --filter ./convex exec vitest run --config vitest.integration.config.ts
  integration/<file>.test.ts` (they live in `convex/integration/` and use `convexTest(schema, modules)` with
  `const modules = import.meta.glob('../**/*.ts')`). Typecheck: `pnpm typecheck`. Lint: `pnpm lint`.
- **Read `convex/_generated/ai/guidelines.md` before writing any Convex code.** Every function declares `args`
  validators; internal callers use `internalQuery` / `internalMutation` / `internalAction` and `internal.*` refs;
  reads are bounded (`.take(n)`, `.first()`, `.unique()`, `.paginate`); `.withIndex()` uses equality fields first and
  `_creationTime` ranges after; no `ctx.db` in actions; schedule with `ctx.scheduler.runAfter(0, internal.x.y, args)`;
  `'use node'` only in `convex/billingNode.ts`.
- **Codegen after every new Convex module.** `convex/_generated/api.d.ts` lists modules literally; a new file does
  not exist as `internal.<module>` / `api.<module>` until codegen runs. Run `npx convex codegen` from the repo root
  after creating or renaming any `convex/*.ts` file, before typecheck or tests (`npx convex dev --once` is the
  heavier fallback; never start a long-running dev server without asking Henriko).
- **Schema is widen-only** (pre-launch, dev data disposable): optional fields, new tables, new indexes, no backfills.
- **Three locales in parity.** `app/src/i18n/locales/{en,pt,es}.json`; pt is pt-BR, es is neutral Latin-American
  Spanish, sentence case; plurals use `_one` / `_other`. There is no parity test - for each task that adds keys,
  diff the three files before finishing (`git diff --stat` + a quick read).
- **Copy rules**: no marketing verbs, no urgency, no exclamation marks in emails; precise numbers or none; never tell
  a member to check their SSI; never claim the app reads or shows the SSI; Apify never appears in member-facing copy.
- **Convex naming**: files are camelCase; table fields camelCase; indexes `by_<field>[_and_<field>]`; multi-word
  index fields use underscores in the index NAME and camelCase in the field list, e.g.
  `.index('by_recipient_and_created_at', ['recipientId', 'createdAt'])`.
- **Lint rules in force**: `react-hooks/purity` (no `Date.now()` in render - use
  `const [now] = useState(() => Date.now())` or floor to the hour as Recap does), `react-hooks/set-state-in-effect`
  (no synchronous `setState` inside `useEffect`), `react-hooks/refs` (no ref reads during render).
- **Scratch files** go to the session scratchpad, never inside the repo.
- **Docs travel with the code**: `docs/PLATFORM.md` and the compliance docs are updated in the phase tasks below.
  `backlog/` is gitignored (local-only edits are expected).

---

## File Map

| Path                                                                                                           | Task             | Responsibility                                                                                                                                                                                          |
|----------------------------------------------------------------------------------------------------------------|------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `convex/lib/interactionGraph.ts` (+ `.test.ts`)                                                                | 1                | Pure tallies: `tallyReceivedByPerson`, `tallyMadeByPerson`, `tallyReceivedByPost`, `tallySiteActors`, `sortTallies`.                                                                                    |
| `convex/lib/ranking.ts` (+ `.test.ts`)                                                                         | 2                | Pure rank maths: `rankPositions`, `positionOf`, `movement`, `pickPreviousGeneration`, `digestWindow`, `topEntries`.                                                                                     |
| `convex/schema.ts`                                                                                             | 3, 10            | `rankingSnapshots` + `users.leaderboardOptOut`; `notifications` + `users` digest fields.                                                                                                                |
| `convex/jobs/rankingSnapshot.ts` (+ integration test)                                                          | 3                | `rebuildRankingSnapshots` internalMutation + snapshot assembly.                                                                                                                                         |
| `convex/crons.ts`                                                                                              | 3, 19            | Snapshot cron entries; digest cron entry.                                                                                                                                                               |
| `convex/interactions.ts` (+ integration test)                                                                  | 4, 10            | `listPeopleIInteractedWith`, `listInteractionsByPost`; notification inserts in the two `increment*`. (The flat received-people query was removed by controller ruling after Task 6 shipped: no caller.) |
| `convex/rankings.ts` (+ integration test)                                                                      | 5                | `getMyRankings`, `getSiteRankings`.                                                                                                                                                                     |
| `convex/users.ts` (+ integration test)                                                                         | 5, 16            | `listMembers`, `setLeaderboardOptOut`; digest preference query/mutation.                                                                                                                                |
| `app/src/pages/PeoplePage.tsx` (+ `.test.tsx`)                                                                 | 6                | `/people` with three tabs.                                                                                                                                                                              |
| `app/src/components/PeopleAccordion.tsx` (+ `.test.tsx`)                                                       | 6                | Per-post accordion of received interactions.                                                                                                                                                            |
| `app/src/pages/RankingsPage.tsx` (+ `.test.tsx`)                                                               | 7                | `/rankings` with the personal and site blocks.                                                                                                                                                          |
| `app/src/components/RankingList.tsx` (+ `.test.tsx`)                                                           | 7                | One ranked list (rank, avatar, name, count, highlight).                                                                                                                                                 |
| `app/src/components/WindowToggle.tsx`                                                                          | 6                | Add optional `labelPrefix` prop.                                                                                                                                                                        |
| `app/src/App.tsx`                                                                                              | 6, 7, 13, 21     | Routes `/people`, `/rankings`, `/notifications`, `/unsubscribed`.                                                                                                                                       |
| `app/src/components/shell/navItems.ts`                                                                         | 6, 7             | `nav.people`, `nav.rankings`.                                                                                                                                                                           |
| `convex/billingNotices.ts` (renamed from `convex/notifications.ts`)                                            | 9                | Existing transactional billing emails under their new name.                                                                                                                                             |
| `convex/notifications.ts` (new)                                                                                | 11               | In-app notification queries and mutations.                                                                                                                                                              |
| `app/src/components/shell/NotificationBell.tsx` (+ `.test.tsx`)                                                | 12               | Bell, badge, popover, toast.                                                                                                                                                                            |
| `app/src/lib/relativeDay.ts` (+ `.test.ts`)                                                                    | 12               | Add `timeAgoDetailed`.                                                                                                                                                                                  |
| `app/src/pages/NotificationsPage.tsx` (+ `.test.tsx`)                                                          | 13               | `/notifications` inbox.                                                                                                                                                                                 |
| `convex/privacy/retention.ts`, `export.ts`, `deletion.ts` (+ tests)                                            | 14               | Notification purge, export and cascade.                                                                                                                                                                 |
| `convex/lib/unsubscribeToken.ts` (+ `.test.ts`)                                                                | 17               | HMAC sign/verify + `isUnsubscribeTokenShape`.                                                                                                                                                           |
| `convex/lib/digest.ts` (+ `.test.ts`)                                                                          | 18               | Pure eligibility, digest window and data assembly helpers.                                                                                                                                              |
| `convex/lib/digestEmails.ts` (+ `.test.ts`)                                                                    | 18               | Digest email builders, three locales.                                                                                                                                                                   |
| `convex/lib/email.ts`, `convex/convex.config.ts`                                                               | 19               | Custom headers; `UNSUBSCRIBE_SECRET`.                                                                                                                                                                   |
| `convex/jobs/digest.ts`                                                                                        | 19               | Daily sweep action + internal queries/mutations.                                                                                                                                                        |
| `convex/http.ts`                                                                                               | 20               | `GET`/`POST /unsubscribe/digest`.                                                                                                                                                                       |
| `app/src/components/EmailPreferences.tsx` (+ `.test.tsx`)                                                      | 21               | Settings Emails section.                                                                                                                                                                                |
| `app/src/pages/UnsubscribedPage.tsx` (+ `.test.tsx`)                                                           | 21               | Public unsubscribe confirmation.                                                                                                                                                                        |
| `app/src/i18n/locales/{en,pt,es}.json`                                                                         | 6, 7, 12, 13, 21 | New namespaces.                                                                                                                                                                                         |
| `docs/PLATFORM.md`                                                                                             | 8, 15, 22        | Section, table, cron, route, env and compliance updates.                                                                                                                                                |
| `docs/compliance/{DATA-INVENTORY,RETENTION-POLICY,GAP-ASSESSMENT}.md`, landing privacy content, consent prompt | 22               | Compliance travel.                                                                                                                                                                                      |

---

# Phase R22 - Interaction graph and rankings

### Task 1: `convex/lib/interactionGraph.ts` (pure tallies)

**Files:**

- Create: `convex/lib/interactionGraph.ts`
- Create: `convex/lib/interactionGraph.test.ts`

**Interfaces:**

- Consumes: `excerpt` from `convex/lib/recap.ts` (already exists); nothing else.
- Produces: `GraphWindow = '7d' | '30d'`; `InteractionRow`; `CounterpartyTally`; `tallyReceivedByPerson`,
  `tallyMadeByPerson`, `tallyReceivedByPost`, `tallySiteActors`, `sortTallies`. Task 4 queries call these; Task 3
  snapshot calls `tallySiteActors`; Task 5 rankings call the two person tallies.

- [ ] **Step 1: Write the failing unit test**

Create `convex/lib/interactionGraph.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  sortTallies,
  tallyMadeByPerson,
  tallyReceivedByPerson,
  tallyReceivedByPost,
  tallySiteActors,
  type InteractionRow
} from './interactionGraph'

const FROM = 1_000

function row(over: Partial<InteractionRow> = {}): InteractionRow {
  return { _creationTime: 2_000, userId: 'me', authorId: 'other', postId: 'p1', kind: 'reaction', ...over }
}

describe('tallyReceivedByPerson', () => {
  it('groups by actor, excludes rows before the window, self and ai_draft', () => {
    const rows = [
      row({ userId: 'ana', kind: 'reaction' }),
      row({ userId: 'ana', kind: 'comment', _creationTime: 3_000 }),
      row({ userId: 'bruno', kind: 'reaction', _creationTime: 4_000 }),
      row({ userId: 'me', authorId: 'me', kind: 'reaction' }), // self, excluded
      row({ userId: 'ana', kind: 'ai_draft' }), // draft, excluded
      row({ userId: 'carla', kind: 'reaction', _creationTime: 500 }) // before window
    ]
    expect(tallyReceivedByPerson(rows, FROM)).toEqual([
      { userId: 'ana', reactions: 1, comments: 1, total: 2, lastAt: 3_000 },
      { userId: 'bruno', reactions: 1, comments: 0, total: 1, lastAt: 4_000 }
    ])
  })
})

describe('tallyMadeByPerson', () => {
  it('groups by author and skips rows without authorId and self rows', () => {
    const rows = [
      row({ userId: 'me', authorId: 'ana' }),
      row({ userId: 'me', authorId: 'ana', kind: 'comment', _creationTime: 3_000 }),
      row({ userId: 'me', authorId: 'bruno', kind: 'reaction', _creationTime: 4_000 }),
      row({ userId: 'me', authorId: undefined }), // legacy row, no counterpart
      row({ userId: 'me', authorId: 'me' }) // self, excluded
    ]
    expect(tallyMadeByPerson(rows, FROM)).toEqual([
      { userId: 'ana', reactions: 1, comments: 1, total: 2, lastAt: 3_000 },
      { userId: 'bruno', reactions: 1, comments: 0, total: 1, lastAt: 4_000 }
    ])
  })
})

describe('tallyReceivedByPost', () => {
  it('groups rows by post with nested actors, newest activity wins ties', () => {
    const rows = [
      row({ userId: 'ana', postId: 'p1', kind: 'reaction' }),
      row({ userId: 'ana', postId: 'p1', kind: 'comment', _creationTime: 3_000 }),
      row({ userId: 'bruno', postId: 'p2', kind: 'reaction', _creationTime: 4_000 })
    ]
    expect(tallyReceivedByPost(rows, FROM)).toEqual([
      {
        postId: 'p1',
        total: 2,
        lastAt: 3_000,
        actors: [{ userId: 'ana', reactions: 1, comments: 1, total: 2, lastAt: 3_000 }]
      },
      {
        postId: 'p2',
        total: 1,
        lastAt: 4_000,
        actors: [{ userId: 'bruno', reactions: 1, comments: 0, total: 1, lastAt: 4_000 }]
      }
    ])
  })
})

describe('tallySiteActors', () => {
  it('counts made interactions per actor, excluding ai_draft and self when detectable', () => {
    const rows = [
      row({ userId: 'ana', authorId: 'bruno' }),
      row({ userId: 'ana', authorId: 'carla', kind: 'comment' }),
      row({ userId: 'bruno', authorId: 'me' }),
      row({ userId: 'ana', authorId: 'ana' }), // self, excluded
      row({ userId: 'bruno', authorId: 'me', kind: 'ai_draft' }) // draft, excluded
    ]
    const map = tallySiteActors(rows, FROM)
    expect(map.get('ana')).toEqual({ count: 2, lastAt: 2_000 })
    expect(map.get('bruno')).toEqual({ count: 1, lastAt: 2_000 })
    expect(map.size).toBe(2)
  })
})

describe('sortTallies', () => {
  it('sorts by total desc, then lastAt desc, then userId asc', () => {
    const sorted = sortTallies([
      { userId: 'b', reactions: 1, comments: 0, total: 1, lastAt: 100 },
      { userId: 'a', reactions: 1, comments: 0, total: 1, lastAt: 100 },
      { userId: 'c', reactions: 1, comments: 0, total: 1, lastAt: 200 }
    ])
    expect(sorted.map(t => t.userId)).toEqual(['c', 'a', 'b'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter ./convex test lib/interactionGraph.test.ts`
Expected: FAIL with "Cannot find module './interactionGraph'".

- [ ] **Step 3: Write the implementation**

Create `convex/lib/interactionGraph.ts`:

```ts
// Pure aggregation helpers for the interaction graph (R22). Everything here is time-zone free: windows are
// `_creationTime` ranges computed by the caller, so the queries stay stable across renders. An `ai_draft` is not an
// interaction between people and never counts; a self-interaction never counts on either side.

export type GraphWindow = '7d' | '30d'

export interface InteractionRow {
  _creationTime: number
  userId: string
  authorId?: string
  postId: string
  kind: 'reaction' | 'comment' | 'ai_draft'
}

export interface CounterpartyTally {
  userId: string
  reactions: number
  comments: number
  total: number
  lastAt: number
}

interface Acc {
  reactions: number
  comments: number
  lastAt: number
}

function phase(row: InteractionRow, acc: Acc): void {
  if (row.kind === 'reaction') acc.reactions += 1
  else acc.comments += 1
  if (row._creationTime > acc.lastAt) acc.lastAt = row._creationTime
}

function toTallies(map: Map<string, Acc>): CounterpartyTally[] {
  return [...map.entries()].map(([userId, acc]) => ({
    userId,
    reactions: acc.reactions,
    comments: acc.comments,
    total: acc.reactions + acc.comments,
    lastAt: acc.lastAt
  }))
}

/** total desc, then most recent activity, then userId asc for a stable tie. */
export function sortTallies(tallies: CounterpartyTally[]): CounterpartyTally[] {
  return [...tallies].sort(
    (a, b) => b.total - a.total || b.lastAt - a.lastAt || (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0)
  )
}

function usable(row: InteractionRow, from: number): boolean {
  return row._creationTime >= from && row.kind !== 'ai_draft'
}

/** "Received": groups by actor, excluding self. */
export function tallyReceivedByPerson(rows: InteractionRow[], from: number): CounterpartyTally[] {
  const map = new Map<string, Acc>()
  for (const row of rows) {
    if (!usable(row, from) || row.userId === row.authorId) continue
    const acc = map.get(row.userId) ?? { reactions: 0, comments: 0, lastAt: 0 }
    phase(row, acc)
    map.set(row.userId, acc)
  }
  return sortTallies(toTallies(map))
}

/** "Made": groups by the post author, excluding self and rows with no author (pre-2026-09-07 legacy rows). */
export function tallyMadeByPerson(rows: InteractionRow[], from: number): CounterpartyTally[] {
  const map = new Map<string, Acc>()
  for (const row of rows) {
    if (!usable(row, from)) continue
    const counterpart = row.authorId
    if (!counterpart || counterpart === row.userId) continue
    const acc = map.get(counterpart) ?? { reactions: 0, comments: 0, lastAt: 0 }
    phase(row, acc)
    map.set(counterpart, acc)
  }
  return sortTallies(toTallies(map))
}

export interface PostTally {
  postId: string
  total: number
  lastAt: number
  actors: CounterpartyTally[]
}

/** Accordion shape: received rows grouped by post, actors nested, posts by total then recency. */
export function tallyReceivedByPost(rows: InteractionRow[], from: number): PostTally[] {
  const byPost = new Map<string, InteractionRow[]>()
  for (const row of rows) {
    if (!usable(row, from) || row.userId === row.authorId) continue
    const list = byPost.get(row.postId) ?? []
    list.push(row)
    byPost.set(row.postId, list)
  }
  const posts: PostTally[] = []
  for (const [postId, list] of byPost) {
    const actors = tallyReceivedByPerson(list, from)
    posts.push({
      postId,
      total: actors.reduce((sum, a) => sum + a.total, 0),
      lastAt: actors.reduce((max, a) => Math.max(max, a.lastAt), 0),
      actors
    })
  }
  return posts.sort((a, b) => b.total - a.total || b.lastAt - a.lastAt || (a.postId < b.postId ? -1 : 1))
}

/** Site-wide actor counts for the snapshot (made side, newest activity for the tie-break). */
export function tallySiteActors(rows: InteractionRow[], from: number): Map<string, { count: number; lastAt: number }> {
  const map = new Map<string, { count: number; lastAt: number }>()
  for (const row of rows) {
    if (!usable(row, from)) continue
    if (row.authorId !== undefined && row.userId === row.authorId) continue
    const acc = map.get(row.userId) ?? { count: 0, lastAt: 0 }
    acc.count += 1
    if (row._creationTime > acc.lastAt) acc.lastAt = row._creationTime
    map.set(row.userId, acc)
  }
  return map
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter ./convex test lib/interactionGraph.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Format, typecheck and stop**

Run: `pnpm exec prettier --write convex/lib/interactionGraph.ts convex/lib/interactionGraph.test.ts` then
`pnpm typecheck`. Report the result to Henriko. Do not commit.

---

### Task 2: `convex/lib/ranking.ts` (pure rank maths)

**Files:**

- Create: `convex/lib/ranking.ts`
- Create: `convex/lib/ranking.test.ts`

**Interfaces:**

- Consumes: nothing (pure).
- Produces: `rankPositions`, `positionOf`, `movement`, `pickPreviousGeneration`, `digestWindow`, `topEntries`.
  Task 3 uses `topEntries`; Task 5 uses `rankPositions` / `positionOf` / `movement` / `pickPreviousGeneration`;
  Task 19 uses `digestWindow`.

- [ ] **Step 1: Write the failing unit test**

Create `convex/lib/ranking.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  digestWindow,
  movement,
  pickPreviousGeneration,
  positionOf,
  rankPositions,
  topEntries
} from './ranking'

describe('rankPositions', () => {
  it('uses competition ranking: 1,2,2,4', () => {
    expect(rankPositions([9, 7, 7, 5])).toEqual([1, 2, 2, 4])
  })
})

describe('positionOf', () => {
  it('finds the first index of a count in a descending array', () => {
    expect(positionOf(7, [9, 7, 7, 5])).toBe(2)
    expect(positionOf(9, [9, 7])).toBe(1)
  })

  it('returns null for zero or an absent count', () => {
    expect(positionOf(0, [9, 7])).toBeNull()
    expect(positionOf(4, [9, 7])).toBeNull()
  })
})

describe('movement', () => {
  it('is positive when the position number went down', () => {
    expect(movement(12, 8)).toBe(4)
    expect(movement(8, 12)).toBe(-4)
    expect(movement(8, 8)).toBe(0)
    expect(movement(null, 8)).toBeNull()
    expect(movement(12, null)).toBeNull()
  })
})

describe('pickPreviousGeneration', () => {
  it('picks the newest generation at or before the last digest, null when none', () => {
    const gens = [{ generatedAt: 300 }, { generatedAt: 200 }, { generatedAt: 100 }]
    expect(pickPreviousGeneration(gens, 250)).toEqual({ generatedAt: 200 })
    expect(pickPreviousGeneration(gens, 50)).toBeNull()
  })
})

describe('digestWindow', () => {
  it('spans three days from the last send, or three days back when never sent', () => {
    const now = 10 * 86_400_000
    expect(digestWindow(now, 4 * 86_400_000)).toEqual({ since: 7 * 86_400_000, until: now })
    expect(digestWindow(now, undefined)).toEqual({ since: 7 * 86_400_000, until: now })
  })

  it('never reaches back more than three days even when lastDigestAt is old', () => {
    const now = 100 * 86_400_000
    expect(digestWindow(now, 10 * 86_400_000)).toEqual({ since: 97 * 86_400_000, until: now })
  })
})

describe('topEntries', () => {
  it('sorts by count desc then lastAt desc then id asc and slices', () => {
    const map = new Map([
      ['b', { count: 2, lastAt: 100 }],
      ['a', { count: 2, lastAt: 200 }],
      ['c', { count: 1, lastAt: 300 }]
    ])
    expect(topEntries(map, 2).map(e => e.userId)).toEqual(['a', 'b'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter ./convex test lib/ranking.test.ts`
Expected: FAIL with "Cannot find module './ranking'".

- [ ] **Step 3: Write the implementation**

Create `convex/lib/ranking.ts`:

```ts
// Pure rank maths for R22/R24. Positions are 1-based position numbers: a SMALLER number is a better rank, so a
// positive `movement` means the member climbed. Competition ranking: equal counts share the lower (worse) number,
// e.g. [9,7,7,5] -> [1,2,2,4].

const DAY = 86_400_000
const DIGEST_SPAN = 3 * DAY

/** Competition ranking over a descending counts array. */
export function rankPositions(countsDescending: number[]): number[] {
  return countsDescending.map((count, i) => {
    let better = 0
    for (let j = 0; j < i; j += 1) if (countsDescending[j] > count) better += 1
    return better + 1
  })
}

/** Exact 1-based position for a count via binary search; null when the count is zero or absent. */
export function positionOf(count: number, countsDescending: number[]): number | null {
  if (count <= 0) return null
  let lo = 0
  let hi = countsDescending.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (countsDescending[mid] > count) lo = mid + 1
    else hi = mid
  }
  return lo < countsDescending.length && countsDescending[lo] === count ? lo + 1 : null
}

/** Positive = climbed (position number decreased). Null when either side is unknown. */
export function movement(previousPosition: number | null, currentPosition: number | null): number | null {
  if (previousPosition === null || currentPosition === null) return null
  return previousPosition - currentPosition
}

/** Newest generation at or before `lastDigestAt`, or null when the member was never sent a digest. */
export function pickPreviousGeneration<T extends { generatedAt: number }>(generations: T[], lastDigestAt: number): T | null {
  return generations.find(g => g.generatedAt <= lastDigestAt) ?? null
}

/** Half-open [since, until): three days, never further back even when the last send is older. */
export function digestWindow(now: number, lastDigestAt?: number): { since: number; until: number } {
  const floor = now - DIGEST_SPAN
  const since = lastDigestAt !== undefined && lastDigestAt > floor ? lastDigestAt : floor
  return { since, until: now }
}

export interface CountedEntry {
  userId: string
  count: number
  lastAt: number
}

/** Snapshot ordering: count desc, then newest activity, then id asc; sliced to `limit`. */
export function topEntries(map: Map<string, { count: number; lastAt: number }>, limit: number): CountedEntry[] {
  return [...map.entries()]
    .map(([userId, v]) => ({ userId, count: v.count, lastAt: v.lastAt }))
    .sort((a, b) => b.count - a.count || b.lastAt - a.lastAt || (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0))
    .slice(0, limit)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter ./convex test lib/ranking.test.ts`
Expected: PASS (7 assertions across 6 tests).

- [ ] **Step 5: Format, typecheck and stop**

Run: `pnpm exec prettier --write convex/lib/ranking.ts convex/lib/ranking.test.ts` then `pnpm typecheck`. Report the
result to Henriko. Do not commit.

---

### Task 3: Schema + `convex/jobs/rankingSnapshot.ts` + cron

**Files:**

- Modify: `convex/schema.ts` (add `rankingSnapshots` after `survivalSnapshots`; add `leaderboardOptOut` to `users`
  near the other preference fields)
- Create: `convex/jobs/rankingSnapshot.ts`
- Create: `convex/integration/rankingSnapshot.test.ts`
- Modify: `convex/crons.ts` (two entries after the survival snapshot cron)

**Interfaces:**

- Consumes: `tallySiteActors` and `InteractionRow` from Task 1; `topEntries`, `rankPositions` from Task 2.
- Produces: `internal.jobs.rankingSnapshot.rebuildRankingSnapshots({ window })`; table
  `rankingSnapshots` with `window`, `generatedAt`, `since`, `topPosters`, `topInteractors`, `posterCountsDescending`,
  `interactorCountsDescending`, `partial`. Task 5 reads it; Task 19 reads it.

- [ ] **Step 1: Add the schema**

In `convex/schema.ts`, add to `users` after `feedFilterCountries` (line 47):

```ts
    // R22 — set via users.setLeaderboardOptOut. Absent ⇒ the member appears in the site-wide rankings.
    // Hides only from rankings; the members directory and the mutual interaction lists are unaffected.
    leaderboardOptOut: v.optional(v.boolean()),
```

After the `survivalSnapshots` table (line 504), add:

```ts
  // R22 — daily site-wide ranking board. One row per (window, day); the query reads the two newest generations to
  // show movement. User IDs are stored, never names: reads join `users` and drop banned or opted-out members. The
  // counts arrays let the page state an exact position for members outside the top 100. See jobs/rankingSnapshot.ts.
  rankingSnapshots: defineTable({
    window: v.union(v.literal('7d'), v.literal('30d')),
    generatedAt: v.number(),
    since: v.number(),
    topPosters: v.array(v.object({ userId: v.id('users'), count: v.number(), lastAt: v.number() })),
    topInteractors: v.array(v.object({ userId: v.id('users'), count: v.number(), lastAt: v.number() })),
    posterCountsDescending: v.array(v.number()),
    interactorCountsDescending: v.array(v.number()),
    // True when a scan ceiling was hit: the board is a truncated view, never a wrong one.
    partial: v.boolean()
  }).index('by_window_and_generated_at', ['window', 'generatedAt']),
```

- [ ] **Step 2: Write the failing integration test**

Create `convex/integration/rankingSnapshot.test.ts`:

```ts
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { internal } from '../_generated/api'
import type { TestConvex } from 'convex-test'
import schema from '../schema'

const modules = import.meta.glob('../**/*.ts')

type T = TestConvex<typeof schema>

const NOW = Date.now()
const DAY = 86_400_000

async function seedUser(t: T, name: string, createdAt = NOW) {
  return await t.run(async ctx =>
    ctx.db.insert('users', { linkedinId: `li-${name}`, name, subscriptionStatus: 'none', createdAt })
  )
}

// NOW must be the real clock: the job computes its own window from Date.now().
async function seedInteraction(
  t: T,
  userId: Awaited<ReturnType<typeof seedUser>>,
  authorId: Awaited<ReturnType<typeof seedUser>>,
  at = NOW
) {
  return await t.run(async ctx => {
    const postId = await ctx.db.insert('posts', {
      linkedinPostUrn: `urn:${crypto.randomUUID()}`,
      authorId,
      content: 'x',
      publishedAt: at,
      likeCount: 0,
      commentCount: 0,
      mediaUrls: [],
      isFeatured: false,
      visibilityIndustries: [],
      visibilityCountries: [],
      hidden: false
    })
    return ctx.db.insert('userInteractions', {
      userId,
      postId,
      authorId,
      kind: 'reaction' as const,
      createdAt: at
    })
  })
}

describe('rankingSnapshot.rebuildRankingSnapshots', () => {
  test('writes one row per window with posters and interactors, excluding hidden posts', async () => {
    const t = convexTest(schema, modules)
    const ana = await seedUser(t, 'Ana')
    const bruno = await seedUser(t, 'Bruno')
    await seedInteraction(t, bruno, ana)
    await seedInteraction(t, bruno, ana)
    await seedInteraction(t, ana, bruno)

    await t.mutation(internal.jobs.rankingSnapshot.rebuildRankingSnapshots, { window: '7d' })

    const rows = await t.run(async ctx =>
      ctx.db.query('rankingSnapshots').withIndex('by_window_and_generated_at').collect()
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].window).toBe('7d')
    expect(rows[0].partial).toBe(false)
    expect(rows[0].topInteractors[0]).toMatchObject({ userId: bruno, count: 2 })
    expect(rows[0].interactorCountsDescending).toEqual([2, 1])
    expect(rows[0].topPosters.map(p => p.userId)).toEqual([ana, bruno])
  })

  test('second run keeps the previous generation for movement', async () => {
    const t = convexTest(schema, modules)
    const ana = await seedUser(t, 'Ana')
    await seedInteraction(t, ana, await seedUser(t, 'Bruno'))

    await t.mutation(internal.jobs.rankingSnapshot.rebuildRankingSnapshots, { window: '7d' })
    await t.run(async ctx => {
      const rows = await ctx.db.query('rankingSnapshots').collect()
      await ctx.db.patch(rows[0]._id, { generatedAt: Date.now() - DAY })
    })
    await t.mutation(internal.jobs.rankingSnapshot.rebuildRankingSnapshots, { window: '7d' })

    const rows = await t.run(async ctx =>
      ctx.db.query('rankingSnapshots').withIndex('by_window_and_generated_at').collect()
    )
    expect(rows).toHaveLength(2)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter ./convex exec vitest run --config vitest.integration.config.ts integration/rankingSnapshot.test.ts`
Expected: FAIL with "Could not find module 'jobs/rankingSnapshot'".

- [ ] **Step 4: Write the job**

Create `convex/jobs/rankingSnapshot.ts`:

```ts
// R22 — daily site-wide ranking snapshot. One bounded pass per window: read the newest interactions and posts,
// tally, write one rankingSnapshots row, keep the newest 4 generations per window (movement + digest lookback).
// DEVIATION from spec §5.6: a single bounded pass with `partial` instead of a cursor chain, see the plan header.
import { internalMutation } from '../_generated/server'
import { v } from 'convex/values'
import type { MutationCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { tallySiteActors, type InteractionRow } from '../lib/interactionGraph'
import { topEntries } from '../lib/ranking'

export const SNAPSHOT_ROW_CEILING = 10_000
const TOP_LIST = 100
const KEEP_GENERATIONS = 4
const DAY = 86_400_000

const WINDOW_MS: Record<'7d' | '30d', number> = { '7d': 7 * DAY, '30d': 30 * DAY }

function asInteractionRows(rows: Doc<'userInteractions'>[]): InteractionRow[] {
  return rows.map(r => ({
    _creationTime: r._creationTime,
    userId: r.userId,
    authorId: r.authorId,
    postId: r.postId,
    kind: r.kind
  }))
}

async function trimGenerations(ctx: MutationCtx, window: '7d' | '30d'): Promise<void> {
  const all = await ctx.db
    .query('rankingSnapshots')
    .withIndex('by_window_and_generated_at', q => q.eq('window', window))
    .order('desc')
    .collect()
  for (const row of all.slice(KEEP_GENERATIONS)) await ctx.db.delete(row._id)
}

export const rebuildRankingSnapshots = internalMutation({
  args: { window: v.union(v.literal('7d'), v.literal('30d')) },
  handler: async (ctx, { window }) => {
    const now = Date.now()
    const since = now - WINDOW_MS[window]

    const interactionRows = await ctx.db
      .query('userInteractions')
      .order('desc')
      .take(SNAPSHOT_ROW_CEILING)
    const relevantInteractions = asInteractionRows(interactionRows).filter(r => r._creationTime >= since)
    const interactorMap = tallySiteActors(relevantInteractions, since)

    const postRows = await ctx.db.query('posts').order('desc').take(SNAPSHOT_ROW_CEILING)
    const posterMap = new Map<string, { count: number; lastAt: number }>()
    for (const post of postRows) {
      if (post.publishedAt < since || post.hidden || post.deletedAt !== undefined) continue
      const acc = posterMap.get(post.authorId) ?? { count: 0, lastAt: 0 }
      acc.count += 1
      if (post.publishedAt > acc.lastAt) acc.lastAt = post.publishedAt
      posterMap.set(post.authorId, acc)
    }

    const topInteractors = topEntries(interactorMap, TOP_LIST)
    const topPosters = topEntries(posterMap, TOP_LIST)
    await ctx.db.insert('rankingSnapshots', {
      window,
      generatedAt: now,
      since,
      topInteractors,
      topPosters,
      interactorCountsDescending: [...interactorMap.values()].map(v => v.count).sort((a, b) => b - a),
      posterCountsDescending: [...posterMap.values()].map(v => v.count).sort((a, b) => b - a),
      partial:
        interactionRows.length === SNAPSHOT_ROW_CEILING || postRows.length === SNAPSHOT_ROW_CEILING
    })
    await trimGenerations(ctx, window)
  }
})
```

Note on the `.take(SNAPSHOT_ROW_CEILING)` + `.order('desc')` scan: `partial` is true whenever the take fills, even if
every fetched row was inside the window. That is the honest signal ("the board may not have seen everything"), and the
UI copy says "daily snapshot".

- [ ] **Step 5: Add the crons**

In `convex/crons.ts`, after the survival snapshot entry (line 64):

```ts
// ─── Ranking snapshots (R22) ─────────────────────────────────────────────────
// Daily site-wide ranking board, one row per window, keeping the newest 4 generations. 03:30 and 03:35 UTC,
// after the 03:15 survival snapshot, so the boards and the panel move at the same predictable time.
crons.cron('rebuild 7d ranking snapshot', '30 3 * * *', internal.jobs.rankingSnapshot.rebuildRankingSnapshots, {
  window: '7d'
})
crons.cron('rebuild 30d ranking snapshot', '35 3 * * *', internal.jobs.rankingSnapshot.rebuildRankingSnapshots, {
  window: '30d'
})
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter ./convex exec vitest run --config vitest.integration.config.ts integration/rankingSnapshot.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Format, typecheck and stop**

Run: `pnpm exec prettier --write convex/schema.ts convex/jobs/rankingSnapshot.ts convex/crons.ts
convex/integration/rankingSnapshot.test.ts` then `pnpm typecheck`. Report the result to Henriko. Do not commit.

---

### Task 4: People queries in `convex/interactions.ts`

**Files:**

- Modify: `convex/interactions.ts` (imports at the top; append after `listMyInteractions`, line 566)
- Create: `convex/integration/interactionGraph.test.ts`

**Interfaces:**

- Consumes: Task 1 tallies; `toSearchPerson` from `convex/search.ts` (returns
  `{ _id, name, headline, profilePictureUrl, linkedinPublicIdentifier }`); `requireAuth` from `convex/lib/auth.ts`;
  `RECAP_ROW_CEILING`, `windowBounds`, `excerpt` from `convex/lib/recap.ts`.
- Produces: `api.interactions.listPeopleWhoInteractedWithMe`, `api.interactions.listPeopleIInteractedWith`,
  `api.interactions.listInteractionsByPost`, each `{ sessionToken, window: '7d' | '30d' }` plus a `now: number` arg
  (client-floored to the hour, same convention as `getRecap`). Task 6 renders them.

- [ ] **Step 1: Write the failing integration test**

Create `convex/integration/interactionGraph.test.ts`:

```ts
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from '../_generated/api'
import type { TestConvex } from 'convex-test'
import schema from '../schema'

const modules = import.meta.glob('../**/*.ts')
type T = TestConvex<typeof schema>

const NOW = Date.now()
const DAY = 86_400_000

async function seed(t: T) {
  const me = await t.run(async ctx =>
    ctx.db.insert('users', {
      linkedinId: 'me',
      name: 'Me',
      subscriptionStatus: 'none',
      createdAt: NOW,
      language: 'en'
    })
  )
  const ana = await t.run(async ctx =>
    ctx.db.insert('users', { linkedinId: 'ana', name: 'Ana', subscriptionStatus: 'none', createdAt: NOW })
  )
  const post = await t.run(async ctx =>
    ctx.db.insert('posts', {
      linkedinPostUrn: 'urn:1',
      authorId: me,
      content: 'hello world',
      publishedAt: NOW,
      likeCount: 1,
      commentCount: 0,
      mediaUrls: [],
      isFeatured: false,
      visibilityIndustries: [],
      visibilityCountries: [],
      hidden: false
    })
  )
  await t.run(async ctx =>
    ctx.db.insert('userInteractions', {
      userId: ana,
      postId: post,
      authorId: me,
      kind: 'reaction' as const,
      createdAt: NOW - DAY
    })
  )
  const session = await t.run(async ctx =>
    ctx.db.insert('sessions', { token: 'tok', userId: me, expiresAt: NOW + DAY })
  )
  return { me, ana, post, token: 'tok' }
}

describe('interactions people queries', () => {
  test('received list returns the actor with the count', async () => {
    const t = convexTest(schema, modules)
    const { token } = await seed(t)
    const result = await t.query(api.interactions.listPeopleWhoInteractedWithMe, {
      sessionToken: token,
      window: '7d',
      now: NOW
    })
    expect(result.people).toHaveLength(1)
    expect(result.people[0]).toMatchObject({ name: 'Ana', reactions: 1, comments: 0, total: 1 })
    expect(result.truncated).toBe(false)
  })

  test('made list is empty when the member made no interactions', async () => {
    const t = convexTest(schema, modules)
    await seed(t)
    const result = await t.query(api.interactions.listPeopleIInteractedWith, {
      sessionToken: 'tok',
      window: '30d',
      now: NOW
    })
    expect(result.people).toEqual([])
  })

  test('by-post accordion groups the received interaction under its post', async () => {
    const t = convexTest(schema, modules)
    await seed(t)
    const result = await t.query(api.interactions.listInteractionsByPost, {
      sessionToken: 'tok',
      window: '7d',
      now: NOW
    })
    expect(result.posts).toHaveLength(1)
    expect(result.posts[0].actors[0]).toMatchObject({ name: 'Ana', total: 1 })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter ./convex exec vitest run --config vitest.integration.config.ts integration/interactionGraph.test.ts`
Expected: FAIL: `api.interactions.listPeopleWhoInteractedWithMe` is undefined.

- [ ] **Step 3: Write the queries**

In `convex/interactions.ts`, add to the imports:

```ts
import { excerpt, excludeSelf, RECAP_ROW_CEILING, windowBounds } from './lib/recap'
import {
  tallyMadeByPerson,
  tallyReceivedByPerson,
  tallyReceivedByPost,
  type CounterpartyTally,
  type InteractionRow
} from './lib/interactionGraph'
import { toSearchPerson } from './search'
```

Check the existing import block first: `excerpt` and `excludeSelf` may already be imported; do not duplicate. Append
after `listMyInteractions`:

```ts
// ── Interaction graph (R22) ──────────────────────────────────────────────────────────────────────
// `now` is client-floored to the hour (same contract as getRecap). Reads are newest-first with the 2000-row ceiling
// per side per window; `truncated` tells the page. Tallies are pure (lib/interactionGraph).

/** One `get` per unique user id, projected with the same safe profile fields as people search. */
async function projectPeople<T extends { userId: string }>(
  ctx: QueryCtx,
  tallies: T[]
): Promise<Array<T & ReturnType<typeof toSearchPerson>>> {
  const ids = [...new Set(tallies.map(t => t.userId))]
  const users = await Promise.all(ids.map(id => ctx.db.get(id as Id<'users'>)))
  const map = new Map(users.filter((u): u is Doc<'users'> => u !== null).map(u => [u._id as string, u]))
  return tallies.flatMap(t => {
    const user = map.get(t.userId)
    return user ? [{ ...t, ...toSearchPerson(user) }] : []
  })
}

export const listPeopleWhoInteractedWithMe = query({
  args: { sessionToken: v.string(), window: v.union(v.literal('7d'), v.literal('30d')), now: v.number() },
  handler: async (ctx, { sessionToken, window, now }) => {
    const user = await requireAuth(ctx, sessionToken)
    const { since } = windowBounds(window, now)
    const rows = await ctx.db
      .query('userInteractions')
      .withIndex('by_author', q => q.eq('authorId', user._id).gte('_creationTime', since))
      .order('desc')
      .take(RECAP_ROW_CEILING)
    const tallies = tallyReceivedByPerson(
      rows.map(r => ({
        _creationTime: r._creationTime,
        userId: r.userId as string,
        authorId: r.authorId as string | undefined,
        postId: r.postId as string,
        kind: r.kind
      })),
      since
    )
    return {
      window,
      since,
      total: tallies.reduce((sum, t) => sum + t.total, 0),
      people: await projectPeople(ctx, tallies),
      truncated: rows.length >= RECAP_ROW_CEILING
    }
  }
})

export const listPeopleIInteractedWith = query({
  args: { sessionToken: v.string(), window: v.union(v.literal('7d'), v.literal('30d')), now: v.number() },
  handler: async (ctx, { sessionToken, window, now }) => {
    const user = await requireAuth(ctx, sessionToken)
    const { since } = windowBounds(window, now)
    const rows = await ctx.db
      .query('userInteractions')
      .withIndex('by_user', q => q.eq('userId', user._id).gte('_creationTime', since))
      .order('desc')
      .take(RECAP_ROW_CEILING)
    const tallies = tallyMadeByPerson(
      rows.map(r => ({
        _creationTime: r._creationTime,
        userId: r.userId as string,
        authorId: r.authorId as string | undefined,
        postId: r.postId as string,
        kind: r.kind
      })),
      since
    )
    return {
      window,
      since,
      total: tallies.reduce((sum, t) => sum + t.total, 0),
      people: await projectPeople(ctx, tallies),
      truncated: rows.length >= RECAP_ROW_CEILING
    }
  }
})

export const listInteractionsByPost = query({
  args: { sessionToken: v.string(), window: v.union(v.literal('7d'), v.literal('30d')), now: v.number() },
  handler: async (ctx, { sessionToken, window, now }) => {
    const user = await requireAuth(ctx, sessionToken)
    const { since } = windowBounds(window, now)
    const rows = await ctx.db
      .query('userInteractions')
      .withIndex('by_author', q => q.eq('authorId', user._id).gte('_creationTime', since))
      .order('desc')
      .take(RECAP_ROW_CEILING)
    const posts = tallyReceivedByPost(
      rows.map(r => ({
        _creationTime: r._creationTime,
        userId: r.userId as string,
        authorId: r.authorId as string | undefined,
        postId: r.postId as string,
        kind: r.kind
      })),
      since
    )
    const postIds = [...new Set(posts.map(p => p.postId))]
    const postDocs = await Promise.all(postIds.map(id => ctx.db.get(id as Id<'posts'>)))
    const postMap = new Map(postDocs.filter((p): p is Doc<'posts'> => p !== null).map(p => [p._id as string, p]))
    const actorIds = [...new Set(posts.flatMap(p => p.actors.map(a => a.userId)))]
    const actorDocs = await Promise.all(actorIds.map(id => ctx.db.get(id as Id<'users'>)))
    const actorMap = new Map(
      actorDocs.filter((u): u is Doc<'users'> => u !== null).map(u => [u._id as string, toSearchPerson(u)])
    )
    return {
      window,
      since,
      truncated: rows.length >= RECAP_ROW_CEILING,
      posts: posts.flatMap(p => {
        const post = postMap.get(p.postId)
        if (!post) return []
        return [
          {
            postId: p.postId,
            excerpt: excerpt(post.content),
            linkedinPostUrn: post.linkedinPostUrn,
            sourceUrl: post.sourceUrl,
            total: p.total,
            lastAt: p.lastAt,
            removed: post.deletedAt !== undefined || post.hidden,
            actors: projectTallies(p.actors, actorMap)
          }
        ]
      })
    }
  }
})

/** Pure projection shared by the by-post accordion: drops actors missing from the user map. */
function projectTallies(
  tallies: CounterpartyTally[],
  users: Map<string, ReturnType<typeof toSearchPerson>>
): Array<CounterpartyTally & ReturnType<typeof toSearchPerson>> {
  return tallies.flatMap(t => {
    const user = users.get(t.userId)
    return user ? [{ ...t, ...user }] : []
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter ./convex exec vitest run --config vitest.integration.config.ts integration/interactionGraph.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Format, typecheck and stop**

Run: `pnpm exec prettier --write convex/interactions.ts convex/integration/interactionGraph.test.ts` then
`pnpm typecheck`. Report the result to Henriko. Do not commit.

---

### Task 5: Rankings queries + `users.listMembers` + `users.setLeaderboardOptOut`

**Files:**

- Create: `convex/rankings.ts`
- Create: `convex/integration/rankings.test.ts`
- Modify: `convex/users.ts` (append after `setCommentLanguage`, line 542)
- Modify: `convex/interactions.ts` (export a shared loader used by both files)

**Interfaces:**

- Consumes: Task 1 tallies, Task 2 rank maths, Task 3 `rankingSnapshots` table, `writeAuditLog` from
  `convex/lib/audit.ts`.
- Produces: `api.rankings.getMyRankings({ sessionToken, window, now })`,
  `api.rankings.getSiteRankings({ sessionToken, window })`,
  `api.users.listMembers({ sessionToken, paginationOpts })`,
  `api.users.setLeaderboardOptOut({ sessionToken, optOut })`. Tasks 6 and 7 render them.

- [ ] **Step 1: Write the failing integration test**

Create `convex/integration/rankings.test.ts`:

```ts
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api, internal } from '../_generated/api'
import type { TestConvex } from 'convex-test'
import schema from '../schema'

const modules = import.meta.glob('../**/*.ts')
type T = TestConvex<typeof schema>
const NOW = Date.now()
const DAY = 86_400_000

async function seed(t: T) {
  const me = await t.run(async ctx =>
    ctx.db.insert('users', { linkedinId: 'me', name: 'Me', subscriptionStatus: 'none', createdAt: NOW })
  )
  const ana = await t.run(async ctx =>
    ctx.db.insert('users', { linkedinId: 'ana', name: 'Ana', subscriptionStatus: 'none', createdAt: NOW })
  )
  const post = await t.run(async ctx =>
    ctx.db.insert('posts', {
      linkedinPostUrn: 'urn:1',
      authorId: me,
      content: 'hello',
      publishedAt: NOW,
      likeCount: 1,
      commentCount: 0,
      mediaUrls: [],
      isFeatured: false,
      visibilityIndustries: [],
      visibilityCountries: [],
      hidden: false
    })
  )
  await t.run(async ctx =>
    ctx.db.insert('userInteractions', {
      userId: ana,
      postId: post,
      authorId: me,
      kind: 'reaction' as const,
      createdAt: NOW
    })
  )
  await t.run(async ctx => ctx.db.insert('sessions', { token: 'tok', userId: me, expiresAt: NOW + DAY }))
  return { me, ana }
}

describe('rankings', () => {
  test('getMyRankings returns both directions', async () => {
    const t = convexTest(schema, modules)
    await seed(t)
    const result = await t.query(api.rankings.getMyRankings, { sessionToken: 'tok', window: '7d', now: NOW })
    expect(result.received[0]).toMatchObject({ name: 'Ana', total: 1 })
    expect(result.made).toEqual([])
  })

  test('getSiteRankings joins the snapshot and reports the member position', async () => {
    const t = convexTest(schema, modules)
    await seed(t)
    await t.mutation(internal.jobs.rankingSnapshot.rebuildRankingSnapshots, { window: '7d' })
    const before = await t.query(api.rankings.getSiteRankings, { sessionToken: 'tok', window: '7d' })
    expect(before.interactors[0]).toMatchObject({ name: 'Ana', count: 1 })
    // "Me" authored the post but made no interactions: zero count, no position.
    expect(before.me).toMatchObject({ count: 0, position: null, movement: null, optedOut: false })
  })

  test('the member count is read live so a position exists beyond the stored top list', async () => {
    const t = convexTest(schema, modules)
    const { me, ana } = await seed(t)
    const myPost = await t.run(async ctx => (await ctx.db.query('posts').first())!)
    const anaPost = await t.run(async ctx =>
      ctx.db.insert('posts', {
        linkedinPostUrn: 'urn:2',
        authorId: ana,
        content: 'x',
        publishedAt: NOW,
        likeCount: 0,
        commentCount: 0,
        mediaUrls: [],
        isFeatured: false,
        visibilityIndustries: [],
        visibilityCountries: [],
        hidden: false
      })
    )
    await t.run(async ctx => {
      await ctx.db.insert('userInteractions', {
        userId: ana,
        postId: myPost._id,
        authorId: me,
        kind: 'reaction' as const,
        createdAt: NOW
      })
      await ctx.db.insert('userInteractions', {
        userId: me,
        postId: anaPost,
        authorId: ana,
        kind: 'reaction' as const,
        createdAt: NOW
      })
    })
    await t.mutation(internal.jobs.rankingSnapshot.rebuildRankingSnapshots, { window: '7d' })
    const result = await t.query(api.rankings.getSiteRankings, { sessionToken: 'tok', window: '7d' })
    expect(result.me).toMatchObject({ count: 1, position: 2 })
  })

  test('an opted-out member disappears from the site board', async () => {
    const t = convexTest(schema, modules)
    const { ana } = await seed(t)
    await t.mutation(internal.jobs.rankingSnapshot.rebuildRankingSnapshots, { window: '7d' })
    await t.run(async ctx => ctx.db.patch(ana, { leaderboardOptOut: true }))
    const after = await t.query(api.rankings.getSiteRankings, { sessionToken: 'tok', window: '7d' })
    expect(after.interactors.map(r => r.name)).not.toContain('Ana')
  })

  test('setLeaderboardOptOut flips the flag and is audited', async () => {
    const t = convexTest(schema, modules)
    await seed(t)
    await t.mutation(internal.jobs.rankingSnapshot.rebuildRankingSnapshots, { window: '7d' })
    await t.mutation(api.users.setLeaderboardOptOut, { sessionToken: 'tok', optOut: true })
    const after = await t.query(api.rankings.getSiteRankings, { sessionToken: 'tok', window: '7d' })
    expect(after.me.optedOut).toBe(true)
    const audits = await t.run(async ctx => ctx.db.query('auditLogs').collect())
    expect(audits.some(a => a.action === 'leaderboard_opt_out_changed')).toBe(true)
  })
})

describe('users.listMembers', () => {
  test('lists members with the safe projection and excludes banned', async () => {
    const t = convexTest(schema, modules)
    await seed(t)
    await t.run(async ctx => {
      await ctx.db.insert('users', { linkedinId: 'x', name: 'Banned', subscriptionStatus: 'none', createdAt: NOW, isBanned: true })
    })
    const result = await t.query(api.users.listMembers, {
      sessionToken: 'tok',
      paginationOpts: { numItems: 10, cursor: null }
    })
    // Creation order ascending: "Me" was seeded before "Ana"; the banned member is filtered out.
    expect(result.page.map(u => u.name)).toEqual(['Me', 'Ana'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter ./convex exec vitest run --config vitest.integration.config.ts integration/rankings.test.ts`
Expected: FAIL: `api.rankings` undefined.

- [ ] **Step 3: Write `convex/rankings.ts`**

```ts
// R22 — personal and site-wide rankings. Personal blocks aggregate the existing log on demand (same 2000-row
// ceiling as the people lists); the site board reads the daily rankingSnapshots. Names are joined at read time and
// banned or opted-out members are dropped there, never at write time.
import { query } from './_generated/server'
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { requireAuth } from './lib/auth'
import { RECAP_ROW_CEILING, windowBounds } from './lib/recap'
import { tallyMadeByPerson, tallyReceivedByPerson, type InteractionRow } from './lib/interactionGraph'
import { movement, pickPreviousGeneration, positionOf } from './lib/ranking'
import { toSearchPerson } from './search'

/** Rows shown per site board after banned/opt-out filtering (the snapshot stores up to 100). */
const TOP_LIST = 20

function toRows(rows: Doc<'userInteractions'>[]): InteractionRow[] {
  return rows.map(r => ({
    _creationTime: r._creationTime,
    userId: r.userId as string,
    authorId: r.authorId as string | undefined,
    postId: r.postId as string,
    kind: r.kind
  }))
}

async function withProfiles<T extends { userId: string }>(ctx: Parameters<typeof requireAuth>[0], tallies: T[]) {
  const ids = [...new Set(tallies.map(t => t.userId))]
  const users = await Promise.all(ids.map(id => ctx.db.get(id as Id<'users'>)))
  const map = new Map(users.filter((u): u is Doc<'users'> => u !== null).map(u => [u._id as string, u]))
  return tallies.flatMap(t => {
    const user = map.get(t.userId)
    return user ? [{ ...t, ...toSearchPerson(user) }] : []
  })
}

export const getMyRankings = query({
  args: { sessionToken: v.string(), window: v.union(v.literal('7d'), v.literal('30d')), now: v.number() },
  handler: async (ctx, { sessionToken, window, now }) => {
    const user = await requireAuth(ctx, sessionToken)
    const { since } = windowBounds(window, now)
    const receivedRows = await ctx.db
      .query('userInteractions')
      .withIndex('by_author', q => q.eq('authorId', user._id).gte('_creationTime', since))
      .order('desc')
      .take(RECAP_ROW_CEILING)
    const madeRows = await ctx.db
      .query('userInteractions')
      .withIndex('by_user', q => q.eq('userId', user._id).gte('_creationTime', since))
      .order('desc')
      .take(RECAP_ROW_CEILING)
    const received = tallyReceivedByPerson(toRows(receivedRows), since).slice(0, 10)
    const made = tallyMadeByPerson(toRows(madeRows), since).slice(0, 10)
    return {
      window,
      since,
      truncated: receivedRows.length >= RECAP_ROW_CEILING || madeRows.length >= RECAP_ROW_CEILING,
      received: await withProfiles(ctx, received),
      made: await withProfiles(ctx, made)
    }
  }
})

export const getSiteRankings = query({
  args: { sessionToken: v.string(), window: v.union(v.literal('7d'), v.literal('30d')) },
  handler: async (ctx, { sessionToken, window }) => {
    const user = await requireAuth(ctx, sessionToken)
    const generations = await ctx.db
      .query('rankingSnapshots')
      .withIndex('by_window_and_generated_at', q => q.eq('window', window))
      .order('desc')
      .take(4)
    const latest = generations[0]
    if (!latest) {
      return { window, generatedAt: null, partial: false, interactors: [], posters: [], me: null }
    }
    const previous = pickPreviousGeneration([...generations].slice(1), latest.generatedAt - 1)

    async function decorate(list: Doc<'rankingSnapshots'>['topInteractors']) {
      const ids = list.map(e => e.userId)
      const users = await Promise.all(ids.map(id => ctx.db.get(id)))
      const map = new Map(
        users
          .filter((u): u is Doc<'users'> => u !== null)
          .filter(u => !u.isBanned && u.deletionScheduledAt === undefined)
          .map(u => [u._id as string, u])
      )
      return list.flatMap(entry => {
        const owner = map.get(entry.userId as string)
        if (!owner || owner.leaderboardOptOut === true) return []
        return [{ ...toSearchPerson(owner), userId: owner._id as string, count: entry.count, lastAt: entry.lastAt }]
      })
    }

    const interactors = (await decorate(latest.topInteractors)).slice(0, TOP_LIST)
    const posters = (await decorate(latest.topPosters)).slice(0, TOP_LIST)

    // The board stores identities only for the top 100, so the member's own count for the window is read live from
    // their made interactions (same bounded pattern as getMyRankings). Position then comes from the full counts
    // distribution, which is what makes "you are #87" possible beyond the top 100.
    const myRows = await ctx.db
      .query('userInteractions')
      .withIndex('by_user', q => q.eq('userId', user._id).gte('_creationTime', latest.since))
      .order('desc')
      .take(RECAP_ROW_CEILING)
    const countNow = myRows.filter(
      r => r.kind !== 'ai_draft' && (r.authorId === undefined || r.authorId !== user._id)
    ).length
    const findCount = (list: Doc<'rankingSnapshots'>['topInteractors']) =>
      list.find(e => e.userId === user._id)?.count ?? 0
    const prevCount = previous ? findCount(previous.topInteractors) : 0
    const currentPosition = countNow > 0 ? positionOf(countNow, latest.interactorCountsDescending) : null
    const previousPosition = previous && prevCount > 0 ? positionOf(prevCount, previous.interactorCountsDescending) : null

    return {
      window,
      generatedAt: latest.generatedAt,
      partial: latest.partial,
      interactors,
      posters,
      me: {
        id: user._id as string,
        count: countNow,
        position: currentPosition,
        movement: movement(previousPosition, currentPosition),
        optedOut: user.leaderboardOptOut === true
      }
    }
  }
})
```

- [ ] **Step 4: Add `users.listMembers` and `users.setLeaderboardOptOut`**

In `convex/users.ts`, append after `setCommentLanguage` (line 542). Add imports if missing:

```ts
import { paginationOptsValidator } from 'convex/server'
import { toSearchPerson } from './search'
import { writeAuditLog, type AuditDb } from './lib/audit'
```

```ts
/**
 * R22 — members directory for /people. Safe projection only (name, headline, picture, LinkedIn identifier);
 * banned and pending-deletion members are excluded, like people search. Paginated.
 */
export const listMembers = query({
  args: { sessionToken: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { sessionToken, paginationOpts }) => {
    await requireAuth(ctx, sessionToken)
    // Unindexed creation order, exactly like users.getActiveSubscribers (users.ts:54). The directory is a small
    // paginated list; the page can sort the loaded page alphabetically in the UI.
    const result = await ctx.db.query('users').paginate(paginationOpts)
    return {
      ...result,
      page: result.page
        .filter(u => !u.isBanned && u.deletionScheduledAt === undefined)
        .map(toSearchPerson)
    }
  }
})

/** R22 — the rankings opt-out. Idempotent, audited: the objection itself is the record. */
export const setLeaderboardOptOut = mutation({
  args: { sessionToken: v.string(), optOut: v.boolean() },
  handler: async (ctx, { sessionToken, optOut }) => {
    const user = await requireAuth(ctx, sessionToken)
    if (user.leaderboardOptOut === optOut) return
    await ctx.db.patch(user._id, { leaderboardOptOut: optOut })
    await writeAuditLog(ctx.db as unknown as AuditDb, {
      actor: 'user',
      actorId: user._id,
      action: 'leaderboard_opt_out_changed',
      targetUserId: user._id,
      metadata: JSON.stringify({ optOut })
    })
  }
})
```

Note: `listMembers` filters AFTER pagination, which can return short pages. That is acceptable here (a banned member
is rare and the directory is alphabetical); never filter inside `.paginate`. Say this in a comment.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter ./convex exec vitest run --config vitest.integration.config.ts integration/rankings.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Format, typecheck and stop**

Run: `pnpm exec prettier --write convex/rankings.ts convex/users.ts convex/integration/rankings.test.ts` then
`pnpm typecheck`. Report the result to Henriko. Do not commit.

---

### Task 6: `/people` page, `PeopleAccordion`, window toggle reuse, i18n

**Files:**

- Modify: `app/src/components/WindowToggle.tsx` (add `labelPrefix`)
- Create: `app/src/components/PeopleAccordion.tsx` (+ `.test.tsx`)
- Create: `app/src/pages/PeoplePage.tsx` (+ `.test.tsx`)
- Modify: `app/src/App.tsx` (route after `/history`, line 141)
- Modify: `app/src/components/shell/navItems.ts` (item after `/history`)
- Modify: `app/src/i18n/locales/{en,pt,es}.json` (`nav.people`, `people.*`)

**Interfaces:**

- Consumes: Task 4 queries; `WindowToggle`; `PageHeader`; `Avatar`; `buildPostUrl` from
  `app/src/components/LinkedInEmbed.tsx`; `timeAgoDetailed` is NOT available yet (Task 12 adds it), so this task
  renders relative dates with the existing `timeAgo(ts, t)` from `app/src/lib/relativeDay.ts`.
- Produces: route `/people`; `PeopleAccordion` reused only here.

- [ ] **Step 1: Add `labelPrefix` to `WindowToggle`**

Change the props and label lookup in `app/src/components/WindowToggle.tsx`:

```tsx
export default function WindowToggle<T extends ToggleWindow>({
  value,
  onChange,
  options,
  labelPrefix = 'recap.window'
}: {
  value: T
  onChange: (next: T) => void
  options: readonly T[]
  labelPrefix?: string
}) {
```

and the label becomes `{t(`${labelPrefix}.${option}`)}`. Existing callers (`RecapPage`, `HistoryPage`) are unchanged.

- [ ] **Step 2: Write the failing component test**

Create `app/src/components/PeopleAccordion.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => `${key}${opts ? JSON.stringify(opts) : ''}` })
}))
vi.mock('@/components/LinkedInEmbed', () => ({ buildPostUrl: (urn: string) => `https://ln/${urn}` }))

import PeopleAccordion from './PeopleAccordion'

const post = {
  postId: 'p1',
  excerpt: 'A post about SSI',
  linkedinPostUrn: 'urn:li:activity:1',
  total: 2,
  lastAt: Date.now(),
  removed: false,
  actors: [
    { userId: 'u1', name: 'Ana', headline: 'Founder', profilePictureUrl: undefined, reactions: 2, comments: 0, total: 2, lastAt: Date.now() }
  ]
}

describe('PeopleAccordion', () => {
  it('starts collapsed and expands to the actor rows', () => {
    render(<PeopleAccordion posts={[post]} />)
    expect(screen.queryByText(/Ana/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /people\.accordionToggle/ }))
    expect(screen.getByText(/Ana/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter ./app test src/components/PeopleAccordion.test.tsx`
Expected: FAIL: cannot resolve `./PeopleAccordion`.

- [ ] **Step 4: Write the component**

Create `app/src/components/PeopleAccordion.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { buildPostUrl } from '@/components/LinkedInEmbed'
import { timeAgo } from '@/lib/relativeDay'

export interface AccordionActor {
  userId: string
  name: string
  headline?: string
  profilePictureUrl?: string
  reactions: number
  comments: number
  total: number
  lastAt: number
}

export interface AccordionPost {
  postId: string
  excerpt: string
  linkedinPostUrn: string
  sourceUrl?: string
  total: number
  lastAt: number
  removed: boolean
  actors: AccordionActor[]
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
}

export default function PeopleAccordion({ posts }: { posts: AccordionPost[] }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState<Record<string, boolean>>({})
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {posts.map(post => {
        const expanded = open[post.postId] === true
        return (
          <li key={post.postId} className="rounded-lg border">
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={`post-actors-${post.postId}`}
              onClick={() => setOpen(prev => ({ ...prev, [post.postId]: !expanded }))}
              className="flex w-full items-center justify-between gap-3 p-3 text-left"
            >
              <span className="text-foreground line-clamp-2 text-sm">{post.excerpt}</span>
              <span className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
                {post.removed && <Badge variant="outline">{t('people.postRemoved')}</Badge>}
                <span>{t('people.accordionToggle')}</span>
                <span aria-hidden="true">{expanded ? '−' : '+'}</span>
              </span>
            </button>
            {expanded && (
              <ul id={`post-actors-${post.postId}`} className="m-0 flex list-none flex-col gap-1 border-t p-3">
                {post.actors.map(actor => (
                  <li key={actor.userId} className="flex items-center gap-3 text-sm">
                    <Avatar className="size-8">
                      <AvatarImage src={actor.profilePictureUrl} alt="" />
                      <AvatarFallback>{initials(actor.name)}</AvatarFallback>
                    </Avatar>
                    <span className="text-foreground flex-1 truncate">{actor.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {t('people.tally', { reactions: actor.reactions, comments: actor.comments })}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">{timeAgo(actor.lastAt, t)}</span>
                  </li>
                ))}
                {!post.removed && (
                  <li>
                    <a
                      href={buildPostUrl(post.linkedinPostUrn, post.sourceUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-xs hover:underline"
                    >
                      {t('feed.viewOnLinkedIn')}
                    </a>
                  </li>
                )}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}
```

The accordion test only needs `timeAgo` and `Avatar` to render; keep those imports. If `Badge` is not exported the way
the draft assumes, mirror `HistoryPage.tsx:70` exactly (it imports `Badge` from `@/components/ui/badge`).

- [ ] **Step 5: Write the page**

Create `app/src/pages/PeoplePage.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from 'convex/react'
import { api } from '../convex'
import PageHeader from '@/components/PageHeader'
import WindowToggle, { type ToggleWindow } from '@/components/WindowToggle'
import PeopleAccordion from '@/components/PeopleAccordion'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { floorToHour } from '@/lib/recapTime'
import { timeAgo } from '@/lib/relativeDay'

type Tab = 'received' | 'made' | 'all'
const WINDOWS: ReadonlyArray<'7d' | '30d'> = ['7d', '30d']

// PeoplePage is R22's home for the three raw-note items: who interacted with you (accordion by post), who you
// interacted with, and the members directory. Personal windows are 7d/30d like Recap; the directory is unfiltered.

export default function PeoplePage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('received')
  const [window, setWindow] = useState<'7d' | '30d'>('7d')
  const [now] = useState(() => floorToHour(Date.now()))
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined

  const received = useQuery(
    api.interactions.listPeopleWhoInteractedWithMe,
    tab === 'received' && sessionToken ? { sessionToken, window, now } : 'skip'
  )
  const made = useQuery(
    api.interactions.listPeopleIInteractedWith,
    tab === 'made' && sessionToken ? { sessionToken, window, now } : 'skip'
  )
  const byPost = useQuery(
    api.interactions.listInteractionsByPost,
    tab === 'received' && sessionToken ? { sessionToken, window, now } : 'skip'
  )

  return (
    <div className="mx-auto max-w-[720px] px-4">
      <PageHeader title={t('people.title')} lead={t('people.lead')}>
        {tab !== 'all' && <WindowToggle value={window} onChange={setWindow} options={WINDOWS} />}
      </PageHeader>
      <div role="tablist" className="mt-4 flex gap-1 rounded-full border p-1 text-sm">
        {(['received', 'made', 'all'] as const).map(value => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={tab === value ? 'bg-primary text-primary-foreground min-h-10 flex-1 rounded-full' : 'min-h-10 flex-1 rounded-full text-muted-foreground'}
          >
            {t(`people.tabs.${value}`)}
          </button>
        ))}
      </div>
      {tab === 'received' && byPost && <PeopleAccordion posts={byPost.posts} />}
      {/* ... made-tab people list and all-tab directory are specified in Step 6 ... */}
    </div>
  )
}
```

- [ ] **Step 6: Complete the page's list tabs**

The final `PeoplePage` must render, with no placeholders:

1. `received` tab body: when `byPost === undefined` a skeleton `<p>…</p>`; when `byPost.posts.length === 0` the
   `t('people.emptyReceived')` paragraph; otherwise `<PeopleAccordion posts={byPost.posts} />` and, when
   `byPost.truncated`, `t('people.truncated')`.
2. `made` tab body: the same three states over `made.people` with `t('people.emptyMade')`, rows rendered as
   `<PersonRow person={entry} />`.
3. `all` tab: a `<DirectoryList />` that calls
   `useQuery(api.users.listMembers, sessionToken ? { sessionToken, paginationOpts: { numItems: 50, cursor: null } } : 'skip')`
   and renders `page` with `<PersonRow />`; when `page.length === 0`, `t('people.emptyAll')`.
4. `PersonRow` is a small local component in the same file: `Avatar` + name + headline + total/
   `t('people.count', { count })`
    + `timeAgo(lastAt, t)` when present.
5. `floorToHour` is exported by `convex/lib/recap.ts` and pages import it directly, exactly like
   `app/src/pages/HistoryPage.tsx:15` (`import { floorToHour, windowBounds } from '../../../convex/lib/recap'`).
   `PeoplePage.tsx` sits in the same directory, so use `import { floorToHour } from '../../../convex/lib/recap'`.

- [ ] **Step 7: Add route, nav item and i18n**

`app/src/App.tsx`, after the `/history` route (line 141):

```tsx
          <Route
            path="/people"
            element={
              <RequireAuth>
                <PeoplePage />
              </RequireAuth>
            }
          />
```

Add the import `import PeoplePage from './pages/PeoplePage'` beside the other page imports.

`app/src/components/shell/navItems.ts`: import `Users` from `lucide-react` and add after `/history`:

```ts
      { path: '/people', labelKey: 'nav.people', icon: Users },
```

Add the JSON blocks (all three files, exact English source):

`en.json`:

```json
  "people": {
    "title": "People",
    "lead": "See who interacted with you, who you interacted with, and everyone on the platform.",
    "tabs": { "received": "Interacted with you", "made": "You interacted with", "all": "All members" },
    "emptyReceived": "No one interacted with your posts in this window yet.",
    "emptyMade": "You have not interacted with anyone in this window yet.",
    "emptyAll": "No members to show yet.",
    "truncated": "Showing the 2000 most recent interactions only.",
    "accordionToggle": "View people",
    "postRemoved": "Post removed",
    "count_one": "{{count}} interaction",
    "count_other": "{{count}} interactions",
    "tally": "{{reactions}} reactions, {{comments}} comments"
  },
```

`pt.json`:

```json
  "people": {
    "title": "Pessoas",
    "lead": "Veja com quem você interagiu, quem interagiu com você e todos na plataforma.",
    "tabs": { "received": "Interagiram com você", "made": "Você interagiu com", "all": "Todos os membros" },
    "emptyReceived": "Ninguém interagiu com seus posts nesta janela ainda.",
    "emptyMade": "Você ainda não interagiu com ninguém nesta janela.",
    "emptyAll": "Ainda não há membros para mostrar.",
    "truncated": "Mostrando apenas as 2000 interações mais recentes.",
    "accordionToggle": "Ver pessoas",
    "postRemoved": "Post removido",
    "count_one": "{{count}} interação",
    "count_other": "{{count}} interações",
    "tally": "{{reactions}} reações, {{comments}} comentários"
  },
```

`es.json`:

```json
  "people": {
    "title": "Personas",
    "lead": "Mira con quién interactuaste, quién interactuó contigo y todos en la plataforma.",
    "tabs": { "received": "Interactuaron contigo", "made": "Interactuaste con", "all": "Todos los miembros" },
    "emptyReceived": "Nadie interactuó con tus publicaciones en esta ventana todavía.",
    "emptyMade": "Todavía no interactuaste con nadie en esta ventana.",
    "emptyAll": "Aún no hay miembros para mostrar.",
    "truncated": "Mostrando solo las 2000 interacciones más recientes.",
    "accordionToggle": "Ver personas",
    "postRemoved": "Publicación eliminada",
    "count_one": "{{count}} interacción",
    "count_other": "{{count}} interacciones",
    "tally": "{{reactions}} reacciones, {{comments}} comentarios"
  },
```

Add to `nav` in all three files: `"people": "People"` / `"people": "Pessoas"` / `"people": "Personas"`.

- [ ] **Step 8: Run the app tests**

Run: `pnpm --filter ./app test src/components/PeopleAccordion.test.tsx src/pages/PeoplePage.test.tsx` (write
`PeoplePage.test.tsx` following `RecapPage.test.tsx:3-26`'s mock pattern: mock `../convex` with the three query refs,
mock `convex/react` with a `mockQueryReturns` map, and assert the three tabs render, that the received tab shows the
actor name after expansion, and that the empty state renders when the list is empty).
Expected: PASS.

- [ ] **Step 9: Format, typecheck and stop**

Run: `pnpm exec prettier --write app/src/components/WindowToggle.tsx app/src/components/PeopleAccordion.tsx
app/src/components/PeopleAccordion.test.tsx app/src/pages/PeoplePage.tsx app/src/pages/PeoplePage.test.tsx
app/src/App.tsx app/src/components/shell/navItems.ts app/src/i18n/locales/en.json app/src/i18n/locales/pt.json
app/src/i18n/locales/es.json` then `pnpm typecheck` and `pnpm lint`. Report the result to Henriko. Do not commit.

---

### Task 7: `/rankings` page, `RankingList`, nav, i18n

**Files:**

- Create: `app/src/components/RankingList.tsx` (+ `.test.tsx`)
- Create: `app/src/pages/RankingsPage.tsx` (+ `.test.tsx`)
- Modify: `app/src/App.tsx` (route after `/people`)
- Modify: `app/src/components/shell/navItems.ts` (item after `/people`)
- Modify: `app/src/i18n/locales/{en,pt,es}.json` (`nav.rankings`, `rankings.*`)

**Interfaces:**

- Consumes: Task 5 queries; `WindowToggle`; `Avatar`; `timeAgo`.
- Produces: route `/rankings`.

- [ ] **Step 1: Write the failing component test**

Create `app/src/components/RankingList.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => `${key}${opts ? JSON.stringify(opts) : ''}` })
}))

import RankingList from './RankingList'

describe('RankingList', () => {
  it('renders rank numbers, names and counts, highlighting the member row', () => {
    render(
      <RankingList
        titleKey="rankings.topInteractors"
        rows={[
          { userId: 'u1', name: 'Ana', count: 9, lastAt: 1 },
          { userId: 'me', name: 'Me', count: 4, lastAt: 2 }
        ]}
        meId="me"
      />
    )
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText(/rankings\.count\{\"count\":9\}/)).toBeInTheDocument()
    expect(screen.getByText('Me').closest('li')).toHaveClass('bg-muted')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter ./app test src/components/RankingList.test.tsx`
Expected: FAIL: cannot resolve `./RankingList`.

- [ ] **Step 3: Write the component**

Create `app/src/components/RankingList.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

export interface RankingRow {
  userId: string
  name: string
  headline?: string
  profilePictureUrl?: string
  count: number
  lastAt: number
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('')
}

/** Top-3 rows carry the visible "medal" treatment (a filled chip); 4+ stay plain numbers. */
function rankChipClass(rank: number): string {
  return rank <= 3 ? 'bg-primary text-primary-foreground inline-flex size-6 items-center justify-center rounded-full text-xs' : ''
}

export default function RankingList({
  titleKey,
  rows,
  meId
}: {
  titleKey: string
  rows: RankingRow[]
  meId?: string
}) {
  const { t } = useTranslation()
  return (
    <section className="mt-4">
      <h2 className="text-foreground mb-2 text-sm font-semibold">{t(titleKey)}</h2>
      <ol className="m-0 flex list-none flex-col gap-1 p-0">
        {rows.map((row, index) => {
          const rank = index + 1
          const isMe = row.userId === meId
          return (
            <li
              key={row.userId}
              className={cn('flex items-center gap-3 rounded-lg border px-3 py-2', isMe && 'bg-muted')}
            >
              <span
                className={cn('w-6 shrink-0 text-right text-sm tabular-nums', rankChipClass(rank))}
                aria-label={t('rankings.rankLabel', { rank })}
              >
                {rank}
              </span>
              <Avatar className="size-8">
                <AvatarImage src={row.profilePictureUrl} alt="" />
                <AvatarFallback>{initials(row.name)}</AvatarFallback>
              </Avatar>
              <span className="text-foreground min-w-0 flex-1 truncate text-sm">{row.name}</span>
              <span className="text-muted-foreground shrink-0 text-xs">
                {t('rankings.count', { count: row.count })}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
```

- [ ] **Step 4: Write the page**

Create `app/src/pages/RankingsPage.tsx` with:

1. `useState` for `window` and the hour-floored `now` (same pattern as `PeoplePage`).
2. `const rankings = useQuery(api.rankings.getSiteRankings, sessionToken ? { sessionToken, window } : 'skip')` and
   `const mine = useQuery(api.rankings.getMyRankings, sessionToken ? { sessionToken, window, now } : 'skip')`.
3. Header with `PageHeader title={t('rankings.title')} lead={t('rankings.lead')}` and the `WindowToggle`.
4. If `rankings === undefined` render `<p>…</p>`. When `rankings.generatedAt === null`, render `t('rankings.empty')`
   inside the site block only (the personal block still renders from `mine`).
5. "You" block: two `<RankingList>` with `titleKey="rankings.toYou"` / `"rankings.byYou"`, rows mapped from
   `mine.received` / `mine.made` to `{ userId, name, headline, profilePictureUrl, count: total, lastAt }`.
6. Site block: `<RankingList titleKey="rankings.topPosters" rows={rankings.posters} meId={rankings.me?.id} />` and
   `<RankingList titleKey="rankings.topInteractors" rows={rankings.interactors} meId={rankings.me?.id} />`.
   `getSiteRankings` returns `me.id` (Task 5), so no extra `getMe` call is needed.
7. Position line under the site block:
    - when `rankings.me.position !== null`: `t('rankings.yourPosition', { position: rankings.me.position })` plus,
      when `rankings.me.movement !== null`, `t('rankings.movementUp' / 'movementDown' / 'movementSame')`.
    - when `rankings.me.position === null`: `t('rankings.noPosition')`.
    - the opt-out control: a `<Button variant="ghost" size="sm">` whose label is `t('rankings.optOut')` when
      `!rankings.me.optedOut` and `t('rankings.optIn')` otherwise. It runs an async handler that disables the button
      while in flight and, on rejection, keeps the page usable and surfaces the failure (a `toast` from
      `@/components/ui/toast`, matching SettingsPage/BillingPage patterns); it must not use a non-null assertion on
      `sessionToken`: guard `if (!sessionToken) return` inside the handler. `onClick` payload:
      `{ sessionToken, optOut: !rankings.me.optedOut }`.
    - when `rankings.partial` render `t('rankings.partial')`.
8. Enforce the layout in the page container `mx-auto max-w-[720px] px-4` and keep the two blocks in that order.

- [ ] **Step 5: Add route, nav item and i18n**

`app/src/App.tsx` after the `/people` route: same wrapper with `<RankingsPage />`; add the import. `navItems.ts`:
import `Trophy` and add `{ path: '/rankings', labelKey: 'nav.rankings', icon: Trophy }` after `/people`.

JSON additions:

`en.json`:

```json
  "rankings": {
    "title": "Rankings",
    "lead": "Your top people and the site board for the selected window.",
    "you": "You",
    "toYou": "Interacted with your posts",
    "byYou": "You interacted with",
    "site": "Site ranking",
    "topPosters": "Most posts",
    "topInteractors": "Most interactions",
    "yourPosition": "You are #{{position}}",
    "noPosition": "No position in this window yet",
    "movementUp": "Up {{count}} since yesterday",
    "movementDown": "Down {{count}} since yesterday",
    "movementSame": "Same position since yesterday",
    "optOut": "Do not show me in rankings",
    "optIn": "Show me in rankings again",
    "partial": "This board is a daily snapshot.",
    "empty": "No activity in this window yet.",
    "updateFailed": "Could not save. Please try again.",
    "rankLabel": "Position {{rank}}",
    "count_one": "{{count}} interaction",
    "count_other": "{{count}} interactions"
  },
```

`pt.json`:

```json
  "rankings": {
    "title": "Ranking",
    "lead": "Suas pessoas no topo e o quadro do site na janela selecionada.",
    "you": "Você",
    "toYou": "Interagiram com seus posts",
    "byYou": "Você interagiu com",
    "site": "Ranking do site",
    "topPosters": "Mais postagens",
    "topInteractors": "Mais interações",
    "yourPosition": "Você está em #{{position}}",
    "noPosition": "Ainda sem posição nesta janela",
    "movementUp": "Subiu {{count}} desde ontem",
    "movementDown": "Desceu {{count}} desde ontem",
    "movementSame": "Mesma posição desde ontem",
    "optOut": "Não quero aparecer no ranking",
    "optIn": "Quero aparecer no ranking novamente",
    "partial": "Este quadro é um retrato diário.",
    "empty": "Sem atividade nesta janela ainda.",
    "updateFailed": "Não foi possível salvar. Tente de novo.",
    "rankLabel": "Posição {{rank}}",
    "count_one": "{{count}} interação",
    "count_other": "{{count}} interações"
  },
```

`es.json`:

```json
  "rankings": {
    "title": "Ranking",
    "lead": "Tus personas destacadas y el tablero del sitio para la ventana seleccionada.",
    "you": "Tú",
    "toYou": "Interactuaron con tus publicaciones",
    "byYou": "Interactuaste con",
    "site": "Ranking del sitio",
    "topPosters": "Más publicaciones",
    "topInteractors": "Más interacciones",
    "yourPosition": "Estás en #{{position}}",
    "noPosition": "Todavía sin posición en esta ventana",
    "movementUp": "Subiste {{count}} desde ayer",
    "movementDown": "Bajaste {{count}} desde ayer",
    "movementSame": "Misma posición desde ayer",
    "optOut": "No quiero aparecer en el ranking",
    "optIn": "Quiero aparecer en el ranking otra vez",
    "partial": "Este tablero es una foto diaria.",
    "empty": "Todavía no hay actividad en esta ventana.",
    "updateFailed": "No se pudo guardar. Inténtalo de nuevo.",
    "rankLabel": "Posición {{rank}}",
    "count_one": "{{count}} interacción",
    "count_other": "{{count}} interacciones"
  },
```

Add `"rankings": "Ranking"` (en), `"rankings": "Ranking"` (pt), `"rankings": "Ranking"` (es) to the `nav` object.

- [ ] **Step 6: Write the page test and run everything**

Create `app/src/pages/RankingsPage.test.tsx` following the `RecapPage.test.tsx` mock pattern (mock `../convex` with
`rankings.getMyRankings`, `rankings.getSiteRankings`, `users.setLeaderboardOptOut`; mock `convex/react` with
`useQuery`/`useMutation`). Assert: the personal rows render, `yourPosition` renders with the returned position, the
opt-out click calls the mutation with `{ optOut: true }` when currently false, and `partial` renders the snapshot
caption.

Run: `pnpm --filter ./app test src/components/RankingList.test.tsx src/pages/RankingsPage.test.tsx`
Expected: PASS.

- [ ] **Step 7: Format, typecheck, lint and stop**

Run: `pnpm exec prettier --write app/src/components/RankingList.tsx app/src/components/RankingList.test.tsx
app/src/pages/RankingsPage.tsx app/src/pages/RankingsPage.test.tsx app/src/App.tsx
app/src/components/shell/navItems.ts app/src/i18n/locales/en.json app/src/i18n/locales/pt.json
app/src/i18n/locales/es.json` then `pnpm typecheck` and `pnpm lint`. Report the result to Henriko. Do not commit.

---

### Task 8: `docs/PLATFORM.md` for R22

**Files:**

- Modify: `docs/PLATFORM.md`

**Interfaces:** none; documentation only.

- [ ] **Step 1: Update the sections the AGENTS.md mapping requires**

Read the "Maintaining This Document" mapping at the end of `docs/PLATFORM.md` first, then:

1. **§5 Data Model.** Add `rankingSnapshots` to the table reference and the entity-relationships diagram notes; add
   `users.leaderboardOptOut` to the users table row set.
2. **§11 Feed & Engagement.** Add a new subsection `### People, interaction graph and rankings (R22)` covering: the
   three queries and their 2000-row ceiling, the `partial` snapshot semantics, the daily snapshot crons at 03:30/03:35,
   the opt-out semantics (rankings only, directory and mutual lists unaffected), and the pre-2026-09-07 `authorId`
   gap.
3. **§13 Crons.** Add the two snapshot cron entries with their schedules and why they sit after the survival panel.
4. **§14 Frontend.** Add `/people` and `/rankings` to the Pages list and their nav positions.
5. **Table of Contents.** Add the new §11 subsection if the ToC lists subsections (check first).
6. **§19 Roadmap.** Note R22 shipped and that the counter/pair-table upgrade path is specified in
   `docs/superpowers/specs/2026-09-14-interaction-graph-notifications-digest-design.md` §6.

Keep the writing style of the file: short declarative sentences, table rows aligned to the existing style, no em
dashes introduced where the file uses them.

- [ ] **Step 2: Format and stop**

Run: `pnpm exec prettier --check docs/PLATFORM.md` (do NOT run `prettier --write` on Markdown; if it fails, hand-fix
the rows to match). Report the result to Henriko. Do not commit.

---

# Phase R23 - In-app notifications

### Task 9: Rename `convex/notifications.ts` to `convex/billingNotices.ts`

**Files:**

- Rename: `convex/notifications.ts` -> `convex/billingNotices.ts` (create the new file with identical content minus
  the header comment's file name, then delete the old file with `Remove-Item`)
- Modify: `convex/http.ts` (line 235), `convex/stripe.ts` (line 253), `convex/interactions.ts` (lines 111 and 245),
  `convex/billingNode.ts` (line 188), `convex/interactions.trialMilestone.test.ts` (line 104)

**Interfaces:**

- Consumes: nothing new.
- Produces: `internal.billingNotices.sendTrialEnding`, `sendTrialNearEnd`, `sendTrialConverted`, `sendPostCapReached`,
  `sendDuplicateCanceled`. The name `convex/notifications.ts` is free for Task 11.

- [ ] **Step 1: Create the renamed file**

Run `Get-Content convex/notifications.ts` and write the exact content to `convex/billingNotices.ts` with only the
first line changed to `// convex/billingNotices.ts`. Do not touch anything else in the file.

- [ ] **Step 2: Delete the old file**

Run: `Remove-Item -LiteralPath convex/notifications.ts`

- [ ] **Step 3: Update the five `internal.notifications.*` references**

Replace `internal.notifications.` with `internal.billingNotices.` in `convex/http.ts`, `convex/stripe.ts`,
`convex/interactions.ts` (two occurrences: `sendTrialNearEnd` line 111, `sendPostCapReached` line 245),
`convex/billingNode.ts`, and `convex/interactions.trialMilestone.test.ts`.

- [ ] **Step 4: Verify nothing else references the old module**

Run:
`Select-String -Path convex -Pattern "notifications\." -Exclude *_generated* -Recurse | Select-String -NotMatch "billingNotices|notifications\.ts"`.
Expected: no matches outside files that will be created in Task 11 (there are none yet). If any appear, update them.

- [ ] **Step 5: Run the affected tests and typecheck**

Run: `pnpm --filter ./convex test interactions.trialMilestone.test.ts` then `pnpm typecheck`.
Expected: PASS and no type errors. Run `npx convex codegen` from the repo root first if `internal.billingNotices`
does not resolve yet (a new module name only appears in `_generated/api.d.ts` after codegen).

- [ ] **Step 6: Format and stop**

Run: `pnpm exec prettier --write convex/billingNotices.ts convex/http.ts convex/stripe.ts convex/interactions.ts
convex/billingNode.ts convex/interactions.trialMilestone.test.ts`. Report the result to Henriko. Do not commit.

---

### Task 10: Notifications table + write-path inserts

**Files:**

- Modify: `convex/schema.ts` (new table after `userPostState`, line 480)
- Modify: `convex/interactions.ts` (`incrementCommentCount` line 249, `incrementLikeCount` line 295)
- Create: `convex/integration/notificationsWrite.test.ts`

**Interfaces:**

- Consumes: `excerpt` from `convex/lib/recap.ts`; `reactionValidator`.
- Produces: `notifications` table with `by_recipient_and_created_at`, `by_recipient_and_read_at`, `by_actor`,
  `by_created_at`. Task 11 queries it; Task 14 drains it.

- [ ] **Step 1: Add the schema**

In `convex/schema.ts` after `userPostState` (line 480):

```ts
  // R23 — one row per reaction or comment a member received on their post, written in the same transaction as the
  // interaction and the counter bump (interactions.incrementLikeCount / incrementCommentCount), so the three never
  // drift. Self-interactions never write a row. `readAt` absent ⇒ unread. Banned recipients are filtered at read
  // time (keep the log complete). `by_created_at` serves the 180-day retention purge.
  notifications: defineTable({
    recipientId: v.id('users'),
    actorId: v.id('users'),
    postId: v.id('posts'),
    kind: v.union(v.literal('reaction'), v.literal('comment')),
    reaction: v.optional(reactionValidator),
    excerpt: v.optional(v.string()),
    createdAt: v.number(),
    readAt: v.optional(v.number())
  })
    .index('by_recipient_and_created_at', ['recipientId', 'createdAt'])
    .index('by_recipient_and_read_at', ['recipientId', 'readAt'])
    .index('by_actor', ['actorId'])
    .index('by_created_at', ['createdAt']),
```

- [ ] **Step 2: Write the failing integration test**

Create `convex/integration/notificationsWrite.test.ts`:

```ts
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { internal } from '../_generated/api'
import type { TestConvex } from 'convex-test'
import schema from '../schema'

const modules = import.meta.glob('../**/*.ts')
type T = TestConvex<typeof schema>
const NOW = Date.now()

async function seed(t: T) {
  const ana = await t.run(async ctx =>
    ctx.db.insert('users', { linkedinId: 'ana', name: 'Ana', subscriptionStatus: 'none', createdAt: NOW })
  )
  const bruno = await t.run(async ctx =>
    ctx.db.insert('users', { linkedinId: 'bruno', name: 'Bruno', subscriptionStatus: 'none', createdAt: NOW })
  )
  const post = await t.run(async ctx =>
    ctx.db.insert('posts', {
      linkedinPostUrn: 'urn:1',
      authorId: bruno,
      content: 'hello',
      publishedAt: NOW,
      likeCount: 0,
      commentCount: 0,
      mediaUrls: [],
      isFeatured: false,
      visibilityIndustries: [],
      visibilityCountries: [],
      hidden: false
    })
  )
  return { ana, bruno, post }
}

describe('notification writes', () => {
  test('a comment writes a notification to the author with an excerpt', async () => {
    const t = convexTest(schema, modules)
    const { ana, bruno, post } = await seed(t)
    await t.mutation(internal.interactions.incrementCommentCount, {
      postId: post,
      actorId: ana,
      comment: 'Great point about the SSI'
    })
    const rows = await t.run(async ctx => ctx.db.query('notifications').collect())
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      recipientId: bruno,
      actorId: ana,
      kind: 'comment'
    })
    expect(rows[0].readAt).toBeUndefined()
    expect(rows[0].excerpt).toContain('Great point')
  })

  test('a reaction writes one notification and a repeat reaction writes none', async () => {
    const t = convexTest(schema, modules)
    const { ana, post } = await seed(t)
    await t.mutation(internal.interactions.incrementLikeCount, { postId: post, actorId: ana, reaction: 'LIKE' })
    await t.mutation(internal.interactions.incrementLikeCount, { postId: post, actorId: ana, reaction: 'LIKE' })
    const rows = await t.run(async ctx => ctx.db.query('notifications').collect())
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: 'reaction', reaction: 'LIKE' })
  })

  test('a self-interaction writes no notification and no received counter', async () => {
    const t = convexTest(schema, modules)
    const { bruno, post } = await seed(t)
    await t.mutation(internal.interactions.incrementCommentCount, {
      postId: post,
      actorId: bruno,
      comment: 'my own post'
    })
    expect(await t.run(async ctx => ctx.db.query('notifications').collect())).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run:
`pnpm --filter ./convex exec vitest run --config vitest.integration.config.ts integration/notificationsWrite.test.ts`
Expected: FAIL: notifications table does not exist / no rows.

- [ ] **Step 4: Add the inserts**

In `convex/interactions.ts`, inside `incrementCommentCount`, after the `userInteractions` insert (line 271) and
before the `userPostState` upsert:

```ts
    // R23 — same transaction: the inbox row for the author. Self-interactions never notify.
    if (post.authorId !== actorId) {
      await ctx.db.insert('notifications', {
        recipientId: post.authorId,
        actorId,
        postId,
        kind: 'comment',
        excerpt: excerpt(comment),
        createdAt: now
      })
    }
```

In `incrementLikeCount`, after the `userInteractions` insert (line 324):

```ts
    // R23 — same transaction: the inbox row for the author. Self and repeat taps never notify.
    if (post.authorId !== actorId) {
      await ctx.db.insert('notifications', {
        recipientId: post.authorId,
        actorId,
        postId,
        kind: 'reaction',
        reaction,
        createdAt: now
      })
    }
```

- [ ] **Step 5: Run the test to verify it passes**

Run:
`pnpm --filter ./convex exec vitest run --config vitest.integration.config.ts integration/notificationsWrite.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Run the existing interaction suites to prove no regression**

Run: `pnpm --filter ./convex test interactions` (unit) and
`pnpm --filter ./convex exec vitest run --config vitest.integration.config.ts` (full integration).
Expected: all green.

- [ ] **Step 7: Format, typecheck and stop**

Run: `pnpm exec prettier --write convex/schema.ts convex/interactions.ts convex/integration/notificationsWrite.test.ts`
then `pnpm typecheck`. Report the result to Henriko. Do not commit.

---

### Task 11: `convex/notifications.ts` (in-app queries and mutations)

**Files:**

- Create: `convex/notifications.ts`
- Create: `convex/integration/notifications.test.ts`

**Interfaces:**

- Consumes: `requireAuth`; `toSearchPerson`; `excerpt` is not needed (the excerpt is stored at write time).
- Produces: `api.notifications.listMine({ sessionToken, paginationOpts })`,
  `api.notifications.getUnreadCount({ sessionToken })`,
  `api.notifications.getLatest({ sessionToken })`,
  `api.notifications.markRead({ sessionToken, ids })`,
  `api.notifications.markAllRead({ sessionToken })`. Task 12/13 render them; Task 14 exports/drains the table.

- [ ] **Step 1: Write the failing integration test**

Create `convex/integration/notifications.test.ts`:

```ts
/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api, internal } from '../_generated/api'
import type { TestConvex } from 'convex-test'
import schema from '../schema'

const modules = import.meta.glob('../**/*.ts')
type T = TestConvex<typeof schema>
const NOW = Date.now()

async function seed(t: T) {
  const me = await t.run(async ctx =>
    ctx.db.insert('users', { linkedinId: 'me', name: 'Me', subscriptionStatus: 'none', createdAt: NOW })
  )
  const ana = await t.run(async ctx =>
    ctx.db.insert('users', { linkedinId: 'ana', name: 'Ana', subscriptionStatus: 'none', createdAt: NOW })
  )
  const post = await t.run(async ctx =>
    ctx.db.insert('posts', {
      linkedinPostUrn: 'urn:1',
      authorId: me,
      content: 'hello',
      publishedAt: NOW,
      likeCount: 0,
      commentCount: 0,
      mediaUrls: [],
      isFeatured: false,
      visibilityIndustries: [],
      visibilityCountries: [],
      hidden: false
    })
  )
  await t.run(async ctx => ctx.db.insert('sessions', { token: 'tok', userId: me, expiresAt: NOW + 86_400_000 }))
  await t.mutation(internal.interactions.incrementCommentCount, { postId: post, actorId: ana, comment: 'nice' })
  return { me, ana, post }
}

describe('notifications queries', () => {
  test('listMine joins the actor, counts unread and marks read', async () => {
    const t = convexTest(schema, modules)
    await seed(t)
    const page = await t.query(api.notifications.listMine, {
      sessionToken: 'tok',
      paginationOpts: { numItems: 10, cursor: null }
    })
    expect(page.page).toHaveLength(1)
    expect(page.page[0]).toMatchObject({ actorName: 'Ana', kind: 'comment', unread: true, removed: false })
    expect(await t.query(api.notifications.getUnreadCount, { sessionToken: 'tok' })).toBe(1)
    await t.mutation(api.notifications.markRead, { sessionToken: 'tok', ids: [page.page[0].id] })
    expect(await t.query(api.notifications.getUnreadCount, { sessionToken: 'tok' })).toBe(0)
  })

  test('a deleted post reads as removed', async () => {
    const t = convexTest(schema, modules)
    const { post } = await seed(t)
    await t.run(async ctx => ctx.db.patch(post, { deletedAt: NOW }))
    const page = await t.query(api.notifications.listMine, {
      sessionToken: 'tok',
      paginationOpts: { numItems: 10, cursor: null }
    })
    expect(page.page[0].removed).toBe(true)
  })

  test('getLatest returns the actor name for the toast', async () => {
    const t = convexTest(schema, modules)
    await seed(t)
    expect(await t.query(api.notifications.getLatest, { sessionToken: 'tok' })).toMatchObject({
      actorName: 'Ana',
      kind: 'comment'
    })
  })

  test('markRead ignores ids owned by someone else', async () => {
    const t = convexTest(schema, modules)
    await seed(t)
    const rows = await t.run(async ctx => ctx.db.query('notifications').collect())
    await t.run(async ctx =>
      ctx.db.insert('sessions', { token: 'other', userId: rows[0].actorId, expiresAt: NOW + 86_400_000 })
    )
    await t.mutation(api.notifications.markRead, { sessionToken: 'other', ids: [rows[0]._id] })
    expect(await t.query(api.notifications.getUnreadCount, { sessionToken: 'tok' })).toBe(1)
  })

  test('markAllRead clears the unread count', async () => {
    const t = convexTest(schema, modules)
    await seed(t)
    await t.mutation(api.notifications.markAllRead, { sessionToken: 'tok' })
    expect(await t.query(api.notifications.getUnreadCount, { sessionToken: 'tok' })).toBe(0)
  })

  test('markAllRead drains a backlog larger than one batch', async () => {
    const t = convexTest(schema, modules)
    const { me } = await seed(t)
    await t.run(async ctx => {
      const post = await ctx.db.query('posts').first()
      if (!post) throw new Error('seed post missing')
      for (let i = 0; i < 150; i += 1) {
        await ctx.db.insert('notifications', {
          recipientId: me,
          actorId: me,
          postId: post._id,
          kind: 'reaction' as const,
          createdAt: NOW + i
        })
      }
    })
    await t.mutation(api.notifications.markAllRead, { sessionToken: 'tok' })
    // The public mutation drains one batch and schedules the continuation; run it before asserting.
    // If the installed convex-test lacks finishInProgressScheduledFunctions, drain manually instead:
    // await t.mutation(internal.notifications.markAllReadBatch, { userId: me }).
    await t.finishInProgressScheduledFunctions()
    expect(await t.query(api.notifications.getUnreadCount, { sessionToken: 'tok' })).toBe(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter ./convex exec vitest run --config vitest.integration.config.ts integration/notifications.test.ts`
Expected: FAIL: `api.notifications` undefined.

- [ ] **Step 3: Write the module**

Create `convex/notifications.ts`:

```ts
// R23 — in-app notifications. One row per received reaction/comment, written by interactions.increment*. Read paths
// join the actor and the post at query time; banned recipients are filtered here so the row itself is never lost.
import { internalMutation, mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import type { Doc, Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { requireAuth } from './lib/auth'
import type { Reaction } from './lib/reactions'
import { excerpt } from './lib/recap'

const MARK_ALL_BATCH = 100

interface NotificationRow {
  id: string
  kind: 'reaction' | 'comment'
  reaction?: Reaction
  excerpt?: string
  createdAt: number
  readAt?: number
  unread: boolean
  actorName: string
  actorHeadline?: string
  actorPictureUrl?: string
  postExcerpt: string
  postUrn: string
  postSourceUrl?: string
  removed: boolean
}

async function resolveActors(ctx: Parameters<typeof requireAuth>[0], ids: Id<'users'>[]) {
  const unique = [...new Set(ids.map(id => id as string))]
  const users = await Promise.all(unique.map(id => ctx.db.get(id as Id<'users'>)))
  return new Map(users.filter((u): u is Doc<'users'> => u !== null).map(u => [u._id as string, u]))
}

async function resolvePosts(ctx: Parameters<typeof requireAuth>[0], ids: Id<'posts'>[]) {
  const unique = [...new Set(ids.map(id => id as string))]
  const posts = await Promise.all(unique.map(id => ctx.db.get(id as Id<'posts'>)))
  return new Map(posts.filter((p): p is Doc<'posts'> => p !== null).map(p => [p._id as string, p]))
}

function toRow(
  row: Doc<'notifications'>,
  actors: Map<string, Doc<'users'>>,
  posts: Map<string, Doc<'posts'>>
): NotificationRow {
  const actor = actors.get(row.actorId as string)
  const post = posts.get(row.postId as string)
  return {
    id: row._id as string,
    kind: row.kind,
    reaction: row.reaction,
    excerpt: row.excerpt,
    createdAt: row.createdAt,
    readAt: row.readAt,
    unread: row.readAt === undefined,
    actorName: actor?.name ?? '',
    actorHeadline: actor?.headline,
    actorPictureUrl: actor?.profilePictureUrl,
    postExcerpt: post ? excerpt(post.content) : '',
    postUrn: post?.linkedinPostUrn ?? '',
    postSourceUrl: post?.sourceUrl,
    removed: post === undefined || post.deletedAt !== undefined || post.hidden
  }
}

export const listMine = query({
  args: { sessionToken: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { sessionToken, paginationOpts }) => {
    const user = await requireAuth(ctx, sessionToken)
    const page = await ctx.db
      .query('notifications')
      .withIndex('by_recipient_and_created_at', q => q.eq('recipientId', user._id))
      .order('desc')
      .paginate(paginationOpts)
    const [actors, posts] = await Promise.all([
      resolveActors(ctx, page.page.map(r => r.actorId)),
      resolvePosts(ctx, page.page.map(r => r.postId))
    ])
    return { ...page, page: page.page.map(r => toRow(r, actors, posts)) }
  }
})

export const getUnreadCount = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuth(ctx, sessionToken)
    const rows = await ctx.db
      .query('notifications')
      .withIndex('by_recipient_and_read_at', q => q.eq('recipientId', user._id).eq('readAt', undefined))
      .take(MARK_ALL_BATCH)
    return rows.length
  }
})

export const getLatest = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuth(ctx, sessionToken)
    const row = await ctx.db
      .query('notifications')
      .withIndex('by_recipient_and_created_at', q => q.eq('recipientId', user._id))
      .order('desc')
      .first()
    if (!row) return null
    const actor = await ctx.db.get(row.actorId)
    return { _id: row._id as string, actorName: actor?.name ?? '', kind: row.kind }
  }
})

export const markRead = mutation({
  args: { sessionToken: v.string(), ids: v.array(v.string()) },
  handler: async (ctx, { sessionToken, ids }) => {
    const user = await requireAuth(ctx, sessionToken)
    const now = Date.now()
    for (const raw of ids.slice(0, MARK_ALL_BATCH)) {
      // Client-supplied ids: normalize before get(), so a malformed or foreign-table id is a no-op instead of a
      // thrown transaction that rolls back valid ids earlier in the array (mirrors posts.ts's normalizeId usage).
      const id = ctx.db.normalizeId('notifications', raw)
      if (!id) continue
      const row = await ctx.db.get(id)
      if (!row || row.recipientId !== user._id || row.readAt !== undefined) continue
      await ctx.db.patch(row._id, { readAt: now })
    }
  }
})

function markAllInternal(ctx: Parameters<typeof requireAuth>[0], userId: Id<'users'>) {
  return ctx.db
    .query('notifications')
    .withIndex('by_recipient_and_read_at', q => q.eq('recipientId', userId).eq('readAt', undefined))
    .take(MARK_ALL_BATCH)
}

/**
 * Marks the caller's unread inbox as read, one bounded batch per transaction. A full batch schedules the continuation
 * (internalMutation, same logic, no auth) so a large backlog drains across transactions instead of risking the
 * single-transaction read/write limit; the public mutation returns immediately either way.
 */
export const markAllReadBatch = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const rows = await markAllInternal(ctx, userId)
    const now = Date.now()
    for (const row of rows) await ctx.db.patch(row._id, { readAt: now })
    if (rows.length === MARK_ALL_BATCH) {
      await ctx.scheduler.runAfter(0, internal.notifications.markAllReadBatch, { userId })
    }
  }
})

export const markAllRead = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuth(ctx, sessionToken)
    const rows = await markAllInternal(ctx, user._id)
    const now = Date.now()
    for (const row of rows) await ctx.db.patch(row._id, { readAt: now })
    if (rows.length === MARK_ALL_BATCH) {
      await ctx.scheduler.runAfter(0, internal.notifications.markAllReadBatch, { userId: user._id })
    }
  }
})
```

The `actorId` on `toRow` uses `row.actorId` typed as `Id<'users'>`; the `as string` casts match the repo's existing
style for map keys. If `getUnreadCount`'s `.eq('readAt', undefined)` fights the validator, mirror
`users.by_deletion_and_last_login`'s exact query shape (schema.ts:120 comment) - it is the precedent for undefined
equality.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter ./convex exec vitest run --config vitest.integration.config.ts integration/notifications.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Format, typecheck and stop**

Run: `pnpm exec prettier --write convex/notifications.ts convex/integration/notifications.test.ts` then
`pnpm typecheck`. Report the result to Henriko. Do not commit.

---

### Task 12: `timeAgoDetailed`, `NotificationBell`, toast

**Files:**

- Modify: `app/src/lib/relativeDay.ts` (+ create `app/src/lib/relativeDay.test.ts`)
- Create: `app/src/components/shell/NotificationBell.tsx` (+ `.test.tsx`)
- Modify: `app/src/components/shell/TopBar.tsx` (insert before `<LanguageMenu />`, line 84)
- Modify: `app/src/i18n/locales/{en,pt,es}.json` (`notifications.*` time keys)

**Interfaces:**

- Consumes: `toast(message: string)` from `@/components/ui/toast`; `api.notifications.getUnreadCount`,
  `api.notifications.getLatest`.
- Produces: `timeAgoDetailed(ts, t)`, `<NotificationBell />`.

- [ ] **Step 1: Write the failing test for the new helper**

Create `app/src/lib/relativeDay.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { timeAgoDetailed } from './relativeDay'

const t = ((key: string, opts?: Record<string, unknown>) =>
  opts ? `${key}:${JSON.stringify(opts)}` : key) as unknown as Parameters<typeof timeAgoDetailed>[1]

describe('timeAgoDetailed', () => {
  it('resolves minutes, hours and days', () => {
    const now = Date.now()
    expect(timeAgoDetailed(now, t)).toBe('notifications.justNow')
    expect(timeAgoDetailed(now - 5 * 60_000, t)).toBe('notifications.minutesAgo:{"count":5}')
    expect(timeAgoDetailed(now - 3 * 3_600_000, t)).toBe('notifications.hoursAgo:{"count":3}')
    expect(timeAgoDetailed(now - 2 * 86_400_000, t)).toBe('notifications.daysAgo:{"count":2}')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter ./app test src/lib/relativeDay.test.ts`
Expected: FAIL: `timeAgoDetailed` is not exported.

- [ ] **Step 3: Implement the helper**

Append to `app/src/lib/relativeDay.ts`:

```ts
/** Inbox-grade relative time: minutes and hours matter here, unlike timeAgo's day buckets. */
export function timeAgoDetailed(ts: number, t: TFunction): string {
  const minutes = Math.floor(Math.max(0, Date.now() - ts) / 60_000)
  if (minutes < 1) return t('notifications.justNow')
  if (minutes < 60) return t('notifications.minutesAgo', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('notifications.hoursAgo', { count: hours })
  return t('notifications.daysAgo', { count: Math.floor(hours / 24) })
}
```

- [ ] **Step 4: Write the failing bell test**

Create `app/src/components/shell/NotificationBell.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../convex', () => ({
  api: {
    notifications: {
      getUnreadCount: 'notifications.getUnreadCount',
      listMine: 'notifications.listMine',
      getLatest: 'notifications.getLatest',
      markAllRead: 'notifications.markAllRead'
    }
  }
}))

let mockQueryReturns: Record<string, unknown> = {}
vi.mock('convex/react', () => ({
  useQuery: (ref: string) => mockQueryReturns[ref],
  useMutation: () => vi.fn(async () => {})
}))
vi.mock('react-router-dom', () => ({ Link: ({ children }: { children: unknown }) => <span>{children}</span> }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => `${key}${opts ? JSON.stringify(opts) : ''}`
  })
}))
const { toastSpy } = vi.hoisted(() => ({ toastSpy: vi.fn() }))
vi.mock('@/components/ui/toast', () => ({ toast: (m: string) => toastSpy(m) }))

import NotificationBell from './NotificationBell'

beforeEach(() => {
  mockQueryReturns = {}
  toastSpy.mockClear()
})

describe('NotificationBell', () => {
  it('shows the unread badge and the popover rows', () => {
    mockQueryReturns['notifications.getUnreadCount'] = 3
    mockQueryReturns['notifications.listMine'] = {
      page: [
        {
          id: 'n1',
          kind: 'comment',
          excerpt: 'nice',
          createdAt: Date.now(),
          unread: true,
          actorName: 'Ana',
          postExcerpt: 'hello',
          postUrn: 'urn:1',
          removed: false
        }
      ],
      status: 'CanLoadMore',
      loadMore: vi.fn()
    }
    mockQueryReturns['notifications.getLatest'] = null
    render(<NotificationBell />)
    expect(screen.getByRole('button', { name: /notifications\.bellLabel.*3/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /notifications\.bellLabel.*3/ }))
    expect(screen.getByText('Ana')).toBeInTheDocument()
  })

  it('toasts only when a newer notification id appears after mount', () => {
    mockQueryReturns['notifications.getUnreadCount'] = 0
    mockQueryReturns['notifications.listMine'] = { page: [], status: 'CanLoadMore', loadMore: vi.fn() }
    mockQueryReturns['notifications.getLatest'] = { _id: 'n1', actorName: 'Ana', kind: 'comment' }
    const { rerender } = render(<NotificationBell />)
    expect(toastSpy).not.toHaveBeenCalled() // first sighting seeds the id, never toasts
    mockQueryReturns['notifications.getLatest'] = { _id: 'n2', actorName: 'Bruno', kind: 'reaction' }
    rerender(<NotificationBell />)
    expect(toastSpy).toHaveBeenCalledTimes(1)
    expect(toastSpy).toHaveBeenCalledWith('notifications.toastReaction{"name":"Bruno"}')
  })
})
```

- [ ] **Step 5: Run it to verify it fails**

Run: `pnpm --filter ./app test src/components/shell/NotificationBell.test.tsx`
Expected: FAIL: cannot resolve `./NotificationBell`.

- [ ] **Step 6: Write the bell**

Create `app/src/components/shell/NotificationBell.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bell } from 'lucide-react'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { api } from '../../convex'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { timeAgoDetailed } from '@/lib/relativeDay'
import NotificationRow from './NotificationRow'

const PREVIEW = 5

// R23 — bell, unread badge, preview popover and the new-notification toast. The toast dedups on the newest id via
// refs (seed on first sighting, toast only when a newer id appears), so a reload never repeats one. Browser
// notifications are Phase 2.
export default function NotificationBell() {
  const { t } = useTranslation()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const [open, setOpen] = useState(false)
  const unread = useQuery(api.notifications.getUnreadCount, sessionToken ? { sessionToken } : 'skip')
  const latest = useQuery(api.notifications.getLatest, sessionToken ? { sessionToken } : 'skip')
  const markAllRead = useMutation(api.notifications.markAllRead)
  const markRead = useMutation(api.notifications.markRead)
  const { results, status } = usePaginatedQuery(
    api.notifications.listMine,
    sessionToken ? { sessionToken } : 'skip',
    { initialNumItems: PREVIEW }
  )
  const seeded = useRef(false)
  const seenId = useRef<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!latest) return
    if (!seeded.current) {
      seeded.current = true
      seenId.current = latest._id
      return
    }
    if (seenId.current === latest._id) return
    seenId.current = latest._id
    toast(
      latest.kind === 'comment'
        ? t('notifications.toastComment', { name: latest.actorName })
        : t('notifications.toastReaction', { name: latest.actorName })
    )
  }, [latest, t])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const label =
    unread && unread > 0 ? t('notifications.bellLabel', { count: unread }) : t('notifications.bellLabelNone')

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={() => setOpen(value => !value)}
        className="relative inline-flex size-10 items-center justify-center rounded-full hover:bg-muted"
      >
        <Bell className="size-5" aria-hidden="true" />
        {unread !== undefined && unread > 0 && (
          <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 min-w-4 rounded-full px-1 text-[10px] leading-4 tabular-nums">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div id="notification-panel" className="bg-background absolute right-0 z-50 mt-2 w-80 rounded-lg border shadow-lg">
          <ul className="m-0 flex list-none flex-col p-1">
            {results.map(row => (
              <NotificationRow
                key={row.id}
                row={row}
                timeLabel={timeAgoDetailed(row.createdAt, t)}
                onOpen={id => {
                  if (sessionToken) void markRead({ sessionToken, ids: [id] })
                }}
              />
            ))}
            {results.length === 0 && status !== 'LoadingFirstPage' && (
              <li className="text-muted-foreground p-3 text-sm">{t('notifications.empty')}</li>
            )}
          </ul>
          <div className="flex items-center justify-between border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (sessionToken) void markAllRead({ sessionToken })
              }}
            >
              {t('notifications.markAllRead')}
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/notifications">{t('notifications.seeAll')}</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

Create `app/src/components/shell/NotificationRow.tsx` with the row markup shared by the bell and the page:

```tsx
import { useTranslation } from 'react-i18next'
import { buildPostUrl } from '@/components/LinkedInEmbed'
import { cn } from '@/lib/utils'

export interface NotificationRowData {
  id: string
  kind: 'reaction' | 'comment'
  excerpt?: string
  unread: boolean
  actorName: string
  actorPictureUrl?: string
  postExcerpt: string
  postUrn: string
  postSourceUrl?: string
  removed: boolean
}

export default function NotificationRow({
  row,
  timeLabel,
  onOpen
}: {
  row: NotificationRowData
  timeLabel: string
  /** Called when the member activates the row; pages use it to mark the notification read. */
  onOpen?: (id: string) => void
}) {
  const { t } = useTranslation()
  const open = () => onOpen?.(row.id)
  const body = (
    <>
      <span className={cn('block text-sm', row.unread ? 'text-foreground font-medium' : 'text-muted-foreground')}>
        {row.kind === 'comment'
          ? t('notifications.commented', { name: row.actorName })
          : t('notifications.reacted', { name: row.actorName })}
      </span>
      {row.excerpt && <span className="text-muted-foreground block truncate text-xs">{row.excerpt}</span>}
      <span className="text-muted-foreground block text-xs">{timeLabel}</span>
    </>
  )
  return (
    <li className={cn('rounded-md p-2', row.unread && 'bg-muted/60')}>
      {row.removed ? (
        <div onClick={open}>{body}</div>
      ) : (
        <a href={buildPostUrl(row.postUrn, row.postSourceUrl)} target="_blank" rel="noopener noreferrer" onClick={open}>
          {body}
        </a>
      )}
    </li>
  )
}
```

Import `NotFound`-free and lint-clean: no unused imports. `buildPostUrl` ignores the postId path (`/notifications`
rows carry `postUrn` and `sourceUrl` like History does).

- [ ] **Step 7: Add the bell to TopBar and the i18n keys**

`app/src/components/shell/TopBar.tsx`, before `<LanguageMenu />` (line 84): `<NotificationBell />` plus the import.
`TopBar.test.tsx` mocks `convex/react` with `useQuery` only (line 14), so the bell's `useMutation` and
`usePaginatedQuery` would be undefined and crash the suite. Extend that mock:

```ts
vi.mock('convex/react', () => ({
  useQuery: (ref: string) => mockQueryReturns[ref],
  useMutation: () => vi.fn(async () => {}),
  usePaginatedQuery: () => ({ results: [], status: 'Exhausted', loadMore: vi.fn() })
}))
```

Also extend `vi.mock('../../convex')` with the four notifications refs and seed
`mockQueryReturns['notifications.getUnreadCount'] = 0` / `['notifications.getLatest'] = null` in `beforeEach`
(lines 45-49). The bell renders no `<Link>` while closed, so the existing `getByRole('link')` assertions at lines 77
and 84 keep passing. Run `pnpm --filter ./app test src/components/shell/TopBar.test.tsx` and fix any fallout.

JSON additions (`notifications` namespace) in all three files:

`en.json`:

```json
  "notifications": {
    "title": "Notifications",
    "bellLabel_one": "Notifications, {{count}} unread",
    "bellLabel_other": "Notifications, {{count}} unread",
    "bellLabelNone": "Notifications",
    "markAllRead": "Mark all as read",
    "seeAll": "See all",
    "newSince": "New since your last visit",
    "empty": "Nothing here yet. When someone reacts to or comments on your posts, it shows up here.",
    "removed": "Post removed",
    "reacted": "{{name}} reacted to your post",
    "commented": "{{name}} commented on your post",
    "toastReaction": "{{name}} reacted to your post",
    "toastComment": "{{name}} commented on your post",
    "justNow": "just now",
    "minutesAgo_one": "{{count}} minute ago",
    "minutesAgo_other": "{{count}} minutes ago",
    "hoursAgo_one": "{{count}} hour ago",
    "hoursAgo_other": "{{count}} hours ago",
    "daysAgo_one": "{{count}} day ago",
    "daysAgo_other": "{{count}} days ago"
  },
```

`pt.json`:

```json
  "notifications": {
    "title": "Notificações",
    "bellLabel_one": "Notificações, {{count}} não lida",
    "bellLabel_other": "Notificações, {{count}} não lidas",
    "bellLabelNone": "Notificações",
    "markAllRead": "Marcar todas como lidas",
    "seeAll": "Ver todas",
    "newSince": "Novo desde sua última visita",
    "empty": "Nada por aqui ainda. Quando alguém reagir ou comentar nos seus posts, aparece aqui.",
    "removed": "Post removido",
    "reacted": "{{name}} reagiu ao seu post",
    "commented": "{{name}} comentou no seu post",
    "toastReaction": "{{name}} reagiu ao seu post",
    "toastComment": "{{name}} comentou no seu post",
    "justNow": "agora mesmo",
    "minutesAgo_one": "{{count}} minuto atrás",
    "minutesAgo_other": "{{count}} minutos atrás",
    "hoursAgo_one": "{{count}} hora atrás",
    "hoursAgo_other": "{{count}} horas atrás",
    "daysAgo_one": "{{count}} dia atrás",
    "daysAgo_other": "{{count}} dias atrás"
  },
```

`es.json`:

```json
  "notifications": {
    "title": "Notificaciones",
    "bellLabel_one": "Notificaciones, {{count}} sin leer",
    "bellLabel_other": "Notificaciones, {{count}} sin leer",
    "bellLabelNone": "Notificaciones",
    "markAllRead": "Marcar todas como leídas",
    "seeAll": "Ver todas",
    "newSince": "Nuevo desde tu última visita",
    "empty": "Nada por aquí todavía. Cuando alguien reaccione o comente en tus publicaciones, aparece aquí.",
    "removed": "Publicación eliminada",
    "reacted": "{{name}} reaccionó a tu publicación",
    "commented": "{{name}} comentó en tu publicación",
    "toastReaction": "{{name}} reaccionó a tu publicación",
    "toastComment": "{{name}} comentó en tu publicación",
    "justNow": "ahora mismo",
    "minutesAgo_one": "hace {{count}} minuto",
    "minutesAgo_other": "hace {{count}} minutos",
    "hoursAgo_one": "hace {{count}} hora",
    "hoursAgo_other": "hace {{count}} horas",
    "daysAgo_one": "hace {{count}} día",
    "daysAgo_other": "hace {{count}} días"
  },
```

- [ ] **Step 8: Run the tests**

Run: `pnpm --filter ./app test src/lib/relativeDay.test.ts src/components/shell/NotificationBell.test.tsx
src/components/shell/NotificationRow.test.tsx` (add a small row test asserting the unread class and the removed state)
and `pnpm --filter ./app test src/components/shell/TopBar.test.tsx`.
Expected: PASS.

- [ ] **Step 9: Format, typecheck, lint and stop**

Run: `pnpm exec prettier --write app/src/lib/relativeDay.ts app/src/lib/relativeDay.test.ts
app/src/components/shell/NotificationBell.tsx app/src/components/shell/NotificationBell.test.tsx
app/src/components/shell/NotificationRow.tsx app/src/components/shell/TopBar.tsx
app/src/components/shell/TopBar.test.tsx app/src/i18n/locales/en.json app/src/i18n/locales/pt.json
app/src/i18n/locales/es.json` then `pnpm typecheck` and `pnpm lint`. Report the result to Henriko. Do not commit.

---

### Task 13: `/notifications` page

**Files:**

- Create: `app/src/pages/NotificationsPage.tsx` (+ `.test.tsx`)
- Modify: `app/src/App.tsx` (route after `/rankings`)

**Interfaces:**

- Consumes: `api.notifications.listMine` with `usePaginatedQuery`; `NotificationRow`; `timeAgoDetailed`;
  `PageHeader`.
- Produces: route `/notifications`.

- [ ] **Step 1: Write the page**

`NotificationsPage` mirrors `HistoryPage`'s pagination shell (`app/src/pages/HistoryPage.tsx:101-165`):
`usePaginatedQuery(api.notifications.listMine, sessionToken ? { sessionToken } : 'skip', { initialNumItems: 20 })`,
first-page skeleton, empty state with a link to `/feed`, "Load more" while `status === 'CanLoadMore'`. Each row is a
`NotificationRow` with `timeAgoDetailed`, and its `onOpen` marks the clicked row read via
`markRead({ sessionToken, ids: [row.id] })` (the click that opens the post is also the read receipt; the bell does the
same).

The unread divider: render the `t('notifications.newSince')` heading as an `<li>` (a `<ul>` may only contain `li`
elements; a `<p>` child breaks list semantics for screen readers) above the first row with `row.unread === true`, and
the rows below it without the heading (the list is newest-first, so unread rows are a prefix until the member reads
one out of order; the heading disappears when no unread rows are in the loaded page). Add a `markAllRead` button in
the header (`PageHeader` children), disabled or skipped when there is no session token.

- [ ] **Step 2: Add the route**

`app/src/App.tsx` after `/rankings`: the same `RequireAuth` wrapper with `<NotificationsPage />`; add the import.

- [ ] **Step 3: Write the test and run it**

Create `app/src/pages/NotificationsPage.test.tsx` mocking `../convex` and `convex/react` following the
`RecapPage.test.tsx` pattern. Use a module-level `const markAllReadMock = vi.fn()` in a `vi.hoisted` block so the
mutation payload is assertable (a fresh `vi.fn()` per `useMutation()` call cannot be). Mock `usePaginatedQuery` too:

```tsx
vi.mock('convex/react', () => ({
  useQuery: () => undefined,
  useMutation: () => markAllReadMock,
  usePaginatedQuery: (ref: string) => mockPaginated[ref] ?? { results: [], status: 'Exhausted', loadMore: vi.fn() }
}))
```

Assert: the "new since" heading renders and precedes the first unread row in DOM order; the empty state renders when
`results` is empty; the removed badge renders for a `removed` row; clicking "Mark all as read" calls `markAllReadMock`
with `{ sessionToken: 'tok' }`.

Run: `pnpm --filter ./app test src/pages/NotificationsPage.test.tsx`
Expected: PASS.

- [ ] **Step 4: Format, typecheck, lint and stop**

Run: `pnpm exec prettier --write app/src/pages/NotificationsPage.tsx app/src/pages/NotificationsPage.test.tsx
app/src/App.tsx` then `pnpm typecheck` and `pnpm lint`. Report the result to Henriko. Do not commit.

---

### Task 14: Retention purge + DSR export and deletion cascade

**Files:**

- Modify: `convex/privacy/retention.ts` (add a step + `NOTIFICATION_RETENTION_DAYS = 180`)
- Modify: `convex/privacy/export.ts` (`ExportInput`, `EXPORT_TABLES`, bundle builder)
- Modify: `convex/privacy/deletion.ts` (`OWNED` array gets two notification entries)
- Modify: `convex/privacy/retention.test.ts`, `convex/privacy/export.test.ts`, `convex/privacy/deletion.test.ts`

**Interfaces:**

- Consumes: `notifications.by_created_at`, `by_recipient_and_created_at`, `by_actor`.
- Produces: export keys `notificationsReceived` and `notificationsActed`; deletion drains both sides.

- [ ] **Step 1: Extend the tests first**

In `convex/privacy/retention.test.ts`, add a case asserting a notification with `createdAt` older than
`RETENTION_DAYS_MS` (180 days) is deleted and a fresh one survives. In `convex/privacy/export.test.ts`, extend the
`ExportInput` fixture with `notificationsReceived: [row]` / `notificationsActed: [row]` and assert the bundle carries
both keys. In `convex/privacy/deletion.test.ts`, add a case with one notification where the member is recipient and
one where the member is actor, asserting both are gone after the cascade.

Run them to see them fail:
`pnpm --filter ./convex test privacy/retention.test.ts privacy/export.test.ts privacy/deletion.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implement retention**

In `convex/privacy/retention.ts`, add a step inside `enforceDataRetention` beside the audit-log purge (line 79):

```ts
    // R23 — notifications older than 180 days (in-app inbox only; the interaction log itself is kept).
    const oldNotifications = await ctx.db
      .query('notifications')
      .withIndex('by_created_at', q => q.lte('createdAt', now - NOTIFICATION_RETENTION_DAYS * 86_400_000))
      .take(RETENTION_BATCH)
    for (const row of oldNotifications) await ctx.db.delete(row._id)
```

and add `oldNotifications.length === RETENTION_BATCH ||` to the `moreToProcess` expression (line 130).

- [ ] **Step 3: Implement export**

In `convex/privacy/export.ts`:

- Add to `ExportInput`: `notificationsReceived?: AnyDoc[]`, `notificationsActed?: AnyDoc[]`.
- Add to `EXPORT_TABLES`:

```ts
  { key: 'notificationsReceived', table: 'notifications', index: 'by_recipient_and_created_at', field: 'recipientId' },
  { key: 'notificationsActed', table: 'notifications', index: 'by_actor', field: 'actorId' }
```

- Add both keys to `buildExportBundle`'s return object beside `interactions`.
- The action loop and `gatherUserTablePage` need no change (they iterate `EXPORT_TABLES` keyed by `key`).
- Also add both keys to the explicit object literal that feeds `buildExportBundle` in the export action (around
  `export.ts:188-200`); that `collected` object is built field by field even though the collection loop is generic.
- Extract the table lookup into an exported pure `exportTableConfig(key)` (`EXPORT_TABLES.find(t => t.key === key)`)
  and use it in `gatherUserTablePage`, then add a unit test asserting: every `EXPORT_TABLES` key is unique,
  `exportTableConfig('notificationsReceived')?.index === 'by_recipient_and_created_at'` and
  `exportTableConfig('notificationsActed')?.index === 'by_actor'`. Two notification entries share a table name, so the
  unique lookup key is the thing a silent regression would break.

- [ ] **Step 4: Implement the cascade**

In `convex/privacy/deletion.ts`, add to `OWNED` (line 35):

```ts
  { table: 'notifications', index: 'by_recipient_and_created_at', field: 'recipientId' },
  { table: 'notifications', index: 'by_actor', field: 'actorId' }
```

The existing drain loop handles duplicate tables with different indexes without change.

- [ ] **Step 5: Run the privacy suites and the full integration suite**

Run: `pnpm --filter ./convex test privacy/` then
`pnpm --filter ./convex exec vitest run --config vitest.integration.config.ts` (the privacy integration tests exercise
the real cascade).
Expected: PASS.

- [ ] **Step 6: Format, typecheck and stop**

Run: `pnpm exec prettier --write convex/privacy/retention.ts convex/privacy/export.ts convex/privacy/deletion.ts
convex/privacy/retention.test.ts convex/privacy/export.test.ts convex/privacy/deletion.test.ts` then
`pnpm typecheck`. Report the result to Henriko. Do not commit.

---

### Task 15: `docs/PLATFORM.md` for R23

**Files:**

- Modify: `docs/PLATFORM.md`

- [ ] **Step 1: Update the mapped sections**

1. **§5 Data Model.** Add `notifications` (with its four indexes) and the users table note for the digest fields
   that arrive in R24 (add them here now, they are already in the schema only after Task 16; if executing this task
   before Task 16, add only the notifications row and leave the digest fields for Task 22).
2. **§11 Feed & Engagement.** New subsection `### In-app notifications (R23)` covering the write path (same
   transaction as the counter), the read-time ban filter, the `readAt` semantics, the 100-row mark-all batch, the
   bell/toast and the localStorage seed, the 180-day retention, and the file rename (`notifications.ts` ->
   `billingNotices.ts`, why, and the call sites).
3. **§13 Crons.** Note the retention step now also purges notifications (no new cron).
4. **§14 Frontend.** Add `/notifications` to the Pages list; note the bell in the TopBar.
5. **§19 Roadmap.** R23 shipped; browser notifications deferred to Phase 2 (spec §1).

- [ ] **Step 2: Format check and stop**

Run: `pnpm exec prettier --check docs/PLATFORM.md`. Report the result to Henriko. Do not commit.

---

# Phase R24 - 3-day digest and email preferences

### Task 16: Digest preference fields + settings mutations

**Files:**

- Modify: `convex/schema.ts` (three fields on `users`)
- Modify: `convex/users.ts` (`getEmailPreferences`, `setDigestEmailsEnabled`)
- Create: `convex/integration/emailPreferences.test.ts`

**Interfaces:**

- Consumes: `requireAuth`, `writeAuditLog`.
- Produces: `users.digestEmailsEnabled`, `users.lastDigestAt`; `api.users.getEmailPreferences`,
  `api.users.setDigestEmailsEnabled({ sessionToken, enabled })`. Task 19 reads the fields; Task 21 renders the
  mutations.

- [ ] **Step 1: Add the schema fields**

In `convex/schema.ts`, in `users` after `leaderboardOptOut`:

```ts
    // R24 — 3-day activity digest (backlog/R24). Absent ⇒ enabled: the preference is an opt-out, the email carries
    // the unsubscribe link, and the first sign-in consent prompt explains it. lastDigestAt is stamped only after a
    // successful send, so a failed send retries on the next daily sweep.
    digestEmailsEnabled: v.optional(v.boolean()),
    lastDigestAt: v.optional(v.number()),
```

- [ ] **Step 2: Write the failing integration test**

Create `convex/integration/emailPreferences.test.ts` asserting: defaults read as enabled and visible; turning the
digest off and on is idempotent and audited (one `auditLogs` row per real change, action
`digest_preference_changed`); a bogus token is refused. Follow the `convex/integration/languageSync.test.ts` bootstrap
exactly.

Run: `pnpm --filter ./convex exec vitest run --config vitest.integration.config.ts integration/emailPreferences.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the queries/mutations**

Append to `convex/users.ts` after `setLeaderboardOptOut`:

```ts
/**
 * R24 — the Settings > Emails view. Absent means the default: digest on, appears in rankings.
 */
export const getEmailPreferences = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await requireAuth(ctx, sessionToken)
    return {
      digestEmailsEnabled: user.digestEmailsEnabled !== false,
      leaderboardOptOut: user.leaderboardOptOut === true
    }
  }
})

/** R24 — opt out (or back in) of the 3-day digest. Idempotent, audited. */
export const setDigestEmailsEnabled = mutation({
  args: { sessionToken: v.string(), enabled: v.boolean() },
  handler: async (ctx, { sessionToken, enabled }) => {
    const user = await requireAuth(ctx, sessionToken)
    if ((user.digestEmailsEnabled !== false) === enabled) return
    await ctx.db.patch(user._id, { digestEmailsEnabled: enabled })
    await writeAuditLog(ctx.db as unknown as AuditDb, {
      actor: 'user',
      actorId: user._id,
      action: 'digest_preference_changed',
      targetUserId: user._id,
      metadata: JSON.stringify({ enabled })
    })
  }
})
```

The guard `(user.digestEmailsEnabled !== false) === enabled` treats absent as enabled and returns early on a no-op
write.

- [ ] **Step 4: Run the test and the users suite**

Run: `pnpm --filter ./convex exec vitest run --config vitest.integration.config.ts integration/emailPreferences.test.ts`
and `pnpm --filter ./convex test users`.
Expected: PASS.

- [ ] **Step 5: Format, typecheck and stop**

Run: `pnpm exec prettier --write convex/schema.ts convex/users.ts convex/integration/emailPreferences.test.ts` then
`pnpm typecheck`. Report the result to Henriko. Do not commit.

---

### Task 17: `convex/lib/unsubscribeToken.ts` (HMAC over WebCrypto)

**Files:**

- Modify: `convex/lib/pkce.ts` (export `base64UrlEncode`)
- Create: `convex/lib/unsubscribeToken.ts`
- Create: `convex/lib/unsubscribeToken.test.ts`

**Interfaces:**

- Consumes: `crypto.subtle`, `TextEncoder` (WebCrypto, same runtime as `pkceChallengeFromVerifier`).
- Produces: `UNSUBSCRIBE_PURPOSE = 'digest'`; `signUnsubscribeToken(userId, secret): Promise<string>`;
  `verifyUnsubscribeToken(token, secret): Promise<string | null>`. Task 19 builds links; Task 20 verifies them.

- [ ] **Step 1: Export the encoder**

In `convex/lib/pkce.ts`, change `function base64UrlEncode` to `export function base64UrlEncode` with a comment
noting it is shared with the unsubscribe token.

- [ ] **Step 2: Write the failing unit test**

Create `convex/lib/unsubscribeToken.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { signUnsubscribeToken, verifyUnsubscribeToken } from './unsubscribeToken'

const SECRET = 'test-secret'

describe('unsubscribe tokens', () => {
  it('round-trips a user id', async () => {
    const token = await signUnsubscribeToken('user123', SECRET)
    expect(await verifyUnsubscribeToken(token, SECRET)).toBe('user123')
  })

  it('rejects a tampered token, a wrong secret and malformed input', async () => {
    const token = await signUnsubscribeToken('user123', SECRET)
    expect(await verifyUnsubscribeToken(`${token}x`, SECRET)).toBeNull()
    expect(await verifyUnsubscribeToken(token, 'other-secret')).toBeNull()
    expect(await verifyUnsubscribeToken('not-a-token', SECRET)).toBeNull()
    expect(await verifyUnsubscribeToken('', SECRET)).toBeNull()
  })

  it('is stable for the same input', async () => {
    expect(await signUnsubscribeToken('user123', SECRET)).toBe(await signUnsubscribeToken('user123', SECRET))
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter ./convex test lib/unsubscribeToken.test.ts`
Expected: FAIL: cannot resolve `./unsubscribeToken`.

- [ ] **Step 4: Write the implementation**

Create `convex/lib/unsubscribeToken.ts`:

```ts
// R24 — stateless unsubscribe tokens for the digest email. HMAC-SHA256 over `digest:<userId>`, base64url, compared
// in constant time. Stateless on purpose: an old email in an inbox must keep working, so there is nothing to
// expire or clean up. WebCrypto only, like pkce.ts, so this stays in the default Convex runtime.
import { base64UrlEncode } from './pkce'

export const UNSUBSCRIBE_PURPOSE = 'digest'
const TOKEN_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

async function hmacBase64Url(input: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input))
  return base64UrlEncode(new Uint8Array(signature))
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function signUnsubscribeToken(userId: string, secret: string): Promise<string> {
  const payload = base64UrlEncode(new TextEncoder().encode(userId))
  const signature = await hmacBase64Url(`${UNSUBSCRIBE_PURPOSE}:${userId}`, secret)
  return `${payload}.${signature}`
}

export async function verifyUnsubscribeToken(token: string, secret: string): Promise<string | null> {
  if (!token || !TOKEN_RE.test(token)) return null
  const [payload, signature] = token.split('.')
  let userId: string
  try {
    const bytes = Uint8Array.from(atob(payload.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
    userId = new TextDecoder().decode(bytes)
  } catch {
    return null
  }
  const expected = await hmacBase64Url(`${UNSUBSCRIBE_PURPOSE}:${userId}`, secret)
  return constantTimeEqual(signature, expected) ? userId : null
}
```

`atob` availability: `pkce.ts` avoids it and encodes manually; if `atob` throws "not defined" under the unit-test
node environment, replace the decode with a manual base64url decoder mirroring the encoder (a 10-line loop with the
same alphabet). Check by running the test; prefer the manual decoder if in doubt, since `crypto.subtle` works in both
runtimes but `atob` is not guaranteed in the Convex default runtime.

- [ ] **Step 5: Run the test**

Run: `pnpm --filter ./convex test lib/unsubscribeToken.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Format, typecheck and stop**

Run: `pnpm exec prettier --write convex/lib/pkce.ts convex/lib/unsubscribeToken.ts
convex/lib/unsubscribeToken.test.ts` then `pnpm typecheck`. Report the result to Henriko. Do not commit.

---

### Task 18: `convex/lib/digest.ts` (pure rules) + `convex/lib/digestEmails.ts`

**Files:**

- Create: `convex/lib/digest.ts` (+ `.test.ts`)
- Create: `convex/lib/digestEmails.ts` (+ `.test.ts`)

**Interfaces:**

- Consumes: `EmailContent` from `convex/lib/email.ts`; `renderEmailLayout`, `emailParagraph`, `emailButton`,
  `emailNote` from `convex/lib/emailLayout.ts`; `INTL_TAG`, `planName`? (not needed); `EmailLang` from
  `emailLayout.ts`; `digestWindow` from `lib/ranking.ts`.
- Produces: `isDigestDue(user, now)`, `DigestInput`, `digestEmail(locale, input)`. Task 19 calls both.

- [ ] **Step 1: Write the failing tests**

Create `convex/lib/digest.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DIGEST_SPAN_MS, isDigestDue } from './digest'

const NOW = Date.now()

describe('isDigestDue', () => {
  it('is due when never sent, when 3+ days old and when explicitly enabled', () => {
    expect(isDigestDue({ email: 'a@b.c' }, NOW)).toBe(true)
    expect(isDigestDue({ email: 'a@b.c', lastDigestAt: NOW - DIGEST_SPAN_MS }, NOW)).toBe(true)
    expect(isDigestDue({ email: 'a@b.c', lastDigestAt: NOW - DIGEST_SPAN_MS + 1 }, NOW)).toBe(false)
  })

  it('is never due for disabled, banned, deleting or email-less members', () => {
    expect(isDigestDue({ email: 'a@b.c', digestEmailsEnabled: false }, NOW)).toBe(false)
    expect(isDigestDue({ email: 'a@b.c', isBanned: true }, NOW)).toBe(false)
    expect(isDigestDue({ email: 'a@b.c', deletionScheduledAt: NOW }, NOW)).toBe(false)
    expect(isDigestDue({}, NOW)).toBe(false)
  })
})
```

Create `convex/lib/digestEmails.test.ts` with, per locale (`en`, `pt`, `es`): the subject carries the received
reaction count, the html contains the unsubscribe URL and the settings URL, the text version exists and is non-empty,
and none of the copy contains "!", "urgent", "hurry", "now!" (mirror the banned-phrase guard style of
`convex/lib/billingEmails.test.ts:137`). Build a fixture:

```ts
const input: DigestInput = {
  name: 'Ana',
  since: 1_700_000_000_000,
  receivedReactions: 3,
  receivedComments: 1,
  madeReactions: 5,
  madeComments: 2,
  topReceived: [{ name: 'Bruno', count: 4 }],
  topMade: [{ name: 'Carla', count: 6 }],
  siteTopPosters: [{ name: 'Diego', count: 9 }],
  siteTopInteractors: [{ name: 'Elis', count: 12 }],
  myPosition: 8,
  movement: 3,
  peopleUrl: 'https://app.example/people',
  rankingsUrl: 'https://app.example/rankings',
  unsubscribeUrl: 'https://site.convex.site/unsubscribe/digest?token=t',
  settingsUrl: 'https://app.example/settings',
  supportEmail: 'support@example.com',
  includePostalAddress: true
}
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter ./convex test lib/digest.test.ts lib/digestEmails.test.ts`
Expected: FAIL: modules missing.

- [ ] **Step 3: Implement `convex/lib/digest.ts`**

```ts
// R24 — pure digest eligibility. The daily sweep asks this per user; all I/O stays in jobs/digest.ts.
export const DIGEST_SPAN_MS = 3 * 86_400_000

export interface DigestCandidate {
  email?: string
  digestEmailsEnabled?: boolean
  isBanned?: boolean
  deletionScheduledAt?: number
  lastDigestAt?: number
}

export function isDigestDue(user: DigestCandidate, now: number): boolean {
  if (!user.email) return false
  if (user.digestEmailsEnabled === false) return false
  if (user.isBanned === true) return false
  if (user.deletionScheduledAt !== undefined) return false
  if (user.lastDigestAt !== undefined && user.lastDigestAt > now - DIGEST_SPAN_MS) return false
  return true
}
```

- [ ] **Step 4: Implement `convex/lib/digestEmails.ts`**

Three locale records plus one builder. The HTML body order is fixed by the spec §8: personal numbers, top received,
top made, site tops, position and movement, CTAs, footer with unsubscribe + settings + support and, when
`includePostalAddress` is true, a postal line. Use `renderEmailLayout({ lang, preheader, heading, contentHtml })`,
`emailParagraph`, `emailButton`, `emailNote`, and an `INTL_TAG` map copied from `lib/billingEmails.ts` (import it if
it is exported; `notifications.ts:20` imports `INTL_TAG` from there, so it is). Movement copy: positive ->
"up N positions", negative -> "down N positions", zero -> "same position". Never use the `!` character. Subject
examples: en "3 reactions and 1 comment on your posts", pt "3 reações e 1 comentário nos seus posts", es "3
reacciones y 1 comentario en tus publicaciones". Top lists render as `name · count` lines; when a list is empty,
omit the whole section rather than printing a zero. `myPosition === null` prints the no-position line. The site
section states its window explicitly ("last 7 days") because the site board is the 7d snapshot even though the
personal window is 3 days. The builder is pure and synchronous.

- [ ] **Step 5: Run all four files' tests**

Run: `pnpm --filter ./convex test lib/digest.test.ts lib/digestEmails.test.ts`
Expected: PASS.

- [ ] **Step 6: Format, typecheck and stop**

Run: `pnpm exec prettier --write convex/lib/digest.ts convex/lib/digest.test.ts convex/lib/digestEmails.ts
convex/lib/digestEmails.test.ts` then `pnpm typecheck`. Report the result to Henriko. Do not commit.

---

### Task 19: Email headers, env var, `convex/jobs/digest.ts`, cron

**Files:**

- Modify: `convex/lib/email.ts` (`headers`)
- Modify: `convex/convex.config.ts` (`UNSUBSCRIBE_SECRET` optional)
- Create: `convex/jobs/digest.ts`
- Modify: `convex/crons.ts` (digest entry)
- Create: `convex/integration/digest.test.ts`

**Interfaces:**

- Consumes: Task 16 fields, Task 17 token, Task 18 rules/builder, Task 5 snapshot table, `env.UNSUBSCRIBE_SECRET`,
  `env.APP_URL`, `sendEmail`.
- Produces: `internal.jobs.digest.sendDueDigests({ cursor? })`,
  `internal.jobs.digest.getDigestData({ userId, lastDigestAt, now })`,
  `internal.jobs.digest.markDigestSent({ userId })`. Task 20 calls the digest disable mutation that this task also
  adds: `internal.jobs.digest.disableDigestByUserId({ userId })`.

- [ ] **Step 1: Add custom headers to `sendEmail`**

In `convex/lib/email.ts`, extend `SendEmailArgs`:

```ts
  /** Custom provider headers, e.g. List-Unsubscribe. Passed through to Resend verbatim. */
  headers?: Record<string, string>
```

and the JSON body:

```ts
      ...(args.headers ? { headers: args.headers } : {}),
```

- [ ] **Step 2: Declare the env var**

In `convex/convex.config.ts`, add to the optional block:
`UNSUBSCRIBE_SECRET: v.optional(v.string()),`

- [ ] **Step 3: Write the failing integration test**

Create `convex/integration/digest.test.ts` asserting: `getDigestData` returns the personal counts and site tops from
a seeded snapshot with movement; `disableDigestByUserId` sets `digestEmailsEnabled: false` and audits;
`getUsersPage` paginates all members (the eligibility rule itself is unit-tested in `lib/digest.test.ts`).
The sweep action early-returns when `UNSUBSCRIBE_SECRET` is unset, which is the test environment: calling
`t.action(internal.jobs.digest.sendDueDigests, {})` must resolve without error and leave every `lastDigestAt`
undefined. Add one more case that pins stamp-on-sent: set `process.env.UNSUBSCRIBE_SECRET = 'test-secret'` for that
test, seed a due member with in-window activity, run the sweep, and assert it resolves and `lastDigestAt` stays
undefined (the unconfigured provider makes `sendEmail` return `{ sent: false, skipped: true }`); restore the variable
afterwards. The real send path with the provider configured is verified manually in Task 22.

`t.action` is supported by convex-test even though this repo has no precedent yet; if the installed version rejects
it, fall back to the unit coverage in `lib/digest.test.ts` plus the `getUsersPage` / `disableDigestByUserId`
integration tests, and verify the real send path manually in Task 22.

Run: `pnpm --filter ./convex exec vitest run --config vitest.integration.config.ts integration/digest.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement the job**

Create `convex/jobs/digest.ts`:

```ts
// R24 — daily digest sweep. A daily pass over `users` filtered by lib/digest.isDigestDue, batches of 50 sends per
// invocation with self-rescheduling (jobs/syncPostsApify.ts pattern). The 3-day cadence (not Stripe-style per-user
// scheduling) keeps the job idempotent and easy to debug. `lastDigestAt` is stamped only after a send that did not
// throw; when the email provider is unconfigured the sweep sends nothing and stamps nothing.
import { internalAction, internalMutation, internalQuery } from '../_generated/server'
import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import { env } from '../_generated/server'
import type { ActionCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import { internal } from '../_generated/api'
import { sendEmail } from '../lib/email'
import { digestEmail, type DigestInput } from '../lib/digestEmails'
import { isDigestDue } from '../lib/digest'
import { digestWindow, movement, pickPreviousGeneration, positionOf } from '../lib/ranking'
import { signUnsubscribeToken } from '../lib/unsubscribeToken'
import { resolveBillingLocale } from '../lib/checkoutCopy'
import { writeAuditLog, type AuditDb } from '../lib/audit'
import { SUPPORT_EMAIL } from '../lib/support'
import { tallyMadeByPerson, tallyReceivedByPerson, type InteractionRow } from '../lib/interactionGraph'

const PAGE_SIZE = 50
const DIGEST_WINDOW: '7d' = '7d' // site board window used in the email; the personal numbers use the 3-day window

export const getUsersPage = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => ctx.db.query('users').paginate(paginationOpts)
})

export const disableDigestByUserId = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId)
    if (!user || user.digestEmailsEnabled === false) return
    await ctx.db.patch(userId, { digestEmailsEnabled: false })
    await writeAuditLog(ctx.db as unknown as AuditDb, {
      actor: 'user',
      actorId: userId,
      action: 'digest_unsubscribed_email',
      targetUserId: userId
    })
  }
})

export const markDigestSent = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    await ctx.db.patch(userId, { lastDigestAt: Date.now() })
  }
})

export const getDigestData = internalQuery({
  args: { userId: v.id('users'), lastDigestAt: v.optional(v.number()), now: v.number() },
  handler: async (ctx, { userId, lastDigestAt, now }) => {
    const { since } = digestWindow(now, lastDigestAt)
    const rows = await ctx.db
      .query('userInteractions')
      .withIndex('by_user', q => q.eq('userId', userId).gte('_creationTime', since))
      .order('desc')
      .take(2000)
    const receivedRows = await ctx.db
      .query('userInteractions')
      .withIndex('by_author', q => q.eq('authorId', userId).gte('_creationTime', since))
      .order('desc')
      .take(2000)
    const toRows = (list: Doc<'userInteractions'>[]): InteractionRow[] =>
      list.map(r => ({
        _creationTime: r._creationTime,
        userId: r.userId as string,
        authorId: r.authorId as string | undefined,
        postId: r.postId as string,
        kind: r.kind
      }))
    const made = tallyMadeByPerson(toRows(rows), since)
    const received = tallyReceivedByPerson(toRows(receivedRows), since)
    const generations = await ctx.db
      .query('rankingSnapshots')
      .withIndex('by_window_and_generated_at', q => q.eq('window', DIGEST_WINDOW))
      .order('desc')
      .take(4)
    const latest = generations[0]
    const previous = latest && lastDigestAt !== undefined ? pickPreviousGeneration(generations.slice(1), lastDigestAt) : null
    // The board stores identities only for the top 100; the digest reads the member's own board-window count live,
    // the same way getSiteRankings does, so a member outside the top 100 still gets an exact position.
    let countNow = 0
    if (latest) {
      const boardRows = await ctx.db
        .query('userInteractions')
        .withIndex('by_user', q => q.eq('userId', userId).gte('_creationTime', latest.since))
        .order('desc')
        .take(2000)
      countNow = boardRows.filter(
        r => r.kind !== 'ai_draft' && (r.authorId === undefined || r.authorId !== userId)
      ).length
    }
    const findCount = (list: NonNullable<typeof latest>['topInteractors']) =>
      list.find(e => e.userId === userId)?.count ?? 0
    const prevCount = previous ? findCount(previous.topInteractors) : 0
    const currentPosition = latest && countNow > 0 ? positionOf(countNow, latest.interactorCountsDescending) : null
    const prevPosition = previous && prevCount > 0 ? positionOf(prevCount, previous.interactorCountsDescending) : null
    return {
      since,
      made: { reactions: made.reduce((s, t) => s + t.reactions, 0), comments: made.reduce((s, t) => s + t.comments, 0) },
      received: {
        reactions: received.reduce((s, t) => s + t.reactions, 0),
        comments: received.reduce((s, t) => s + t.comments, 0)
      },
      topReceived: received.slice(0, 3).map(t => ({ userId: t.userId as Id<'users'>, count: t.total })),
      topMade: made.slice(0, 3).map(t => ({ userId: t.userId as Id<'users'>, count: t.total })),
      siteTopPosters: latest ? latest.topPosters.slice(0, 3).map(e => ({ userId: e.userId, count: e.count })) : [],
      siteTopInteractors: latest ? latest.topInteractors.slice(0, 3).map(e => ({ userId: e.userId, count: e.count })) : [],
      myPosition: currentPosition,
      movement: movement(prevPosition, currentPosition)
    }
  }
})

/** Resolve the display names for a digest in one small mutation-free pass. */
export const getDisplayNames = internalQuery({
  args: { userIds: v.array(v.id('users')) },
  handler: async (ctx, { userIds }) => {
    const users = await Promise.all(userIds.map(id => ctx.db.get(id)))
    return users.flatMap(u => (u ? [{ id: u._id as string, name: u.name }] : []))
  }
})

export const sendDueDigests = internalAction({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }) => {
    const secret = env.UNSUBSCRIBE_SECRET
    const appUrl = env.APP_URL ?? 'http://localhost:5173'
    // The one-click unsubscribe endpoint is a Convex HTTP action: it lives on the .convex.site origin, not APP_URL.
    const siteUrl = env.CONVEX_SITE_URL
    if (!secret) {
      console.error('[digest] UNSUBSCRIBE_SECRET unset — sweep skipped rather than sending without opt-out')
      return
    }
    const now = Date.now()
    const page = await ctx.runQuery(internal.jobs.digest.getUsersPage, {
      paginationOpts: { numItems: PAGE_SIZE, cursor: cursor ?? null }
    })
    const due = page.page.filter(user => isDigestDue(user, now))
    for (const user of due) {
      await settleDigest(ctx, user, { now, secret, appUrl, siteUrl })
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.jobs.digest.sendDueDigests, { cursor: page.continueCursor })
    }
  }
})

async function settleDigest(
  ctx: ActionCtx,
  user: Doc<'users'>,
  ctxArgs: { now: number; secret: string; appUrl: string; siteUrl: string }
): Promise<void> {
  const data = await ctx.runQuery(internal.jobs.digest.getDigestData, {
    userId: user._id,
    lastDigestAt: user.lastDigestAt,
    now: ctxArgs.now
  })
  const total = data.made.reactions + data.made.comments + data.received.reactions + data.received.comments
  if (total === 0) return // empty digest is spam; skip until there is something to report
  const names = await ctx.runQuery(internal.jobs.digest.getDisplayNames, {
    userIds: [
      ...data.topReceived.map(e => e.userId),
      ...data.topMade.map(e => e.userId),
      ...data.siteTopPosters.map(e => e.userId),
      ...data.siteTopInteractors.map(e => e.userId)
    ]
  })
  const nameOf = (id: string) => names.find(n => n.id === id)?.name ?? ''
  const token = await signUnsubscribeToken(user._id as string, ctxArgs.secret)
  const input: DigestInput = {
    name: user.name,
    since: data.since,
    receivedReactions: data.received.reactions,
    receivedComments: data.received.comments,
    madeReactions: data.made.reactions,
    madeComments: data.made.comments,
    topReceived: data.topReceived.map(e => ({ name: nameOf(e.userId), count: e.count })),
    topMade: data.topMade.map(e => ({ name: nameOf(e.userId), count: e.count })),
    siteTopPosters: data.siteTopPosters.map(e => ({ name: nameOf(e.userId), count: e.count })),
    siteTopInteractors: data.siteTopInteractors.map(e => ({ name: nameOf(e.userId), count: e.count })),
    myPosition: data.myPosition,
    movement: data.movement,
    peopleUrl: `${ctxArgs.appUrl}/people`,
    rankingsUrl: `${ctxArgs.appUrl}/rankings`,
    unsubscribeUrl: `${ctxArgs.siteUrl.replace(/\/$/, '')}/unsubscribe/digest?token=${token}`,
    settingsUrl: `${ctxArgs.appUrl}/settings`,
    supportEmail: SUPPORT_EMAIL,
    includePostalAddress: true
  }
  const message = digestEmail(resolveBillingLocale(user.language, user.primaryLocale), input)
  const result = await sendEmail({
    to: user.email!,
    subject: message.subject,
    html: message.html,
    text: message.text,
    headers: {
      'List-Unsubscribe': `<${input.unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    }
  })
  if (result.sent) await ctx.runMutation(internal.jobs.digest.markDigestSent, { userId: user._id })
}
```

- [ ] **Step 5: Add the cron**

In `convex/crons.ts` after the ranking snapshot entries:

```ts
// ─── 3-day activity digest (R24) ─────────────────────────────────────────────
// Daily sweep at 10:00 UTC; lib/digest.isDigestDue gates each member on the 3-day cadence, so the cron stays a
// simple daily pass. Batches of 50 sends per invocation with self-rescheduling.
crons.cron('send activity digests', '0 10 * * *', internal.jobs.digest.sendDueDigests, {})
```

- [ ] **Step 6: Run the test and typecheck**

Run: `pnpm --filter ./convex exec vitest run --config vitest.integration.config.ts integration/digest.test.ts` then
`pnpm exec prettier --write convex/lib/email.ts convex/convex.config.ts convex/jobs/digest.ts convex/crons.ts
convex/integration/digest.test.ts` then `pnpm typecheck`.
Expected: PASS and clean. Report the result to Henriko. Do not commit.

---

### Task 20: Unsubscribe HTTP endpoints in `convex/http.ts`

**Files:**

- Modify: `convex/http.ts` (imports; routes after the OAuth callback route at line 190)

**Interfaces:**

- Consumes: `verifyUnsubscribeToken`, `env.UNSUBSCRIBE_SECRET`, `internal.jobs.digest.disableDigestByUserId`,
  the existing `redirect(location, extraHeaders?)` helper and `NO_STORE` headers in `http.ts` (line 38).
- Produces: `GET /unsubscribe/digest?token=...` and `POST /unsubscribe/digest` (RFC 8058 one-click).

- [ ] **Step 1: Add the routes**

In `convex/http.ts`, after the OAuth callback route, add:

```ts
// R24 — one-click unsubscribe for the 3-day digest. Stateless signed token, works without a session, idempotent.
// POST is the RFC 8058 List-Unsubscribe-Post path; GET is the human click. Both redirect to /unsubscribed.
http.route({
  path: '/unsubscribe/digest',
  method: 'GET',
  handler: httpAction(async (ctx, req) => {
    const token = new URL(req.url).searchParams.get('token') ?? ''
    return handleUnsubscribe(ctx, token)
  })
})

http.route({
  path: '/unsubscribe/digest',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const token = new URL(req.url).searchParams.get('token') ?? ''
    return handleUnsubscribe(ctx, token)
  })
})

async function handleUnsubscribe(ctx: ActionCtx, token: string): Promise<Response> {
  const appUrl = env.APP_URL ?? 'http://localhost:5173'
  const secret = env.UNSUBSCRIBE_SECRET
  if (!secret) return redirect(`${appUrl}/unsubscribed?status=unavailable`)
  const userId = await verifyUnsubscribeToken(token, secret)
  if (!userId) return redirect(`${appUrl}/unsubscribed?status=invalid`)
  await ctx.runMutation(internal.jobs.digest.disableDigestByUserId, { userId: userId as Id<'users'> })
  return redirect(`${appUrl}/unsubscribed?status=ok`)
}
```

Imports to add: `verifyUnsubscribeToken` from `./lib/unsubscribeToken`, `Id` type from `./_generated/dataModel`,
`ActionCtx` from `./_generated/server` if not already imported. `redirect` and `env` already exist in the file.

- [ ] **Step 2: Run typecheck and the existing http-adjacent suites**

Run: `pnpm --filter ./convex test sessions` (OAuth state suites exercise http helpers) then `pnpm typecheck`.
Expected: PASS. Report the result to Henriko. Do not commit.

---

### Task 21: Settings Emails section + `/unsubscribed` page + i18n

**Files:**

- Create: `app/src/components/EmailPreferences.tsx` (+ `.test.tsx`)
- Modify: `app/src/pages/SettingsPage.tsx` (insert the section after the AI comments section, line 479)
- Create: `app/src/pages/UnsubscribedPage.tsx` (+ `.test.tsx`)
- Modify: `app/src/App.tsx` (public route `/unsubscribed` before the catch-all)
- Modify: `app/src/i18n/locales/{en,pt,es}.json` (`settings.emails.*`, `unsubscribed.*`)

**Interfaces:**

- Consumes: `api.users.getEmailPreferences`, `api.users.setDigestEmailsEnabled`, `api.users.setLeaderboardOptOut`;
  the `ConsentToggles` checkbox markup pattern (`ConsentToggles.tsx:23-37`).
- Produces: routes `/settings` (section) and `/unsubscribed`.

- [ ] **Step 1: Write the failing component test**

Create `app/src/components/EmailPreferences.test.tsx` mirroring `ConsentToggles.test.tsx`'s mock style: mock
`../convex`, mock `convex/react` with `useQuery` returning `{ digestEmailsEnabled: true, leaderboardOptOut: false }`
and a `useMutation` spy; assert both checkboxes render checked, that clicking the digest checkbox calls
`setDigestEmailsEnabled` with `{ enabled: false }`, and that the consents link points to `/privacy-data`.

Run: `pnpm --filter ./app test src/components/EmailPreferences.test.tsx`
Expected: FAIL: cannot resolve `./EmailPreferences`.

- [ ] **Step 2: Write the component**

Create `app/src/components/EmailPreferences.tsx` with: the two checkbox rows (digest, rankings) using the exact
`ConsentToggles` label+input markup, an immediate `useMutation` save per toggle, a saving/disabled state while the
mutation is in flight, the section heading and note from `settings.emails.*`, and a `<Link to="/privacy-data">` for
the consent link. On mutation failure, render an inline error line rather than a toast (the consent section does not
toast).

- [ ] **Step 3: Insert into Settings and write the page**

`SettingsPage.tsx`: import `EmailPreferences` and render `<section className="mt-6">...<EmailPreferences /></section>`
after the AI comments section (line 479), before the visibility block (line 481).

Create `app/src/pages/UnsubscribedPage.tsx`: reads `new URLSearchParams(window.location.search).get('status')` with
`useState(() => ...)` (not in render directly), renders one of four states (`ok`, `invalid`, `unavailable`, or
missing), a support link from `app/src/lib/support.ts`, and a "Start receiving again" `<Link to="/settings">`. No
session needed, so register the route WITHOUT `RequireAuth`:

```tsx
          <Route path="/unsubscribed" element={<UnsubscribedPage />} />
```

- [ ] **Step 4: Add i18n**

`en.json` under `settings`:

```json
    "emails": {
      "title": "Emails",
      "note": "Choose what Link Into The SSI sends you.",
      "digest": "3-day activity digest",
      "digestNote": "A summary of your interactions and the site highlights every 3 days.",
      "rankings": "Appear in rankings",
      "rankingsNote": "Let other members see you on the site-wide ranking board.",
      "consentsLink": "Manage communication consents"
    },
```

`pt.json`:

```json
    "emails": {
      "title": "Emails",
      "note": "Escolha o que o Link Into The SSI envia para você.",
      "digest": "Resumo de atividade a cada 3 dias",
      "digestNote": "Um resumo das suas interações e dos destaques do site a cada 3 dias.",
      "rankings": "Aparecer no ranking",
      "rankingsNote": "Permitir que outros membros vejam você no ranking do site.",
      "consentsLink": "Gerenciar consentimentos de comunicação"
    },
```

`es.json`:

```json
    "emails": {
      "title": "Correos",
      "note": "Elige qué te envía Link Into The SSI.",
      "digest": "Resumen de actividad cada 3 días",
      "digestNote": "Un resumen de tus interacciones y los destacados del sitio cada 3 días.",
      "rankings": "Aparecer en el ranking",
      "rankingsNote": "Permitir que otros miembros te vean en el ranking del sitio.",
      "consentsLink": "Gestionar consentimientos de comunicación"
    },
```

`unsubscribed` namespace (all three files):

en:
`{ "title": "Unsubscribed", "ok": "You will no longer receive the activity digest.", "invalid": "This unsubscribe link is not valid.", "unavailable": "Unsubscribe is temporarily unavailable. Please try again later.", "reEnable": "Start receiving again", "privacyLink": "Email preferences" }`
pt:
`{ "title": "Descadastrado", "ok": "Você não receberá mais o resumo de atividade.", "invalid": "Este link de descadastro não é válido.", "unavailable": "O descadastro está indisponível no momento. Tente de novo mais tarde.", "reEnable": "Voltar a receber", "privacyLink": "Preferências de email" }`
es:
`{ "title": "Dado de baja", "ok": "Ya no recibirás el resumen de actividad.", "invalid": "Este enlace de baja no es válido.", "unavailable": "La baja no está disponible por ahora. Inténtalo más tarde.", "reEnable": "Volver a recibir", "privacyLink": "Preferencias de correo" }`

- [ ] **Step 5: Run tests, typecheck, lint**

Run: `pnpm --filter ./app test src/components/EmailPreferences.test.tsx src/pages/UnsubscribedPage.test.tsx
src/pages/SettingsPage.test.tsx` then `pnpm typecheck` and `pnpm lint`.
Expected: PASS. Then `pnpm exec prettier --write` on the touched files. Report the result to Henriko. Do not commit.

---

### Task 22: Compliance docs and landing copy for R24

**Files:**

- Modify: `landing/app/[lang]/privacy/content/{en,pt,es}.tsx` (activity digest purpose + ranking display + opt-out)
- Modify: `app/src/components/ConsentPromptScreen.tsx` (one line pointing to Settings > Emails)
- Modify: `docs/compliance/DATA-INVENTORY.md`, `docs/compliance/RETENTION-POLICY.md`,
  `docs/compliance/GAP-ASSESSMENT.md`
- Modify: `docs/PLATFORM.md` (§5 digest fields, §8 digest email subsection, §13 digest cron, §16 `UNSUBSCRIBE_SECRET`,
  §17 compliance, §19 roadmap)
- Modify: `docs/superpowers/specs/2026-09-14-interaction-graph-notifications-digest-design.md` (mark status
  "implemented"; update §11 open items with Henriko's decisions)

**Interfaces:** none; documentation and copy only.

- [ ] **Step 1: Landing privacy content**

Read the existing internal-link/content patterns in those files first. Add, in each locale and matching the file's
JSX sentence style: one sentence naming the 3-day activity digest, its legitimate-interest basis and the right to
object from the email or Settings; one sentence naming the member ranking display and the opt-out. Do not remove or
weaken existing prose.

- [ ] **Step 2: Consent prompt line**

In `ConsentPromptScreen.tsx`, under the existing note paragraph (line 66), add one sentence rendered from a new i18n
key `privacy.consentPrompt.digestNote` (three locales: "The activity digest is on by default and can be turned off
in Settings > Emails." / pt / es). Update the three locale files.

- [ ] **Step 3: Compliance docs**

- `DATA-INVENTORY.md`: add notifications rows (recipient, actor, post, comment excerpt) and the digest preferences
  (`digestEmailsEnabled`, `lastDigestAt`, `leaderboardOptOut`), with purpose and lawful basis.
- `RETENTION-POLICY.md`: 180-day notification purge, digest send-log field kept while the account lives, ranking
  snapshots containing user IDs for 4 generations (max ~4 days).
- `GAP-ASSESSMENT.md`: close or note the new processing activities and the CAN-SPAM postal-address decision once
  Henriko answers spec §11 item 1.

- [ ] **Step 4: PLATFORM.md**

Section 22 is the final doc sweep: add the new tables and fields, the digest email subsection (eligibility, content
order, skip-on-empty, headers, unsubscribe flow), the 10:00 UTC cron, the `/unsubscribed` route and public endpoint,
`UNSUBSCRIBE_SECRET` in §16 (with the "unset means no digest is sent" rule), and §17 compliance notes. Follow the
file's existing structure and the "Maintaining This Document" mapping.

- [ ] **Step 5: Full verification**

Run `pnpm verify` (format check, lint, typecheck, all unit tests, convex integration tests). Then run the app
(`pnpm dev:app`) and walk the changed screens at desktop and a phone width: `/people` (three tabs, accordion,
keyboard), `/rankings` (window toggle, rank rows, opt-out, movement copy), the bell and toast, `/notifications`
(divider, mark all, empty state), Settings > Emails, and `/unsubscribed` for `status=ok` and `status=invalid`.
Report findings to Henriko. Do not commit.

---

## Self-Review

**Spec coverage:**

- §4.1 notifications table -> Task 10 (plus `by_created_at`, added for the retention purge; the spec's index list
  gains one index, consistent with §9's retention rule).
- §4.2 users prefs -> Tasks 3 (`leaderboardOptOut`) and 16 (digest fields).
- §4.3 rankingSnapshots -> Task 3.
- §4.4 no `userInteractions` change -> Tasks 3, 4, 10 (no schema change to that table).
- §5.1 interactionGraph -> Task 1. §5.2 ranking -> Task 2. §5.3 reads -> Tasks 4, 5, 11, 16. §5.4 mutations -> Tasks
  5, 11, 16. §5.5 write path -> Task 10. §5.6 snapshot -> Task 3. §5.7 digest -> Task 19. §5.8 email plumbing ->
  Tasks 17, 19, 20. §5.9 rename -> Task 9.
- §6 ceiling and future path -> Tasks 1, 4, 5 (`RECAP_ROW_CEILING`, `truncated`) and the spec §6 text stays as the
  documented upgrade path.
- §7.1 bell -> Task 12. §7.2 toast -> Task 12. §7.3 /notifications -> Task 13. §7.4 /people -> Task 6. §7.5 /rankings
  -> Task 7. §7.6 Settings -> Task 21. §7.7 /unsubscribed -> Task 21. §7.8 nav -> Tasks 6, 7. §7.9 i18n/a11y ->
  Tasks 6, 7, 12, 13, 21.
- §8 digest content -> Tasks 18, 19. §9 compliance -> Tasks 14, 16, 20, 22.
- §10 phases/tests -> the phase structure itself; §11 open items -> Task 22 step 3 and the final report.
- §12 traceability -> covered by the file map and tasks above.

**Placeholder scan:** Tasks 6 and 7 describe page internals in numbered prose instead of full code for the list
bodies and state wiring; the components they reuse (`PeopleAccordion`, `RankingList`, `PersonRow`) are fully coded,
and every state to render is named with its key. That is the deliberate level of detail for UI glue whose exact JSX
depends on the file being edited; no "TBD" or "similar to Task N" appears anywhere. Every backend function, schema
change, test and doc update has concrete code or exact edits.

**Type consistency:** `InteractionRow` fields (`_creationTime`, `userId`, `authorId`, `postId`, `kind`) are used
identically in Tasks 1, 3, 4, 5, 19. `CounterpartyTally` (`userId`, `reactions`, `comments`, `total`, `lastAt`) is
produced in Task 1 and consumed in Tasks 4, 5, 19. Snapshot field names (`topPosters`, `topInteractors`,
`posterCountsDescending`, `interactorCountsDescending`, `partial`) match between Task 3 and Tasks 5, 19.
`DigestInput` field names match between Task 18 (test fixture and builder) and Task 19 (`settleDigest`).
`movement` semantics (previous minus current, positive = climbed) are consistent across Tasks 2, 5, 19. Notification
row fields (`id`, `unread`, `removed`, `actorName`, `postUrn`, `postSourceUrl`) match between Tasks 11, 12 and 13.
