# Plan 007: Route every LinkedIn member-API call through one `callMemberApi` seam

> **Executor instructions**: Follow step by step; run each verification. Honor STOP conditions —
> several steps touch code that makes **live LinkedIn calls**, so request equivalence is critical.
> Update this plan's row in `plans/README.md` when done.
> **Repo rule (`CLAUDE.md`): NEVER commit or push.** Keep `docs/PLATFORM.md` in sync (a step below does this).
>
> **Drift check (run first)**:
> `git diff --stat 90a90ad..HEAD -- convex/interactions.ts convex/linkedin/posts.ts convex/linkedin/oauth.ts`
> If any changed since `90a90ad`, compare the excerpts below to the live code before editing.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED — touches three files that make real LinkedIn requests; the change must be
  byte-for-byte behavior-preserving per call site.
- **Depends on**: 004 recommended (a regression net near `interactions.ts`); not required.
- **Category**: tech-debt (architecture / deepening)
- **Planned at**: commit `90a90ad`, 2026-06-18

## Why this matters

The LinkedIn **member-API call** — Bearer auth on `api.linkedin.com`, the shared headers, and the
`log-the-real-error → throw-a-sanitized-message` policy — is **hand-rolled in four places**. A change
to LinkedIn auth, API versioning, or error handling today is an N-site edit, and the call sites can't
be tested because each calls `fetch` inline. Extracting one **deep module** (`callMemberApi`) gives:
**locality** (the call + error policy live in one place), **leverage** (one interface, four call
sites, and the seam the planned **MDP/Partner** migration will pivot on), and **a test surface** (the
contract is unit-tested once via a stubbed `fetch`).

**Design was agreed in a grilling session** — record of the load-bearing decisions:

- **Scope**: the four Bearer calls to `api.linkedin.com` (comment, react, fetchUserPosts, userinfo).
  The OAuth **token exchange stays out** — its `client_secret` form-POST to `www.linkedin.com` is a
  different auth shape; folding it in would make the interface lie. (The `BASE = api.linkedin.com`
  constant enforces this — token exchange targets a different host.)
- **Error model**: the module owns `!ok → log real error → throw "Failed to {action}. Please try
again."`, with an **opt-in `soft: number[]`** escape hatch returning `null` (for `fetchUserPosts`'s
  "403 = scope not granted, skip" case). Chosen over a never-throwing result type because the latter
  spreads the throw decision back across callers (less locality).
- **Owned vs per-call**: the module owns Authorization + `Content-Type` (when there's a body) + the
  error policy. `X-Restli-Protocol-Version` and `Linkedin-Version` are passed **per call**, so
  `userinfo` (which sends no `X-Restli` today) stays byte-identical.

## Current state (the four call sites — preserve each request exactly)

- `convex/interactions.ts:107` `commentOnPost`:
  `POST https://api.linkedin.com/v2/socialActions/${encodeURIComponent(urn)}/comments`,
  headers `Authorization: Bearer`, `Content-Type: application/json`, `X-Restli-Protocol-Version: 2.0.0`,
  body `{ actor: 'urn:li:person:{linkedinId}', message: { text } }`; on `!ok`: `console.error(...)` +
  `throw new Error('Failed to post comment. Please try again.')`. Response body is NOT read.
- `convex/interactions.ts:165` `reactToPost`:
  `POST https://api.linkedin.com/rest/reactions?actor=${encodeURIComponent('urn:li:person:{linkedinId}')}`,
  headers as above **plus `Linkedin-Version: 202603`**, body `{ root: urn, reactionType }`; on `!ok`:
  `console.error(...)` + `throw new Error('Failed to post reaction. Please try again.')`. Body not read.
- `convex/linkedin/posts.ts:37` `fetchUserPosts`:
  `GET https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(${authorUrn})&count=20`,
  headers `Authorization: Bearer`, `X-Restli-Protocol-Version: 2.0.0`; **`if (res.status === 403)
return null`** (scope not granted), else `console.error(...)` + `throw new Error('Posts fetch failed:
${res.status}')`; on ok parses JSON and maps `parseLinkedInPost`.
- `convex/linkedin/oauth.ts:45` `fetchLinkedInUserInfo`:
  `GET https://api.linkedin.com/v2/userinfo`, header `Authorization: Bearer` **only** (no `X-Restli`);
  on `!ok`: `console.error(...)` + `throw new Error('Failed to retrieve LinkedIn profile. Please try
again.')`; on ok returns parsed JSON.

**Stays out of scope** — `convex/linkedin/oauth.ts:23` `exchangeCodeForTokens`
(`POST https://www.linkedin.com/oauth/v2/accessToken`, form body, `client_secret`). Do NOT touch it.

**Precedent to mirror**: `convex/lib/apify.ts` `runApifyTask` is the existing "call an external API"
helper (Bearer + JSON + `!ok → log + throw`). `callMemberApi` is the LinkedIn analogue. The repo tests
**pure** logic (see `convex/lib/apify.test.ts` — it tests the gate helpers, not `runApifyTask`); this
plan adds the repo's first `fetch`-stubbed test because, for this seam, the request/error contract IS
the thing worth testing.

## The agreed interface (create exactly this)

```ts
// convex/linkedin/client.ts
// Single seam for authenticated LinkedIn *member-API* calls (api.linkedin.com, Bearer = user token).
// Owns auth + Content-Type + the log-real-error→throw-sanitized policy; callers pass method/path/body,
// an `action` label for the sanitized message, and any per-call headers (X-Restli, Linkedin-Version).
// `soft` lists statuses to return `null` for instead of throwing (e.g. 403 = scope not granted).
const BASE = 'https://api.linkedin.com'

export async function callMemberApi(
  accessToken: string,
  req: { method: string; path: string; body?: unknown; headers?: Record<string, string> },
  opts: { action: string; soft?: number[] }
): Promise<Response | null> {
  const res = await fetch(`${BASE}${req.path}`, {
    method: req.method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(req.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...req.headers
    },
    ...(req.body !== undefined ? { body: JSON.stringify(req.body) } : {})
  })
  if (!res.ok) {
    if (opts.soft?.includes(res.status)) return null
    console.error(`LinkedIn ${opts.action} failed: ${res.status}`, await res.text())
    throw new Error(`Failed to ${opts.action}. Please try again.`)
  }
  return res
}
```

## Commands you will need

| Purpose                   | Command                     | Expected                            |
|---------------------------|-----------------------------|-------------------------------------|
| Convex tests              | `pnpm --filter convex test` | all pass incl. new `client.test.ts` |
| Lint                      | `pnpm lint`                 | exit 0                              |
| Typecheck (if 001 landed) | `pnpm typecheck`            | exit 0                              |

## Scope

**In scope (create)**: `convex/linkedin/client.ts`, `convex/linkedin/client.test.ts`.
**In scope (modify, behavior-preserving)**: `convex/interactions.ts` (comment + react),
`convex/linkedin/posts.ts` (`fetchUserPosts`), `convex/linkedin/oauth.ts` (`fetchLinkedInUserInfo`
ONLY), `docs/PLATFORM.md` (§20 glossary entry + §6 note).
**Out of scope**: `exchangeCodeForTokens`; `convex/lib/apify.ts`; the increment mutations and any feed
logic; the comment/react validation, rate-limiting, or `incrementCommentCount`/`incrementLikeCount`
calls (leave them exactly as they are — only the `fetch` block changes).

## Git workflow

- Branch: `advisor/007-linkedin-client-seam`. Do NOT commit/push.

## Steps

### Step 1: Create the client module

Create `convex/linkedin/client.ts` with the interface above, verbatim.
**Verify**: `pnpm lint` exits 0; `pnpm --filter convex exec tsc --noEmit -p tsconfig.json` exits 0 (or `pnpm typecheck`
if 001 landed).

### Step 2: Test the contract (repo's first fetch-stub test)

Create `convex/linkedin/client.test.ts` (Vitest). Stub `globalThis.fetch` with `vi.fn()` (use
`vi.stubGlobal('fetch', fn)` in `beforeEach`, `vi.unstubAllGlobals()` in `afterEach`). Cover:

- **ok** → returns the `Response`; assert the request had `Authorization: Bearer <token>`, included
  `Content-Type: application/json` **only** when a body was passed, and merged `req.headers`.
- **soft status** (e.g. `soft: [403]`, fetch resolves 403) → returns `null`, does NOT throw.
- **non-soft `!ok`** (e.g. 500) → throws `Failed to <action>. Please try again.` and called
  `console.error` (spy on it).
- **no body** (GET) → no `Content-Type` header sent.
  Model the file structure on `convex/lib/apify.test.ts` (describe/it/expect).
  **Verify**: `pnpm --filter convex test` passes including the new file.

### Step 3: Rewrite `commentOnPost`'s fetch (interactions.ts)

Replace the inline `fetch(...)` + `if (!res.ok) {...}` block with:

```ts
await callMemberApi(
  user.linkedinAccessToken,
  {
    method: 'POST',
    path: `/v2/socialActions/${encodeURIComponent(post.linkedinPostUrn)}/comments`,
    body: { actor: `urn:li:person:${user.linkedinId}`, message: { text: commentText } },
    headers: { 'X-Restli-Protocol-Version': '2.0.0' }
  },
  { action: 'post comment' }
)
```

Leave everything else (auth, rate-limit, `getPost` checks, `incrementCommentCount`, `return`) unchanged.
**Verify (equivalence)**: the resulting request has the SAME method, URL, headers, and body as the
"Current state" excerpt. `pnpm --filter convex test` + `pnpm lint` pass. Add the `callMemberApi` import.

### Step 4: Rewrite `reactToPost`'s fetch (interactions.ts)

Same pattern, preserving the actor-in-querystring and the version header:

```ts
await callMemberApi(
  user.linkedinAccessToken,
  {
    method: 'POST',
    path: `/rest/reactions?actor=${encodeURIComponent(`urn:li:person:${user.linkedinId}`)}`,
    body: { root: post.linkedinPostUrn, reactionType },
    headers: { 'X-Restli-Protocol-Version': '2.0.0', 'Linkedin-Version': '202603' }
  },
  { action: 'post reaction' }
)
```

**Verify**: request equivalence; tests + lint pass.

### Step 5: Rewrite `fetchUserPosts` (linkedin/posts.ts) — uses the soft hatch

```ts
const res = await callMemberApi(
  accessToken,
  {
    method: 'GET',
    path: `/v2/ugcPosts?q=authors&authors=List(${authorUrn})&count=20`,
    headers: { 'X-Restli-Protocol-Version': '2.0.0' }
  },
  { action: 'fetch posts', soft: [403] }
)
if (res === null) return null // 403 = r_member_social not granted → skip silently
const data = (await res.json()) as LinkedInUGCPostsResponse
return (data.elements ?? []).map(parseLinkedInPost)
```

Note: the non-403 error message changes from `Posts fetch failed: <status>` to `Failed to fetch posts.
Please try again.` — acceptable because this is an **internal** action error (logged, not user-facing).
**Verify**: 403 still returns `null`; tests + lint pass.

### Step 6: Rewrite `fetchLinkedInUserInfo` (oauth.ts) — no extra headers

```ts
const res = await callMemberApi(
  accessToken,
  { method: 'GET', path: '/v2/userinfo' },
  { action: 'retrieve LinkedIn profile' }
)
return (await res!.json()) as LinkedInUserInfo
```

(`res` is non-null here — no `soft` passed, so a `!ok` would have thrown.) Confirm NO `X-Restli` header
is sent (parity with today). Do NOT touch `exchangeCodeForTokens` in the same file.
**Verify**: request is auth-only; tests + lint pass.

### Step 7: Keep the canonical doc in sync (the CONTEXT.md side-effect, recorded in PLATFORM.md)

- `docs/PLATFORM.md` §20 Glossary — add:
  `- **Member API call** — an authenticated request to api.linkedin.com made as the user (Bearer =
the user's token). All member-API calls route through the single `linkedin/client.ts` `callMemberApi`
seam; the OAuth token exchange (client-secret flow) is separate.`
- §6 (Backend Architecture & Conventions) — add one line: LinkedIn member-API calls go through
  `linkedin/client.ts`; only the OAuth token exchange calls LinkedIn directly.

## Test plan

- New: `convex/linkedin/client.test.ts` — the four contract cases in Step 2 (ok / soft / hard-error /
  no-body), via a stubbed `globalThis.fetch`. This is the seam's test surface.
- Pattern: `convex/lib/apify.test.ts` for structure; `vi.stubGlobal` for the fetch stub.
- The four call sites have no existing unit tests (and none are added — consistent with the repo's
  no-`ctx`-mock convention); their correctness is preserved by the byte-for-byte equivalence checks.

## Done criteria (ALL must hold)

- [ ] `convex/linkedin/client.ts` exists with the agreed interface
- [ ] `convex/linkedin/client.test.ts` covers ok / soft / hard-error / no-body and passes
- [ ] All four call sites call `callMemberApi`; no inline `fetch` to `api.linkedin.com` remains in
  `interactions.ts` / `linkedin/posts.ts` / `linkedin/oauth.ts`
  (`grep -n "fetch(" convex/interactions.ts convex/linkedin/posts.ts` → only via the client; oauth
  keeps the ONE `fetch` in `exchangeCodeForTokens`)
- [ ] Each rewritten request is byte-for-byte equivalent (method/URL/headers/body) to its excerpt
- [ ] `fetchUserPosts` still returns `null` on 403
- [ ] `pnpm --filter convex test` + `pnpm lint` pass; `pnpm typecheck` exits 0 (if 001 landed)
- [ ] `docs/PLATFORM.md` §20 + §6 updated
- [ ] Only the in-scope files changed; no commit was made
- [ ] `plans/README.md` row for 007 updated

## STOP conditions

- A rewritten request would differ from its excerpt in method, URL, any header, or body shape, and you
  can't make it identical with the per-call `headers` map → STOP and report (a behavior change here can
  break commenting/reacting in production).
- A call site no longer matches the "Current state" excerpt (drift since `90a90ad`) → STOP and report.
- `exchangeCodeForTokens` appears to need the client too → it does not (different host/auth); leave it.

## Maintenance notes

- **MDP/Partner migration**: when LinkedIn Partner access lands, the swap happens inside
  `callMemberApi` (and the `soft: [403]` in `fetchUserPosts` is exactly where "scope not granted" is
  encoded) — call sites shouldn't change.
- Reviewer: diff each rewritten `fetch` against the before-excerpt; confirm `userinfo` still sends no
  `X-Restli`, and that `reactToPost` still sends `Linkedin-Version: 202603`.
- The `action` label is the user-facing-message knob; keep labels short ("post comment", "react").
- Deliberately deferred: routing the OAuth token exchange through a seam (different auth shape — not
  worth a leaky shared interface).
