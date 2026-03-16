# Manual Post Submission Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to manually submit LinkedIn post URLs, verify ownership via LinkedIn API, and view their submitted posts on a dedicated "My Posts" page.

**Architecture:** Four independent tasks: (1) a URL parser utility + tests, (2) a Convex `submitPost` action + `getMyPosts` query, (3) a `PostComposer` React component added to the Feed, and (4) a new `MyPostsPage` with nav integration.

**Tech Stack:** TypeScript, Convex actions/queries, React + Vite, Vitest, react-i18next

**Spec:** `docs/superpowers/specs/2026-03-16-manual-post-submission-design.md`

---

## Chunk 1: URL Parser Utility

### Task 1: LinkedIn post URL parser

**Files:**
- Create: `convex/linkedin/parsePostUrl.ts`
- Create: `convex/linkedin/parsePostUrl.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// convex/linkedin/parsePostUrl.test.ts
import { describe, it, expect } from "vitest";
import { parseLinkedInPostUrl } from "./parsePostUrl";

describe("parseLinkedInPostUrl", () => {
  it("parses Format 1 — /posts/{vanity}_{slug}-{activityId}-{hash}/", () => {
    const url =
      "https://www.linkedin.com/posts/henri-durand_typescript-patterns-7234567890123456789-Abcd/";
    const result = parseLinkedInPostUrl(url);
    expect(result).not.toBeNull();
    expect(result!.activityId).toBe("7234567890123456789");
    expect(result!.vanityName).toBe("henri-durand");
  });

  it("parses Format 1 without trailing slash", () => {
    const url =
      "https://www.linkedin.com/posts/jane-doe_some-title-7111111111111111111-XyZa";
    const result = parseLinkedInPostUrl(url);
    expect(result).not.toBeNull();
    expect(result!.activityId).toBe("7111111111111111111");
    expect(result!.vanityName).toBe("jane-doe");
  });

  it("parses Format 2 — /feed/update/urn:li:activity:{id}/", () => {
    const url =
      "https://www.linkedin.com/feed/update/urn:li:activity:7234567890123456789/";
    const result = parseLinkedInPostUrl(url);
    expect(result).not.toBeNull();
    expect(result!.activityId).toBe("7234567890123456789");
    expect(result!.vanityName).toBeNull();
  });

  it("returns null for unrecognized URL", () => {
    expect(parseLinkedInPostUrl("https://linkedin.com/in/someone")).toBeNull();
    expect(parseLinkedInPostUrl("not-a-url")).toBeNull();
    expect(parseLinkedInPostUrl("")).toBeNull();
  });

  it("extracts activityId from Format 1 with query params", () => {
    const url =
      "https://www.linkedin.com/posts/bob-smith_hello-world-7999999999999999999-Abcd/?utm_source=share";
    const result = parseLinkedInPostUrl(url);
    expect(result).not.toBeNull();
    expect(result!.activityId).toBe("7999999999999999999");
    expect(result!.vanityName).toBe("bob-smith");
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
cd /d/ERP/LinkIntoTheSSI/LinkIntoTheSSI && npx vitest run convex/linkedin/parsePostUrl.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the parser**

```typescript
// convex/linkedin/parsePostUrl.ts

export interface ParsedPostUrl {
  /** LinkedIn activity ID — used to form urn:li:ugcPost:{activityId} */
  activityId: string;
  /** Vanity name extracted from URL path (null for Format 2) */
  vanityName: string | null;
}

/**
 * Parses a LinkedIn post URL and extracts the activity ID and optional vanity name.
 *
 * Supported formats:
 *   Format 1: /posts/{vanityName}_{slug}-{activityId}-{hash}/
 *   Format 2: /feed/update/urn:li:activity:{activityId}/
 *
 * Returns null for unrecognized formats.
 */
export function parseLinkedInPostUrl(url: string): ParsedPostUrl | null {
  if (!url) return null;

  let pathname: string;
  try {
    const parsed = new URL(url);
    pathname = parsed.pathname;
  } catch {
    return null;
  }

  // Format 2: /feed/update/urn:li:activity:{id}
  const format2Match = pathname.match(
    /\/feed\/update\/urn:li:activity:(\d+)/
  );
  if (format2Match) {
    return { activityId: format2Match[1], vanityName: null };
  }

  // Format 1: /posts/{vanityName}_{slug}-{activityId}-{hash}
  // The vanity name is everything before the first underscore in the slug segment.
  // The activityId is the large number (17-19 digits) near the end.
  const format1Match = pathname.match(/\/posts\/([^_]+)_.*?-(\d{15,20})-[^/]+/);
  if (format1Match) {
    return { activityId: format1Match[2], vanityName: format1Match[1] };
  }

  return null;
}
```

- [ ] **Step 4: Run test to confirm pass**

```bash
npx vitest run convex/linkedin/parsePostUrl.test.ts
```
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
cd /d/ERP/LinkIntoTheSSI/LinkIntoTheSSI && git add convex/linkedin/parsePostUrl.ts convex/linkedin/parsePostUrl.test.ts
git commit -m "feat(convex): LinkedIn post URL parser utility"
```

---

## Chunk 2: Convex Backend

### Task 2: `getMyPosts` query

**Files:**
- Create: `convex/posts.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// convex/posts.test.ts
import { describe, it, expect, vi } from "vitest";

// We test the handler logic directly since Convex query wrappers are
// not testable in unit tests — this mirrors the pattern in feed.test.ts.
describe("getMyPosts handler", () => {
  it("returns empty array when userId is undefined", async () => {
    const handler = async (
      _ctx: unknown,
      args: { userId?: string }
    ): Promise<unknown[]> => {
      if (!args.userId) return [];
      return []; // db would be called here
    };
    const result = await handler({}, { userId: undefined });
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run convex/posts.test.ts
```
Expected: FAIL — `posts.test.ts` does not exist yet (module not found).

- [ ] **Step 3: Create `convex/posts.ts` with `getMyPosts`**

```typescript
// convex/posts.ts
import { query } from "./_generated/server";
import { v } from "convex/values";
import type { QueryCtx } from "./convexTypes";

export const getMyPosts = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, { userId }) => {
    if (!userId) return [];
    const queryCtx = ctx as unknown as QueryCtx;
    const posts = await queryCtx.db
      .query("posts")
      .withIndex("by_author", (q) => q.eq("authorId", userId))
      .collect();
    // Sort by publishedAt descending — the by_author index orders by _creationTime,
    // not publishedAt, so we sort in-memory to get correct chronological order.
    return posts.sort((a, b) => b.publishedAt - a.publishedAt);
  },
});
```

- [ ] **Step 4: Run test to confirm pass**

```bash
npx vitest run convex/posts.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/posts.ts convex/posts.test.ts
git commit -m "feat(convex): getMyPosts query"
```

---

### Task 3: `submitPost` action

**Files:**
- Modify: `convex/posts.ts` (add `submitPost` action)

The `submitPost` action:
1. Parses the URL
2. Loads the user's LinkedIn token
3. Tries Step A: `GET /v2/ugcPosts/{urn}` — checks `post.author`
4. Falls back to Step B: `GET /v2/me?projection=(vanityName)` — compares vanity names
5. Calls `internal.jobs.syncPosts.upsertPost` if ownership confirmed

- [ ] **Step 1: Add `submitPost` to `convex/posts.ts`**

Add after the `getMyPosts` export:

```typescript
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { parseLinkedInPostUrl } from "./linkedin/parsePostUrl";
import { verifyPostOwnership } from "./linkedin/verifyPostOwnership";
import type { ActionCtx, UserDoc } from "./convexTypes";

export const submitPost = action({
  args: {
    userId: v.id("users"),
    postUrl: v.string(),
  },
  handler: async (ctx, { userId, postUrl }) => {
    const actionCtx = ctx as unknown as ActionCtx;

    // 1. Parse URL
    const parsed = parseLinkedInPostUrl(postUrl);
    if (!parsed) {
      throw new Error(
        "Unrecognized LinkedIn post URL. Use a /posts/… or /feed/update/… URL."
      );
    }

    // 2. Load user with token
    const user = await actionCtx.runQuery<UserDoc | null>(
      internal.users.getWithTokens,
      { userId }
    );
    if (!user?.linkedinAccessToken) {
      throw new Error("No LinkedIn access token. Please sign in again.");
    }

    const token = user.linkedinAccessToken as string;
    const urn = `urn:li:ugcPost:${parsed.activityId}`;

    // 3. Verify ownership (Step A → Step B fallback)
    // verifyPostOwnership throws if ownership cannot be confirmed
    const ownership = await verifyPostOwnership(
      token,
      urn,
      user.linkedinId as string,
      parsed.vanityName
    );

    // 4. Upsert the post
    // Note: upsertPost was extended to return the post _id (see Step 1b above).
    const postId = await actionCtx.runMutation(
      internal.jobs.syncPosts.upsertPost,
      {
        linkedinPostUrn: urn,
        authorId: userId,
        content: ownership.content,
        publishedAt: ownership.publishedAt,
        likeCount: 0,
        commentCount: 0,
        mediaUrls: [],
        isFeatured: false,
        visibilityIndustries: [],
        visibilityCountries: [],
        hidden: user.subscriptionStatus === "trialing",
      }
    );

    return { postId };
  },
});
```

- [ ] **Step 1b: Extend `upsertPost` in `convex/jobs/syncPosts.ts` to return the post `_id`**

The current `upsertPost` mutation returns `void`. Change the handler to return the `_id`:

```typescript
// In convex/jobs/syncPosts.ts — modify upsertPost handler:
handler: async (ctx, args: UpsertPostArgs) => {
  const db = (ctx as unknown as MutationCtx).db;
  const existing = await db
    .query("posts")
    .withIndex("by_urn", (q) => q.eq("linkedinPostUrn", args.linkedinPostUrn))
    .first();
  if (existing) {
    await db.patch(existing._id, {
      likeCount: args.likeCount,
      commentCount: args.commentCount,
      hidden: args.hidden,
    });
    return existing._id;
  } else {
    return await db.insert("posts", {
      ...args,
      featuredAt: undefined,
    });
  }
},
```

- [ ] **Step 1c: Extract ownership verification into a pure helper (testable)**

The Convex action wrapper cannot be unit-tested directly. Extract the ownership-checking logic into a pure async function in a separate file so it can be tested with a stubbed `fetch`.

Create `convex/linkedin/verifyPostOwnership.ts`:

```typescript
// convex/linkedin/verifyPostOwnership.ts

export interface OwnershipResult {
  confirmed: boolean;
  content: string;
  publishedAt: number;
  strategy: "ugc-api" | "vanity-heuristic";
}

/**
 * Verifies that a LinkedIn post belongs to the given user.
 *
 * Step A: Try GET /v2/ugcPosts/{urn} and compare post.author.
 * Step B (fallback): If A returns 403/404 and vanityName is available,
 *   call GET /v2/me?projection=(vanityName) and compare vanity names.
 *
 * Throws on unrecoverable errors or ownership mismatch.
 */
export async function verifyPostOwnership(
  token: string,
  urn: string,
  linkedinId: string,
  vanityName: string | null
): Promise<OwnershipResult> {
  const ugcRes = await fetch(
    `https://api.linkedin.com/v2/ugcPosts/${encodeURIComponent(urn)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    }
  );

  if (ugcRes.ok) {
    const ugcPost = (await ugcRes.json()) as Record<string, unknown>;
    const expectedAuthor = `urn:li:person:${linkedinId}`;
    if (ugcPost.author !== expectedAuthor) {
      throw new Error("This post doesn't belong to your LinkedIn account.");
    }
    const share = (
      ugcPost.specificContent as Record<string, unknown> | undefined
    )?.["com.linkedin.ugc.ShareContent"] as Record<string, unknown> | undefined;
    const commentary = (
      share?.shareCommentary as Record<string, unknown> | undefined
    )?.text;
    const publishedAt =
      typeof ugcPost.created === "object" && ugcPost.created !== null
        ? ((ugcPost.created as Record<string, unknown>).time as number) ??
          Date.now()
        : Date.now();
    return {
      confirmed: true,
      content: typeof commentary === "string" ? commentary : "",
      publishedAt,
      strategy: "ugc-api",
    };
  }

  if (ugcRes.status === 403 || ugcRes.status === 404) {
    // Step A failed — fall back to vanity heuristic if available
    if (!vanityName) {
      throw new Error(
        "Could not verify post ownership. Use a /posts/… URL format for fallback verification."
      );
    }
    const meRes = await fetch(
      "https://api.linkedin.com/v2/me?projection=(vanityName)",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!meRes.ok) {
      throw new Error(
        "Could not verify post ownership. LinkedIn API unavailable."
      );
    }
    const meData = (await meRes.json()) as Record<string, unknown>;
    const myVanity = meData.vanityName as string | undefined;
    if (!myVanity || myVanity.toLowerCase() !== vanityName.toLowerCase()) {
      throw new Error("This post doesn't belong to your LinkedIn account.");
    }
    return {
      confirmed: true,
      content: "",
      publishedAt: Date.now(),
      strategy: "vanity-heuristic",
    };
  }

  throw new Error(`LinkedIn API error: ${ugcRes.status}`);
}
```

- [ ] **Step 1d: Write tests for `verifyPostOwnership`**

Create `convex/linkedin/verifyPostOwnership.test.ts`:

```typescript
// convex/linkedin/verifyPostOwnership.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyPostOwnership } from "./verifyPostOwnership";

describe("verifyPostOwnership", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Step A: returns confirmed + content when UGC API returns matching author", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        author: "urn:li:person:abc123",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: "Hello world" },
          },
        },
        created: { time: 1700000000000 },
      }),
    } as Response);

    const result = await verifyPostOwnership(
      "test-token",
      "urn:li:ugcPost:123",
      "abc123",
      "henri-durand"
    );

    expect(result.confirmed).toBe(true);
    expect(result.content).toBe("Hello world");
    expect(result.publishedAt).toBe(1700000000000);
    expect(result.strategy).toBe("ugc-api");
  });

  it("Step A: throws when author does not match", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        author: "urn:li:person:someone-else",
        specificContent: {},
        created: { time: 0 },
      }),
    } as Response);

    await expect(
      verifyPostOwnership("token", "urn:li:ugcPost:123", "abc123", null)
    ).rejects.toThrow("doesn't belong to your LinkedIn account");
  });

  it("Step B: confirms via vanity name when UGC returns 403 + vanity matches", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: false, status: 403 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ vanityName: "henri-durand" }),
      } as Response);

    const result = await verifyPostOwnership(
      "token",
      "urn:li:ugcPost:123",
      "abc123",
      "henri-durand"
    );

    expect(result.confirmed).toBe(true);
    expect(result.strategy).toBe("vanity-heuristic");
  });

  it("throws when Step A (403) + Step B vanity mismatch", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: false, status: 403 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ vanityName: "someone-else" }),
      } as Response);

    await expect(
      verifyPostOwnership("token", "urn", "abc123", "henri-durand")
    ).rejects.toThrow("doesn't belong to your LinkedIn account");
  });

  it("throws immediately for Format 2 URL (null vanityName) when Step A returns 403", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
    } as Response);

    await expect(
      verifyPostOwnership("token", "urn", "abc123", null)
    ).rejects.toThrow("Use a /posts/… URL format");
  });
});
```

- [ ] **Step 1e: Update `submitPost` handler to use `verifyPostOwnership` helper**

In `convex/posts.ts`, replace the inline Step A / Step B logic with a call to the helper:

```typescript
import { verifyPostOwnership } from "./linkedin/verifyPostOwnership";

// ... inside submitPost handler, replace everything between
// "3. Step A" and "4. Upsert the post" with:

    const ownership = await verifyPostOwnership(
      token,
      urn,
      user.linkedinId as string,
      parsed.vanityName
    );
    // ownership.content and ownership.publishedAt replace the inline variables from the
    // earlier draft — use ownership.content and ownership.publishedAt directly in the
    // upsertPost call below (the upsert block in Step 1 already uses these field names).
```

- [ ] **Step 2: Deploy to Convex to catch any type errors**

```bash
cd /d/ERP/LinkIntoTheSSI/LinkIntoTheSSI && npx convex dev --once
```
Expected: deployment succeeds with no errors. If TypeScript errors appear, fix them before continuing.

- [ ] **Step 3: Commit**

```bash
git add convex/posts.ts
git commit -m "feat(convex): submitPost action with A+B ownership verification"
```

---

## Chunk 3: React Components

### Task 4: PostComposer component

**Files:**
- Create: `app/src/components/PostComposer.tsx`
- Create: `app/src/components/PostComposer.test.tsx`
- Modify: `app/src/pages/FeedPage.tsx` (add `<PostComposer />` above feed)

- [ ] **Step 1: Write the failing test**

```typescript
// app/src/components/PostComposer.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import PostComposer from "./PostComposer";

describe("PostComposer", () => {
  it("renders the URL input and submit button", () => {
    render(<PostComposer onSubmit={async () => {}} />);
    expect(
      screen.getByPlaceholderText(/linkedin\.com\/posts/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit/i })
    ).toBeInTheDocument();
  });

  it("disables submit button when input is empty", () => {
    render(<PostComposer onSubmit={async () => {}} />);
    expect(screen.getByRole("button", { name: /submit/i })).toBeDisabled();
  });

  it("enables submit button when URL is typed", () => {
    render(<PostComposer onSubmit={async () => {}} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "https://www.linkedin.com/posts/test_123-XyZ" },
    });
    expect(screen.getByRole("button", { name: /submit/i })).not.toBeDisabled();
  });

  it("shows error message when onSubmit throws", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Ownership failed"));
    render(<PostComposer onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "https://www.linkedin.com/posts/test_123-XyZ" },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(await screen.findByText(/ownership failed/i)).toBeInTheDocument();
  });

  it("clears input after successful submit", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PostComposer onSubmit={onSubmit} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, {
      target: { value: "https://www.linkedin.com/posts/test_123-XyZ" },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    await screen.findByRole("textbox");
    expect((input as HTMLInputElement).value).toBe("");
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
cd /d/ERP/LinkIntoTheSSI/LinkIntoTheSSI && npx vitest run app/src/components/PostComposer.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement PostComposer**

```typescript
// app/src/components/PostComposer.tsx
import { useState } from "react";

interface PostComposerProps {
  onSubmit: (url: string) => Promise<void>;
}

export default function PostComposer({ onSubmit }: PostComposerProps) {
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(url.trim());
      setUrl("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit post");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "#1e293b",
        borderRadius: 8,
        padding: 16,
        marginBottom: 24,
        border: "1px solid #334155",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          color: "#64748b",
          marginBottom: 8,
          letterSpacing: "0.05em",
        }}
      >
        Share a post
      </div>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://www.linkedin.com/posts/your-name_…"
        disabled={submitting}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "8px 10px",
          borderRadius: 6,
          border: "1px solid #334155",
          background: "#0f172a",
          color: "#e2e8f0",
          fontSize: 13,
          marginBottom: 8,
          outline: "none",
        }}
      />
      {error && (
        <p style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>
          {error}
        </p>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 11, color: "#64748b" }}>
          Paste your LinkedIn post URL
        </span>
        <button
          type="submit"
          disabled={!url.trim() || submitting}
          style={{
            background: url.trim() && !submitting ? "#3b82f6" : "#1e3a5f",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "6px 14px",
            fontSize: 12,
            cursor: url.trim() && !submitting ? "pointer" : "not-allowed",
            opacity: !url.trim() || submitting ? 0.5 : 1,
          }}
        >
          {submitting ? "Submitting…" : "Submit →"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx vitest run app/src/components/PostComposer.test.tsx
```
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Wire PostComposer into FeedPage**

In `app/src/pages/FeedPage.tsx`, add the import and action, then render `<PostComposer />` above the post list:

```typescript
// Add at top of FeedPage.tsx with other imports:
import { useAction } from "convex/react";
import type { Id } from "../../../convex/_generated/dataModel";
import PostComposer from "../components/PostComposer";

// Inside FeedPage() function body, add:
const submitPost = useAction(api.posts.submitPost);
const userId = (sessionStorage.getItem("convexUserId") ?? undefined) as Id<"users"> | undefined;

async function handlePostSubmit(url: string) {
  if (!userId) throw new Error("Not signed in");
  await submitPost({ userId, postUrl: url });
}
```

Then in the JSX, add `<PostComposer onSubmit={handlePostSubmit} />` immediately after the `<h1>` heading and before the posts list `<div>`.

Full updated `FeedPage.tsx`:

```typescript
// app/src/pages/FeedPage.tsx
import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { useTranslation } from "react-i18next";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../convex";
import PostCard, { type PostWithAuthor } from "../components/PostCard";
import CommentBox from "../components/CommentBox";
import PostComposer from "../components/PostComposer";

export default function FeedPage() {
  const { t } = useTranslation();
  const feed = useQuery(api.feed.getFeed, {});
  const react = useAction(api.interactions.reactToPost);
  const submitPost = useAction(api.posts.submitPost);
  const [commentingOn, setCommentingOn] = useState<Id<"posts"> | null>(null);

  const userId = (sessionStorage.getItem("convexUserId") ?? undefined) as
    | Id<"users">
    | undefined;

  async function handlePostSubmit(url: string) {
    if (!userId) throw new Error("Not signed in");
    await submitPost({ userId, postUrl: url });
  }

  if (!feed) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: "center",
          color: "#64748b",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {t("feed.loading")}
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "32px 16px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1
        style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 24 }}
      >
        {t("feed.title")}
      </h1>

      <PostComposer onSubmit={handlePostSubmit} />

      {feed.posts.length === 0 && (
        <p style={{ textAlign: "center", color: "#64748b", padding: "32px 0" }}>
          {t("feed.empty")}
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {(feed.posts as unknown as PostWithAuthor[]).map((post) => (
          <div key={post._id}>
            <PostCard
              post={post}
              onComment={(id) =>
                setCommentingOn(id === commentingOn ? null : id)
              }
              onReact={(id) => react({ postId: id, reactionType: "LIKE" })}
            />
            {commentingOn === post._id && (
              <CommentBox
                postId={post._id}
                onClose={() => setCommentingOn(null)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add app/src/components/PostComposer.tsx app/src/components/PostComposer.test.tsx app/src/pages/FeedPage.tsx
git commit -m "feat(app): PostComposer component wired into Feed"
```

---

### Task 5: MyPostsPage + nav integration

**Files:**
- Create: `app/src/pages/MyPostsPage.tsx`
- Create: `app/src/pages/MyPostsPage.test.tsx`
- Create: `app/src/components/AppNav.tsx`
- Modify: `app/src/App.tsx` (add `/my-posts` route + wrap with nav)

- [ ] **Step 1: Write the failing test for MyPostsPage**

```typescript
// app/src/pages/MyPostsPage.test.tsx
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("convex/react", () => ({
  useQuery: vi.fn((fn: unknown) => {
    // getMe call
    if (String(fn).includes("getMe")) {
      return { name: "Henri Durand", tier: "starter" };
    }
    // getMyPosts — empty
    return [];
  }),
  useAction: vi.fn(() => async () => {}),
}));

import { MemoryRouter } from "react-router-dom";
import MyPostsPage from "./MyPostsPage";

describe("MyPostsPage", () => {
  it("shows the page heading and user name", () => {
    render(
      <MemoryRouter>
        <MyPostsPage />
      </MemoryRouter>
    );
    expect(screen.getByText("My Posts")).toBeInTheDocument();
    expect(screen.getByText("Henri Durand")).toBeInTheDocument();
  });

  it("shows empty state when no posts", () => {
    render(
      <MemoryRouter>
        <MyPostsPage />
      </MemoryRouter>
    );
    expect(
      screen.getByText(/add posts from the feed/i)
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
npx vitest run app/src/pages/MyPostsPage.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement MyPostsPage**

```typescript
// app/src/pages/MyPostsPage.tsx
import { useQuery } from "convex/react";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../convex";

// The shape returned by getMyPosts — matches the posts table schema
interface MyPost {
  _id: Id<"posts">;
  linkedinPostUrn: string;
  content: string;
  publishedAt: number;
  likeCount: number;
  commentCount: number;
}

function timeAgo(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function urnToLinkedInUrl(urn: string): string {
  // urn:li:ugcPost:123456789 → /feed/update/urn:li:activity:123456789/
  const id = urn.split(":").pop() ?? "";
  return `https://www.linkedin.com/feed/update/urn:li:activity:${id}/`;
}

export default function MyPostsPage() {
  const userId = (sessionStorage.getItem("convexUserId") ?? undefined) as
    | Id<"users">
    | undefined;

  const me = useQuery(api.users.getMe, { userId });
  const posts = (useQuery(api.posts.getMyPosts, { userId }) ?? []) as MyPost[];

  return (
    <div
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "32px 16px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: "#0f172a",
          marginBottom: 24,
        }}
      >
        My Posts
      </h1>

      {/* Profile header */}
      {me && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#334155",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#94a3b8",
              fontWeight: 700,
            }}
          >
            {me.name[0]}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
              {me.name}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", textTransform: "capitalize" }}>
              {me.tier} plan
            </div>
          </div>
        </div>
      )}

      {/* Section header */}
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          color: "#64748b",
          marginBottom: 12,
          letterSpacing: "0.05em",
        }}
      >
        Your posts ({posts.length})
      </div>

      {/* Post list */}
      {posts.length === 0 ? (
        <div
          style={{
            borderTop: "1px solid #e2e8f0",
            paddingTop: 20,
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 13, color: "#64748b" }}>
            Add posts from the Feed page composer ↑
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {posts.map((post) => (
            <div
              key={post._id}
              style={{
                background: "#f8fafc",
                borderRadius: 8,
                padding: 14,
                borderLeft: "3px solid #3b82f6",
                border: "1px solid #e2e8f0",
                borderLeftWidth: 3,
                borderLeftColor: "#3b82f6",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: "#475569",
                  marginBottom: 8,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {post.content || "(content not available — post added via URL)"}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: "#64748b",
                }}
              >
                <span>
                  👍 {post.likeCount} · 💬 {post.commentCount}
                </span>
                <span>
                  {timeAgo(post.publishedAt)} ·{" "}
                  <a
                    href={urnToLinkedInUrl(post.linkedinPostUrn)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#3b82f6", textDecoration: "none" }}
                  >
                    View on LinkedIn ↗
                  </a>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to confirm pass**

```bash
npx vitest run app/src/pages/MyPostsPage.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Create AppNav component**

```typescript
// app/src/components/AppNav.tsx
import { Link, useLocation } from "react-router-dom";

const NAV_LINKS = [
  { path: "/feed", label: "Feed" },
  { path: "/my-posts", label: "My Posts" },
  { path: "/settings", label: "Settings" },
  { path: "/billing", label: "Billing" },
];

export default function AppNav() {
  const { pathname } = useLocation();

  function handleSignOut() {
    sessionStorage.removeItem("convexUserId");
    window.location.href = "/login";
  }

  return (
    <nav
      style={{
        background: "#0f172a",
        borderBottom: "1px solid #1e293b",
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        gap: 0,
        height: 48,
        fontFamily: "system-ui, sans-serif",
        fontSize: 14,
      }}
    >
      <span
        style={{
          color: "#e2e8f0",
          fontWeight: 700,
          marginRight: 24,
          fontSize: 13,
          letterSpacing: "0.02em",
        }}
      >
        🔗 Link Into The SSI
      </span>
      {NAV_LINKS.map((link) => (
        <Link
          key={link.path}
          to={link.path}
          style={{
            color: pathname === link.path ? "#3b82f6" : "#94a3b8",
            textDecoration: "none",
            padding: "0 12px",
            height: 48,
            display: "flex",
            alignItems: "center",
            borderBottom:
              pathname === link.path ? "2px solid #3b82f6" : "2px solid transparent",
            fontSize: 13,
            fontWeight: pathname === link.path ? 600 : 400,
          }}
        >
          {link.label}
        </Link>
      ))}
      <button
        onClick={handleSignOut}
        style={{
          marginLeft: "auto",
          background: "none",
          border: "none",
          color: "#64748b",
          cursor: "pointer",
          fontSize: 13,
          padding: "0 8px",
        }}
      >
        Sign out
      </button>
    </nav>
  );
}
```

- [ ] **Step 6: Add `/my-posts` route and AppNav to App.tsx**

Update `app/src/App.tsx` to:
1. Import `MyPostsPage` and `AppNav`
2. Add `/my-posts` route inside `RequireAuth`
3. Wrap all authenticated routes with `AppNav`

```typescript
// app/src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useQuery } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "./convex";
import LoginPage from "./pages/LoginPage";
import FeedPage from "./pages/FeedPage";
import SettingsPage from "./pages/SettingsPage";
import BillingPage from "./pages/BillingPage";
import AuthSuccessPage from "./pages/AuthSuccessPage";
import MyPostsPage from "./pages/MyPostsPage";
import AppNav from "./components/AppNav";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const userId = (sessionStorage.getItem("convexUserId") ?? undefined) as
    | Id<"users">
    | undefined;
  const me = useQuery(api.users.getMe, { userId });
  if (me === undefined)
    return (
      <div style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>
        Loading…
      </div>
    );
  if (me === null) return <Navigate to="/login" replace />;
  return (
    <>
      <AppNav />
      {children}
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/success" element={<AuthSuccessPage />} />
      <Route
        path="/feed"
        element={
          <RequireAuth>
            <FeedPage />
          </RequireAuth>
        }
      />
      <Route
        path="/my-posts"
        element={
          <RequireAuth>
            <MyPostsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/billing"
        element={
          <RequireAuth>
            <BillingPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/feed" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 7: Deploy Convex to pick up new `posts.ts` exports**

```bash
cd /d/ERP/LinkIntoTheSSI/LinkIntoTheSSI && npx convex dev --once
```
Expected: `posts:getMyPosts` and `posts:submitPost` appear in deployment output.

- [ ] **Step 8: Run all tests**

```bash
npx vitest run
```
Expected: all tests pass (parser, schema, feed, PostComposer, MyPostsPage, PostCard, LoginPage, SettingsPage).

- [ ] **Step 9: Commit**

```bash
git add app/src/pages/MyPostsPage.tsx app/src/pages/MyPostsPage.test.tsx app/src/components/AppNav.tsx app/src/App.tsx
git commit -m "feat(app): MyPostsPage and AppNav with My Posts nav item"
```

---

## Verification Checklist

After all tasks complete:

- [ ] `npx vitest run` — all tests pass
- [ ] `npx convex dev --once` — deploys without errors
- [ ] Navigate to `/feed` — PostComposer box visible above feed
- [ ] Paste a valid LinkedIn post URL from the signed-in user's account → submit → confirm post appears on `/my-posts`
- [ ] Paste a URL from a different user → confirm "This post doesn't belong to your account" error
- [ ] Paste a garbage URL → confirm "Unrecognized LinkedIn post URL" error
- [ ] Click "My Posts" in nav → `/my-posts` loads with user profile and post list
- [ ] "View on LinkedIn ↗" link opens correct LinkedIn URL in new tab
- [ ] Sign out button clears session and redirects to `/login`
