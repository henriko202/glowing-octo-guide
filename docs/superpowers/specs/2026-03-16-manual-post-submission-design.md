# Manual Post Submission — Design Spec

**Date:** 2026-03-16
**Status:** Approved
**Feature:** Allow users to manually submit LinkedIn posts by URL, with ownership verification

---

## Overview

Since `r_member_social` scope is pending LinkedIn MDP approval, post sync is not yet automatic. This feature lets users add their own LinkedIn posts manually by pasting a post URL. The backend verifies post ownership before storing it.

---

## User Flow

1. User pastes a LinkedIn post URL into the **PostComposer** at the top of the Feed page
2. User clicks "Submit →"
3. Backend parses the URL, verifies ownership (two-step strategy), and upserts the post
4. Post appears in the user's **My Posts** page and, once verified, in the feed

---

## UI Layout

### Feed page

A "Share a post" composer box sits at the very top of the Feed page (above all feed posts). It contains:

- Label: "Share a post"
- URL input: `placeholder="https://www.linkedin.com/posts/your-name_…"`
- Helper text: "Paste your LinkedIn post URL"
- Submit button: "Submit →"

The composer is always visible to authenticated users.

### My Posts page (`/my-posts`)

New page accessible via a new nav item "My Posts". Contains:

- User profile header (avatar placeholder, name, plan tier)
- Section header: "Your posts (N)"
- List of posts submitted by the user, each showing:
  - Post content preview (truncated)
  - Engagement stats: 👍 likeCount · 💬 commentCount
  - "X days ago" timestamp
  - "View on LinkedIn ↗" link (opens `https://www.linkedin.com/feed/update/{urn}/`)
- Empty state: "Add posts from the Feed page composer ↑"

### Navigation

Nav bar updated: `Feed | My Posts | Settings | Billing | Sign out`

---

## Ownership Verification Strategy

Two-step verification — attempt A first, fall back to B on failure:

### Step A — Direct API verification (authoritative)

Call `GET /v2/ugcPosts/{encodedUrn}` with the user's access token.

- Parse the activity ID from the submitted URL to form `urn:li:ugcPost:{activityId}`
- If response is 200: compare `post.author` field to `urn:li:person:{user.linkedinId}`
- If match → ownership confirmed
- If 403/404 → fall through to Step B

### Step B — Vanity name heuristic (fallback)

Extract the vanity name segment from the URL (Format 1: `/posts/{vanityName}_{slug}-{activityId}-{hash}/`).

Call `GET /v2/me?projection=(vanityName)` with the user's access token to get their LinkedIn vanity name.

- If extracted vanity name matches `me.vanityName` → ownership confirmed
- If no vanity name in URL (Format 2: `/feed/update/urn:li:activity:{id}/`) → skip B, reject with clear error

If neither A nor B confirm ownership → return error: "We couldn't verify this post belongs to your account."

---

## URL Parsing

Support two LinkedIn post URL formats:

| Format   | Example                                                        | Activity ID extraction                   |
| -------- | -------------------------------------------------------------- | ---------------------------------------- |
| Format 1 | `/posts/henri-durand_typescript-patterns-{activityId}-{hash}/` | Last numeric segment before trailing `/` |
| Format 2 | `/feed/update/urn:li:activity:{activityId}/`                   | URN in path                              |

Utility: `parseLinkedInPostUrl(url: string): { activityId: string; vanityName: string | null } | null`

Returns `null` for unrecognized formats.

---

## Backend: Convex

### New action: `posts.submitPost`

**Public action** — callable from client.

**Args:**

- `userId: v.id("users")` — the submitting user
- `postUrl: v.string()` — raw LinkedIn post URL

**Steps:**

1. Parse URL → extract `activityId` and `vanityName`
2. Load user (via `internal.users.getWithTokens`)
3. Attempt Step A: `GET /v2/ugcPosts/{urn}` — if 200 and author matches, extract post content/stats
4. If A fails: Attempt Step B: `GET /v2/me?projection=(vanityName)` — compare vanity names
5. If both fail → throw error
6. If ownership confirmed: call `internal.jobs.syncPosts.upsertPost` with extracted data
7. Return `{ postId }` on success

**Error cases:**

- Unrecognized URL format
- Ownership not confirmed (neither A nor B succeeded)
- LinkedIn API errors (non-403/404 failures)

### New query: `posts.getMyPosts`

**Public query.**

**Args:** `userId: v.optional(v.id("users"))`

**Returns:** Array of posts by `authorId = userId`, ordered by `publishedAt` descending, with `linkedinPostUrn` included for constructing LinkedIn URLs.

---

## Frontend: React Components

### `PostComposer` (`app/src/components/PostComposer.tsx`)

- Controlled input for URL
- Submit button (disabled while submitting)
- Loading state during submission
- Error display on failure
- Success: clears input, optionally shows "Post added!" toast

### `MyPostsPage` (`app/src/pages/MyPostsPage.tsx`)

- Queries `posts.getMyPosts` with `userId` from sessionStorage
- Shows user profile header from `users.getMe`
- Renders post list with engagement stats and LinkedIn links
- Empty state when no posts

### Updates

- `FeedPage.tsx`: render `<PostComposer />` above the post list
- `App.tsx`: add `/my-posts` route pointing to `<MyPostsPage />`
- Nav component: add "My Posts" link pointing to `/my-posts`

---

## Testing

### Unit tests (Convex)

- `parseLinkedInPostUrl`: test both URL formats + invalid URLs + null returns
- `submitPost` action: mock LinkedIn API responses — ownership confirmed (A), fallback to B confirmed, both fail

### Component tests (React)

- `PostComposer`: renders input + button, shows error on failed submit
- `MyPostsPage`: renders post list, handles empty state

---

## Out of Scope

- Editing or deleting submitted posts
- Content fetching for Format 2 URLs via Step A when `r_member_social` is still pending (Step B only for Format 2)
- Post content auto-fetch from the LinkedIn page HTML (scraping is against ToS)
- AI-assisted post content (future sprint)
