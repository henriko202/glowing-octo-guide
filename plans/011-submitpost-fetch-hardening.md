# Plan 011: Harden `submitPost` fetch pipeline (auth first, validated redirects)

> **Executor instructions**: Follow step by step and run every verification. Honor STOP conditions.
> When done, update this plan's row in `plans/README.md`.
> **Repo rule (`CLAUDE.md`/`AGENTS.md`): NEVER commit or push.** Keep `docs/PLATFORM.md` in sync (Step 4).
>
> **Drift check (run first)**:
>
`git status --porcelain -- convex/posts.ts convex/linkedin/parsePostUrl.ts convex/linkedin/parsePostUrl.test.ts docs/PLATFORM.md`
> Compare the excerpts below to the live files. On a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S-M
- **Risk**: MED. `submitPost` is the manual post-ingestion path; a wrong redirect loop can break
  valid LinkedIn post submissions. The auth reorder only changes which error an anonymous caller sees.
- **Depends on**: none
- **Category**: security
- **Planned at**: working tree at commit `ced69ac`, 2026-09-10

## Why this matters

Two issues in the same code path:

1. **Unauthenticated outbound fetches.** `posts.submitPost` calls `resolveLinkedInShortlink(postUrl)`
   before it resolves the session (`convex/posts.ts:241-248`). An anonymous caller can make the
   backend issue up to five outbound HTTPS requests per invocation, and because the 10/hour rate limit
   is keyed on the member (`convex/posts.ts:268-274`), the limiter never applies to anonymous traffic.
2. **Auto-followed redirects.** The post-page fetch (`convex/posts.ts:300`) and the article fetch (`:414`) call
   `fetchWithTimeout` with the default `redirect: 'follow'`. The URL passed the
   linkedin.com host allowlist, but any 3xx response from LinkedIn is followed without re-validating
   the target. `docs/PLATFORM.md:5530-5534` claims the redirect target "is never fetched until it is
   proven to be a linkedin.com URL"; that guarantee currently holds only for the shortener hops, not
   for these two fetches. The same manual, per-hop validation the shortener already uses
   (`convex/linkedin/parsePostUrl.ts:42-62`) must be applied here.

## Current state

`convex/posts.ts:237-320` (order and fetches, abridged):

```ts
handler: async (ctx, { sessionToken, postUrl }): Promise<{ postId: string }> => {
  // 1. Resolve any lnkd.in shortlink ... (up to 5 outbound requests)
  const resolvedUrl = await resolveLinkedInShortlink(postUrl)
  const parsed = resolvedUrl ? parseLinkedInPostUrl(resolvedUrl) : null
  if (!resolvedUrl || !parsed) {
    throw new ConvexError('Unrecognized LinkedIn post URL. Use a /posts/… or /feed/update/… URL.')
  }

  // 2. Resolve authenticated user from session token
  const user = (await requireAuthAction(ctx, sessionToken)) as Doc<'users'>
  if (!user?.linkedinAccessToken) {
    throw new ConvexError('No LinkedIn access token. Please sign in again.')
  }
  // ... adminShareOverride, then the rate-limit + weekly-limit block (lines 261-293)
  // ... ownership (346-366), content/engagement parsing ...
  const rawLinkedinResponse = await fetchWithTimeout(resolvedUrl)          // line 300
  // ...
  const articleResponse = await fetchWithTimeout(articleUrl)               // line 414
```

`convex/linkedin/parsePostUrl.ts:42-62` is the proven manual-redirect pattern:

```ts
export async function resolveLinkedInShortlink(url: string): Promise<string | null> {
  let current = url
  for (let hop = 0; hop < 5; hop++) {
    // ... parse, require https, require allowlisted host
    const res = await fetchWithTimeout(current, { redirect: 'manual' }, 10_000)
    const location = res.headers.get('location')
    if (!location) return null
    current = new URL(location, current).toString()
  }
  return null
}
```

`isAllowedLinkedInUrl` (`parsePostUrl.ts:70-78`) already validates `https:` plus the
same `ALLOWED_LINKEDIN_HOST` used by `parseLinkedInPostUrl`. `fetchWithTimeout`
(`convex/lib/fetchWithTimeout.ts:12-29`) spreads its `init` through, so `redirect: 'manual'` works.

Tests for this module live in `convex/linkedin/parsePostUrl.test.ts` and stub `globalThis.fetch` with
`vi.stubGlobal` (see lines 77-135).

## Commands you will need

| Purpose      | Command                     | Expected |
|--------------|-----------------------------|----------|
| Convex tests | `pnpm --filter convex test` | all pass |
| Typecheck    | `pnpm typecheck`            | exit 0   |
| Lint         | `pnpm lint`                 | exit 0   |
| Full gate    | `pnpm verify`               | exit 0   |

## Scope

**In scope**: `convex/linkedin/parsePostUrl.ts`, `convex/linkedin/parsePostUrl.test.ts`,
`convex/posts.ts` (only the `submitPost` handler), `docs/PLATFORM.md` (§17 SSRF bullet). **Out of scope**: the shortener
function itself, `parseLinkedInPostUrl` logic, the embed probe fetch (`posts.ts:324`, the URL is built from a
format-validated URN and hardcoded to linkedin.com), the
Apify path, and any change to ownership or throttles.

## Git workflow

- Branch: `advisor/011-submitpost-fetch-hardening`. Do NOT commit or push.

## Steps

### Step 1: Add a validated-redirect fetch helper

Append to `convex/linkedin/parsePostUrl.ts`:

```ts
/**
 * Fetches an https LinkedIn URL while refusing to auto-follow redirects off the allowlist.
 * Manually reads each 3xx Location, re-validates it with isAllowedLinkedInUrl, and fetches at most
 * REDIRECT_BUDGET hops. Returns null when the input is not allowlisted, a hop leaves the allowlist,
 * a redirect has no Location, or the budget is exceeded. The returned Response is the final
 * (non-3xx) one.
 */
const REDIRECT_BUDGET = 5

export async function fetchAllowedLinkedInUrl(url: string, timeoutMs: number = 15_000): Promise<Response | null> {
  let current = url
  for (let hop = 0; hop <= REDIRECT_BUDGET; hop++) {
    if (!isAllowedLinkedInUrl(current)) return null
    const res = await fetchWithTimeout(current, { redirect: 'manual' }, timeoutMs)
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) return null
      current = new URL(location, current).toString()
      continue
    }
    return res
  }
  return null
}
```

**Verify**: `pnpm --filter convex exec tsc --noEmit -p convex/tsconfig.json` exits 0.

### Step 2: Test the helper (stubbed fetch)

Add a `describe('fetchAllowedLinkedInUrl')` block to `convex/linkedin/parsePostUrl.test.ts` following
the existing `resolveLinkedInShortlink` structure (`vi.stubGlobal('fetch', ...)`,
`afterEach(() => vi.unstubAllGlobals())`). Use `as unknown as Response` casts for partial responses.
Cases:

- no redirect: returns the 200 response, fetched once;
- allowlisted redirect `https://www.linkedin.com/a` → `https://www.linkedin.com/b` (302): returns the
  final response; assert the second call targeted `/b`;
- off-allowlist redirect (`https://evil.com/pwn` as Location): returns `null` and the target is NEVER
  fetched (assert `fetchMock` call count is 1);
- non-https Location (`http://169.254.169.254/`): returns `null`;
- redirect loop: returns `null` after the budget;
- non-allowlisted input: returns `null` without fetching.

**Verify**: `pnpm --filter convex test` passes including the new block.

### Step 3: Resolve the session before any outbound fetch

In `convex/posts.ts` `submitPost`, move the auth block (currently lines 247-251) to the top of the
handler, before the shortlink resolution. The new opening order must be:

```ts
handler: async (ctx, { sessionToken, postUrl }): Promise<{ postId: string }> => {
  // 1. Resolve authenticated user FIRST, so no anonymous caller can trigger outbound requests
  //    (the per-user rate limit and weekly-limit checks below only exist for resolved users).
  const user = (await requireAuthAction(ctx, sessionToken)) as Doc<'users'>
  if (!user?.linkedinAccessToken) {
    throw new ConvexError('No LinkedIn access token. Please sign in again.')
  }

  // 2. Resolve any lnkd.in shortlink to its underlying linkedin.com URL (SSRF-safe: manual
  //    redirect, every hop re-validated) and parse it.
  const resolvedUrl = await resolveLinkedInShortlink(postUrl)
  const parsed = resolvedUrl ? parseLinkedInPostUrl(resolvedUrl) : null
  if (!resolvedUrl || !parsed) {
    throw new ConvexError('Unrecognized LinkedIn post URL. Use a /posts/… or /feed/update/… URL.')
  }
  // ... the existing adminShareOverride + throttle block + remainder, unchanged
```

Renumber the later comments if they are numbered; do not change any logic in them. Update the
`docs/PLATFORM.md` submit-flow Mermaid node order if it shows resolution before auth (Step 4).

**Verify**: `pnpm --filter convex test` passes; `grep -n "resolveLinkedInShortlink" convex/posts.ts`
shows it AFTER the `requireAuthAction` line.

### Step 4: Use the validated helper for both post-related fetches

- Replace `const rawLinkedinResponse = await fetchWithTimeout(resolvedUrl)` (`~line 300`) with:

```ts
const rawLinkedinResponse = await fetchAllowedLinkedInUrl(resolvedUrl)
if (!rawLinkedinResponse) {
  throw new ConvexError('Could not reach LinkedIn to read this post. Please try again in a moment.')
}
```

Keep the existing `if (!rawLinkedinResponse.ok)` block immediately after it unchanged.

- Replace the article fetch (`~line 414`) with:

```ts
const articleResponse = await fetchAllowedLinkedInUrl(articleUrl)
if (articleResponse?.ok) {
  const articleHtml = await articleResponse.text()
  article = { url: articleUrl, ...parseArticle(articleHtml) }
}
```

Keep the surrounding `try/catch` and the `isAllowedLinkedInUrl(articleUrl)` precondition.

- Add `fetchAllowedLinkedInUrl` to the `./linkedin/parsePostUrl` import list (or add a new import).
- Remove the now-unused `fetchWithTimeout` import from `posts.ts` **only if** no other use remains (grep first; the
  embed probe at line 324 still uses it, so it likely stays).

**Verify**: `pnpm --filter convex test`, `pnpm lint`, and `pnpm typecheck` all pass.

### Step 5: Sync `docs/PLATFORM.md`

In §17, extend the SSRF bullet (`:5525-5540`): the post-page and article fetches now follow redirects
manually with the same per-hop `isAllowedLinkedInUrl` re-validation as the shortener, so a 3xx from
LinkedIn cannot steer the server-side fetch off-allowlist. Note the submit flow now authenticates
before any outbound request, so the documented 10/hour limit covers every request that leaves the
server.

## Test plan

- `convex/linkedin/parsePostUrl.test.ts`: the six `fetchAllowedLinkedInUrl` cases above, with the
  off-allowlist case asserting the target was never fetched. This is the security regression test.
- The auth-before-fetch reorder has no unit test (HTTP-action ordering is not in the pure-test
  harness); it is verified by the grep in Step 3 and reviewed in the diff.
- Verification: `pnpm --filter convex test` all pass including the six new cases.

## Done criteria (ALL must hold)

- [ ] `pnpm verify` exits 0
- [ ] `grep -n "fetchAllowedLinkedInUrl" convex/posts.ts convex/linkedin/parsePostUrl.ts` finds the
  definition plus both call sites
- [ ] The off-allowlist redirect test asserts exactly one fetch
- [ ] In `convex/posts.ts`, `requireAuthAction` appears before `resolveLinkedInShortlink`
  (`grep -n` both, compare line numbers)
- [ ] `docs/PLATFORM.md` §17 no longer overstates the redirect guarantee
- [ ] Only in-scope files changed; no commit made
- [ ] `plans/README.md` row updated

## STOP conditions

- The live `submitPost` does not match the excerpt, or moving auth changes behavior relied on by the
  onboarding first-post flow (check `postCreatedHidden` usage): report rather than guessing.
- LinkedIn legitimately serves a post URL as a redirect where the browser URL differs after
  canonicalization, and the mocked-path assumptions above do not match reality: keep `redirect: 'manual'`
  and report the hop chain instead of falling back to auto-follow.
- The helper would need to allow a non-linkedin host (for example `licdn.com`) for a post page: STOP.
  That host allowlist change needs its own review.

## Maintenance notes

- If LinkedIn ever chains more than 5 redirects for a valid post, raise `REDIRECT_BUDGET` with a
  comment; do not switch back to auto-follow.
- The shortener loop and this helper intentionally duplicate the hop pattern. If a third
  redirect-following caller appears, extract one shared loop rather than a fourth copy.
- Reviewer: confirm the embed-probe fetch (URN-derived URL) is untouched, and that `fetchWithTimeout`
  keeps its `{ redirect: 'manual' }` passthrough.
