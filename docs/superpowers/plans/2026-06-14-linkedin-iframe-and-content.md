# LinkedIn Iframe Feed + Full Content/Media Capture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display feed posts as LinkedIn embed iframes, capture full post content + media (image/article/slides) on manual submit and persist it on the backend, and fix the embed-URL namespace bug.

**Architecture:** A shared `LinkedInEmbed` React component renders the clipped embed iframe for both the Feed and My Posts, using a namespace-preserving `buildEmbedUrl`. A pure backend parser (`parsePostContent`) extracts text + media from the post-page HTML that `submitPost` already fetches; `appendMediaLinks` formats media as labeled links appended to the saved `content`. Display is iframe-only; the parsed content/media is stored but not shown.

**Tech Stack:** Convex (backend, TypeScript), React 19 + react-i18next + Tailwind (frontend), Vitest + Testing Library (tests).

**Spec:** `docs/superpowers/specs/2026-06-14-linkedin-iframe-and-content-design.md`

---

## File Structure

| Action | File                                        | Responsibility                                                           |
| ------ | ------------------------------------------- | ------------------------------------------------------------------------ |
| Create | `convex/linkedin/parsePostContent.ts`       | Pure parser: HTML → `{ text, media }`; plus `appendMediaLinks` formatter |
| Create | `convex/linkedin/parsePostContent.test.ts`  | Unit tests for parser + formatter                                        |
| Modify | `convex/posts.ts`                           | `submitPost` calls the parser, composes content, fills `mediaUrls`       |
| Create | `app/src/components/LinkedInEmbed.tsx`      | Shared clipped embed iframe + namespace-preserving `buildEmbedUrl`       |
| Create | `app/src/components/LinkedInEmbed.test.tsx` | Unit tests for `buildEmbedUrl`                                           |
| Modify | `app/src/components/PostCard.tsx`           | Iframe layout (Option B); extend `PostWithAuthor`                        |
| Modify | `app/src/components/PostCard.test.tsx`      | Tests for iframe layout                                                  |
| Modify | `app/src/pages/MyPostsPage.tsx`             | Use shared `LinkedInEmbed`; drop inline `buildEmbedUrl`                  |

**Commands** (run from the noted working directory):

- Convex tests: `cd convex && npx vitest run <file>`
- Convex typecheck: `cd convex && npx tsc --noEmit`
- App tests: `cd app && npx vitest run <file>`
- App typecheck: `cd app && npx tsc --noEmit`

---

## Task 1: `appendMediaLinks` formatter

**Files:**

- Create: `convex/linkedin/parsePostContent.ts`
- Test: `convex/linkedin/parsePostContent.test.ts`

- [ ] **Step 1: Write the failing test**

Create `convex/linkedin/parsePostContent.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { appendMediaLinks, type PostMedia } from './parsePostContent'

describe('appendMediaLinks', () => {
  const media: PostMedia[] = [
    { type: 'image', url: 'https://media.licdn.com/img.jpg' },
    { type: 'article', url: 'https://example.com/article' }
  ]

  it('appends labeled links after the text with a blank-line separator', () => {
    expect(appendMediaLinks('Hello world', media)).toBe(
      'Hello world\n\n[image] https://media.licdn.com/img.jpg\n[article] https://example.com/article'
    )
  })

  it('returns only the labeled links when there is no text', () => {
    expect(appendMediaLinks('', media)).toBe(
      '[image] https://media.licdn.com/img.jpg\n[article] https://example.com/article'
    )
  })

  it('returns only the trimmed text when there is no media', () => {
    expect(appendMediaLinks('  Hello world  ', [])).toBe('Hello world')
  })

  it('returns an empty string when there is neither text nor media', () => {
    expect(appendMediaLinks('', [])).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd convex && npx vitest run linkedin/parsePostContent.test.ts`
Expected: FAIL — cannot find module `./parsePostContent` (file does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `convex/linkedin/parsePostContent.ts`:

```ts
// convex/linkedin/parsePostContent.ts

export type PostMedia = { type: 'image' | 'article' | 'document'; url: string }

export interface ParsedPostContent {
  text: string
  media: PostMedia[]
}

/**
 * Appends media as labeled links to the end of the post text.
 * - A single blank line separates body text from links (only when both exist).
 * - Each link is on its own line, prefixed with a [type] label so the stored
 *   data is self-describing for future use.
 * - No media → just the trimmed text. No text → just the link lines.
 */
export function appendMediaLinks(text: string, media: PostMedia[]): string {
  const body = text.trim()
  const links = media.map(m => `[${m.type}] ${m.url}`).join('\n')
  if (!links) return body
  if (!body) return links
  return `${body}\n\n${links}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd convex && npx vitest run linkedin/parsePostContent.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add convex/linkedin/parsePostContent.ts convex/linkedin/parsePostContent.test.ts
git commit -m "feat(linkedin): add appendMediaLinks content formatter"
```

---

## Task 2: `parsePostContent` HTML parser

**Files:**

- Modify: `convex/linkedin/parsePostContent.ts`
- Test: `convex/linkedin/parsePostContent.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `convex/linkedin/parsePostContent.test.ts`:

```ts
import { parsePostContent } from './parsePostContent'

describe('parsePostContent', () => {
  it('extracts articleBody text and image + article media from JSON-LD (preferring articleBody over og:description)', () => {
    const html = `<html><head>
      <meta property="og:description" content="Fallback description">
      <script type="application/ld+json">
      {"@type":"Article","url":"https://example.com/the-article","articleBody":"Excited to share our Q2 results!","image":"https://media.licdn.com/img1.jpg"}
      </script>
    </head></html>`
    const result = parsePostContent(html)
    expect(result.text).toBe('Excited to share our Q2 results!')
    expect(result.media).toEqual([
      { type: 'image', url: 'https://media.licdn.com/img1.jpg' },
      { type: 'article', url: 'https://example.com/the-article' }
    ])
  })

  it('falls back to og:description and captures og:image when there is no JSON-LD', () => {
    const html = `<head>
      <meta property="og:description" content="A post with an image">
      <meta property="og:image" content="https://media.licdn.com/photo.jpg">
    </head>`
    const result = parsePostContent(html)
    expect(result.text).toBe('A post with an image')
    expect(result.media).toEqual([{ type: 'image', url: 'https://media.licdn.com/photo.jpg' }])
  })

  it('captures document (slides) PDF links', () => {
    const html = `<head><meta property="og:description" content="Check out my slides"></head>
      <body><a href="https://media.licdn.com/dms/document/slides.pdf">Doc</a></body>`
    const result = parsePostContent(html)
    expect(result.text).toBe('Check out my slides')
    expect(result.media).toEqual([{ type: 'document', url: 'https://media.licdn.com/dms/document/slides.pdf' }])
  })

  it('decodes HTML entities in extracted URLs', () => {
    const html = `<meta property="og:image" content="https://media.licdn.com/p.jpg?a=1&amp;b=2">`
    const result = parsePostContent(html)
    expect(result.media).toEqual([{ type: 'image', url: 'https://media.licdn.com/p.jpg?a=1&b=2' }])
  })

  it('returns empty text and no media for HTML with nothing recognizable', () => {
    expect(parsePostContent('<html><body>nothing here</body></html>')).toEqual({ text: '', media: [] })
    expect(parsePostContent('')).toEqual({ text: '', media: [] })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd convex && npx vitest run linkedin/parsePostContent.test.ts`
Expected: FAIL — `parsePostContent is not a function` / not exported.

- [ ] **Step 3: Write minimal implementation**

Add to `convex/linkedin/parsePostContent.ts` (above `appendMediaLinks` is fine; keep `appendMediaLinks` unchanged):

```ts
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/gi, '/')
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

/** Returns every `content` value for meta tags matching the given property/name. */
function getAllMeta(html: string, property: string): string[] {
  const out: string[] = []
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]*?content=["']([^"']*)["']`, 'gi'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*?(?:property|name)=["']${property}["']`, 'gi')
  ]
  for (const re of patterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) out.push(decodeEntities(m[1]))
  }
  return out
}

function getMeta(html: string, property: string): string | null {
  return getAllMeta(html, property)[0] ?? null
}

/** Parses every <script type="application/ld+json"> block into objects (best-effort). */
function extractJsonLd(html: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = []
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    try {
      const parsed: unknown = JSON.parse(m[1].trim())
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const rec = asRecord(item)
          if (rec) blocks.push(rec)
        }
      } else {
        const rec = asRecord(parsed)
        if (rec) blocks.push(rec)
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return blocks
}

function findPdfLinks(html: string): string[] {
  return (html.match(/https?:\/\/[^\s"'<>]+\.pdf\b/gi) ?? []).map(decodeEntities)
}

function isArticleType(type: unknown): boolean {
  if (typeof type === 'string') return /article/i.test(type)
  if (Array.isArray(type)) return type.some(t => /article/i.test(String(t)))
  return false
}

function extractText(html: string, blocks: Record<string, unknown>[]): string {
  for (const b of blocks) {
    const body = b.articleBody ?? b.description ?? b.text
    if (typeof body === 'string' && body.trim()) return body.trim()
  }
  return getMeta(html, 'og:description')?.trim() ?? ''
}

function extractMedia(html: string, blocks: Record<string, unknown>[]): PostMedia[] {
  const media: PostMedia[] = []
  const seen = new Set<string>()
  const add = (type: PostMedia['type'], url: unknown): void => {
    if (typeof url === 'string' && url && !seen.has(url)) {
      seen.add(url)
      media.push({ type, url })
    }
  }

  // Images from og:image meta tags
  for (const url of getAllMeta(html, 'og:image')) add('image', url)

  // From JSON-LD blocks
  for (const b of blocks) {
    const img = b.image
    if (typeof img === 'string') add('image', img)
    else if (Array.isArray(img)) {
      for (const i of img) add('image', typeof i === 'string' ? i : asRecord(i)?.url)
    } else {
      add('image', asRecord(img)?.url)
    }

    if (isArticleType(b['@type']) && typeof b.url === 'string') add('article', b.url)
    add('article', asRecord(b.sharedContent)?.url)
    add('document', asRecord(b.associatedMedia)?.contentUrl)
  }

  // Document/slides: direct PDF links in the page
  for (const url of findPdfLinks(html)) add('document', url)

  return media
}

/**
 * Parses a LinkedIn post page's HTML into post text + media.
 * Best-effort and non-fatal: unrecognized HTML yields { text: '', media: [] }.
 */
export function parsePostContent(html: string): ParsedPostContent {
  const blocks = extractJsonLd(html)
  return { text: extractText(html, blocks), media: extractMedia(html, blocks) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd convex && npx vitest run linkedin/parsePostContent.test.ts`
Expected: PASS (all `appendMediaLinks` + `parsePostContent` tests).

- [ ] **Step 5: Typecheck**

Run: `cd convex && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add convex/linkedin/parsePostContent.ts convex/linkedin/parsePostContent.test.ts
git commit -m "feat(linkedin): parse post text + media from page HTML"
```

---

## Task 3: Wire `submitPost` to persist full content + media

**Files:**

- Modify: `convex/posts.ts` (imports near line 1-9; handler body lines 135-168)

No unit test: `submitPost` is a Convex `action` (network + auth), which this codebase does not unit-test (see `convex/posts.test.ts`, which tests pure helpers only). The pure logic it now calls is covered by Task 1 & 2. Verification is typecheck + the parser suite.

- [ ] **Step 1: Add the import**

In `convex/posts.ts`, add after the existing import block (after line 9, `import { getPlanLimitsHelper } from './lib/planLimits'`):

```ts
import { parsePostContent, appendMediaLinks } from './linkedin/parsePostContent'
```

- [ ] **Step 2: Compose content + media after ownership verification**

In `convex/posts.ts`, find this block (currently around lines 146-150):

```ts
// 4. Verify ownership (Step A → Step B fallback)
// Step A: UGC API (works when r_member_social is approved)
// Step B: local comparison against stored publicIdentifier (no API call needed)
const storedIdentifier = user.linkedinPublicIdentifier ?? null
const ownership = await verifyPostOwnership(token, urn, user.linkedinId, parsed.vanityName, storedIdentifier)
```

Immediately after it, insert:

```ts
// 4b. Extract full content + media from the page HTML we already fetched
// above. Best-effort and non-fatal — empty results degrade gracefully to
// whatever the ownership step returned. The media is appended to `content`
// as labeled links and also stored structured in `mediaUrls` for future use.
const parsedContent = parsePostContent(rawLinkedinText)
const baseText = ownership.content || parsedContent.text
const composedContent = appendMediaLinks(baseText, parsedContent.media)
const mediaUrls = parsedContent.media.map(m => m.url)
```

Note: the URL parse result is already named `parsed` (line 100), so the new variable is deliberately named `parsedContent` to avoid a shadow/collision.

- [ ] **Step 3: Use the composed values in the upsert call**

In the `ctx.runMutation(internal.jobs.syncPosts.upsertPost, { ... })` call (lines 153-168), change these two lines:

```ts
      content: ownership.content,
```

to:

```ts
      content: composedContent,
```

and:

```ts
      mediaUrls: [],
```

to:

```ts
      mediaUrls,
```

- [ ] **Step 4: Typecheck**

Run: `cd convex && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the full convex test suite**

Run: `cd convex && npx vitest run`
Expected: PASS (existing suite still green; new parser tests green).

- [ ] **Step 6: Commit**

```bash
git add convex/posts.ts
git commit -m "feat(posts): persist full content + media links on submitPost"
```

---

## Task 4: `buildEmbedUrl` namespace fix (shared)

**Files:**

- Create: `app/src/components/LinkedInEmbed.tsx`
- Test: `app/src/components/LinkedInEmbed.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `app/src/components/LinkedInEmbed.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { buildEmbedUrl } from './LinkedInEmbed'

describe('buildEmbedUrl', () => {
  it('preserves the share namespace', () => {
    expect(buildEmbedUrl('urn:li:share:123')).toBe('https://www.linkedin.com/embed/feed/update/urn:li:share:123/')
  })

  it('preserves the ugcPost namespace', () => {
    expect(buildEmbedUrl('urn:li:ugcPost:456')).toBe('https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:456/')
  })

  it('preserves the activity namespace', () => {
    expect(buildEmbedUrl('urn:li:activity:789')).toBe('https://www.linkedin.com/embed/feed/update/urn:li:activity:789/')
  })

  it('falls back to wrapping a bare numeric id as an activity URN', () => {
    expect(buildEmbedUrl('123456')).toBe('https://www.linkedin.com/embed/feed/update/urn:li:activity:123456/')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/components/LinkedInEmbed.test.tsx`
Expected: FAIL — cannot find module `./LinkedInEmbed`.

- [ ] **Step 3: Write minimal implementation**

Create `app/src/components/LinkedInEmbed.tsx`:

```tsx
import type { ReactNode } from 'react'

/**
 * Build a LinkedIn embed iframe URL from a post URN.
 *
 * LinkedIn references the same post under three URN namespaces with DIFFERENT
 * ids — urn:li:activity:{X}, urn:li:share:{Y}, urn:li:ugcPost:{Z}. The embed
 * endpoint accepts any valid form, so we preserve the stored namespace instead
 * of force-wrapping it as activity (which broke share/ugcPost embeds).
 * Colons are NOT URL-encoded — LinkedIn's embed endpoint requires raw colons.
 */
export function buildEmbedUrl(urn: string): string {
  if (urn.startsWith('urn:li:')) {
    return `https://www.linkedin.com/embed/feed/update/${urn}/`
  }
  // Fallback for malformed/legacy bare ids — wrap as an activity URN.
  const id = urn.split(':').pop() ?? ''
  return `https://www.linkedin.com/embed/feed/update/urn:li:activity:${id}/`
}

/**
 * Renders a LinkedIn post as a clipped embed iframe. The iframe is rendered
 * taller than its container so the container's overflow:hidden clips LinkedIn's
 * native action bar at the bottom. An optional `footer` is overlaid at the
 * bottom (opaque) to cover that strip with app-owned controls.
 */
export default function LinkedInEmbed({
  urn,
  containerHeight = 420,
  iframeHeight = 480,
  footer
}: {
  urn: string
  containerHeight?: number
  iframeHeight?: number
  footer?: ReactNode
}) {
  return (
    <div
      className="relative overflow-hidden"
      style={{ height: containerHeight }}
    >
      <iframe
        src={buildEmbedUrl(urn)}
        title="LinkedIn post"
        width="100%"
        height={iframeHeight}
        className="block border-none"
        // sandbox: explicit whitelist — prevents the iframe from navigating the
        // top window, opening popups, or submitting forms.
        // allow-scripts: needed for LinkedIn's embed JS to render the post.
        // allow-same-origin: needed so LinkedIn's cookies work (avoids sign-in wall).
        sandbox="allow-scripts allow-same-origin"
        loading="lazy"
      />
      {footer && <div className="absolute bottom-0 left-0 right-0">{footer}</div>}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/components/LinkedInEmbed.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/components/LinkedInEmbed.tsx app/src/components/LinkedInEmbed.test.tsx
git commit -m "feat(ui): shared LinkedInEmbed with namespace-preserving embed URL"
```

---

## Task 5: Feed `PostCard` iframe layout (Option B)

**Files:**

- Modify: `app/src/components/PostCard.tsx` (whole file)
- Test: `app/src/components/PostCard.test.tsx` (whole file)

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `app/src/components/PostCard.test.tsx` with:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PostCard, { type PostWithAuthor } from './PostCard'

const mockPost: PostWithAuthor = {
  _id: 'post123' as never,
  linkedinPostUrn: 'urn:li:activity:7234567890123456789',
  content: 'Hello LinkedIn world',
  publishedAt: Date.now(),
  likeCount: 10,
  commentCount: 3,
  mediaUrls: [],
  isFeatured: false,
  author: { name: 'Jane Doe', headline: 'Engineer' }
}

describe('PostCard', () => {
  it('renders the LinkedIn embed iframe for the post URN', () => {
    render(
      <PostCard
        post={mockPost}
        onComment={() => {}}
        onReact={() => {}}
      />
    )
    const iframe = screen.getByTitle('LinkedIn post')
    expect(iframe).toHaveAttribute(
      'src',
      'https://www.linkedin.com/embed/feed/update/urn:li:activity:7234567890123456789/'
    )
  })

  it('renders the author name but not the raw post body text', () => {
    render(
      <PostCard
        post={mockPost}
        onComment={() => {}}
        onReact={() => {}}
      />
    )
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.queryByText('Hello LinkedIn world')).not.toBeInTheDocument()
  })

  it('shows the FEATURED badge when isFeatured is true', () => {
    render(
      <PostCard
        post={{ ...mockPost, isFeatured: true }}
        onComment={() => {}}
        onReact={() => {}}
      />
    )
    expect(screen.getByText(/featured/i)).toBeInTheDocument()
  })

  it('wires the Like button to onReact with the post id', () => {
    const onReact = vi.fn()
    render(
      <PostCard
        post={mockPost}
        onComment={() => {}}
        onReact={onReact}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /like/i }))
    expect(onReact).toHaveBeenCalledWith(mockPost._id)
  })

  it('wires the Comment button to onComment with the post id', () => {
    const onComment = vi.fn()
    render(
      <PostCard
        post={mockPost}
        onComment={onComment}
        onReact={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /comment/i }))
    expect(onComment).toHaveBeenCalledWith(mockPost._id)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/components/PostCard.test.tsx`
Expected: FAIL — `linkedinPostUrn` not on `PostWithAuthor`, and `getByTitle('LinkedIn post')` not found (PostCard still renders text).

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `app/src/components/PostCard.tsx` with:

```tsx
import { useTranslation } from 'react-i18next'
import type { Id } from '../../../convex/_generated/dataModel'
import LinkedInEmbed from './LinkedInEmbed'

export type PostWithAuthor = {
  _id: Id<'posts'>
  linkedinPostUrn: string
  content: string
  publishedAt: number
  likeCount: number
  commentCount: number
  mediaUrls: string[]
  isFeatured: boolean
  author: {
    name: string
    headline?: string
    profilePictureUrl?: string
  } | null
}

export default function PostCard({
  post,
  onComment,
  onReact
}: {
  post: PostWithAuthor
  onComment: (postId: Id<'posts'>) => void
  onReact: (postId: Id<'posts'>) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white font-sans">
      {/* App-owned header: Featured badge + author. The iframe can't render the
          app's Featured concept, so it lives here above the embed. */}
      <div className="p-4 pb-3">
        {post.isFeatured && (
          <span className="mb-2 inline-block text-[11px] font-bold uppercase tracking-wider text-amber-600">
            {t('feed.featured')}
          </span>
        )}

        {post.author && (
          <div className="flex items-center gap-2.5">
            {post.author.profilePictureUrl ? (
              <img
                src={post.author.profilePictureUrl}
                alt=""
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-base font-bold text-blue-700">
                {post.author.name[0]}
              </div>
            )}
            <div>
              <p className="m-0 text-sm font-semibold text-slate-900">{post.author.name}</p>
              {post.author.headline && <p className="m-0 text-xs text-slate-500">{post.author.headline}</p>}
            </div>
          </div>
        )}
      </div>

      {/* LinkedIn embed. Our own Like/Comment bar is overlaid at the bottom,
          covering LinkedIn's clipped native action bar. These buttons drive the
          app's in-app engagement (onReact / onComment), independent of LinkedIn. */}
      <LinkedInEmbed
        urn={post.linkedinPostUrn}
        footer={
          <div className="flex h-[52px] items-center gap-4 border-t border-slate-200 bg-white px-4">
            <button
              onClick={() => onReact(post._id)}
              className="flex cursor-pointer items-center gap-1 border-none bg-none text-[13px] text-slate-500 outline-none"
            >
              👍 {post.likeCount} {t('feed.like')}
            </button>
            <button
              onClick={() => onComment(post._id)}
              className="flex cursor-pointer items-center gap-1 border-none bg-none text-[13px] text-slate-500 outline-none"
            >
              💬 {post.commentCount} {t('feed.comment')}
            </button>
          </div>
        }
      />
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/components/PostCard.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: no errors. (`FeedPage.tsx` passes full post docs from `getFeed` into `PostCard` via a cast, so the added required `linkedinPostUrn` field is satisfied at runtime; confirm tsc is clean.)

- [ ] **Step 6: Commit**

```bash
git add app/src/components/PostCard.tsx app/src/components/PostCard.test.tsx
git commit -m "feat(feed): render posts as LinkedIn embed (Option B layout)"
```

---

## Task 6: Refactor `MyPostsPage` onto the shared embed

**Files:**

- Modify: `app/src/pages/MyPostsPage.tsx` (lines 26-32 remove inline helper; lines 124-168 use the component)

This removes the duplicate `buildEmbedUrl` (and inherits the namespace fix). The existing `MyPostsPage.test.tsx` renders with zero posts, so it does not exercise the embed — it must stay green unchanged.

- [ ] **Step 1: Remove the inline `buildEmbedUrl` and import the shared component**

In `app/src/pages/MyPostsPage.tsx`, add to the imports (after line 7, `import PostComposer from '../components/PostComposer'`):

```ts
import LinkedInEmbed from '../components/LinkedInEmbed'
```

Then delete the inline helper (lines 26-32):

```ts
/** Build a LinkedIn embed iframe URL from a ugcPost URN */
function buildEmbedUrl(urn: string): string {
  // Extract numeric ID: urn:li:ugcPost:{id} → urn:li:activity:{id}
  // LinkedIn embed requires activity URN format; colons must NOT be URL-encoded.
  const id = urn.split(':').pop() ?? ''
  return `https://www.linkedin.com/embed/feed/update/urn:li:activity:${id}/`
}
```

- [ ] **Step 2: Replace the inline iframe markup with `LinkedInEmbed`**

In the post list, replace the embed container block (currently lines 128-164, the `<div className="relative h-[420px] overflow-hidden"> … </div>` that wraps the `<iframe>` and the overlay) with:

```tsx
<LinkedInEmbed
  urn={post.linkedinPostUrn}
  footer={
    <div className="flex h-[52px] items-center justify-between border-t border-slate-200 bg-white px-[14px]">
      {/* Engagement stats from our own tracking data */}
      <span className="text-xs text-slate-500">
        👍 {post.likeCount} · 💬 {post.commentCount}
      </span>
      <span className="text-xs text-slate-500">
        {timeAgo(post.publishedAt)} ·{' '}
        <a
          href={buildLinkedInUrl(post)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 no-underline"
        >
          View on LinkedIn ↗
        </a>
      </span>
    </div>
  }
/>
```

The surrounding `<div key={post._id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">` wrapper (line 124-127) and its closing `</div>` (line 165) stay as-is. `buildLinkedInUrl` and `timeAgo` are unchanged and still used.

- [ ] **Step 3: Typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: no errors. (If tsc flags `buildLinkedInUrl`/`timeAgo` as unused, that would mean Step 2 was applied incorrectly — both must still be referenced inside the new `footer`.)

- [ ] **Step 4: Run the My Posts tests**

Run: `cd app && npx vitest run src/pages/MyPostsPage.test.tsx`
Expected: PASS (5 tests, unchanged).

- [ ] **Step 5: Commit**

```bash
git add app/src/pages/MyPostsPage.tsx
git commit -m "refactor(my-posts): use shared LinkedInEmbed component"
```

---

## Task 7: Full verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Run the entire convex test suite**

Run: `cd convex && npx vitest run`
Expected: PASS (all suites).

- [ ] **Step 2: Run the entire app test suite**

Run: `cd app && npx vitest run`
Expected: PASS (all suites).

- [ ] **Step 3: Typecheck both workspaces**

Run: `cd convex && npx tsc --noEmit`
Then: `cd app && npx tsc --noEmit`
Expected: no errors in either.

- [ ] **Step 4: Lint the repo**

Run (from repo root): `pnpm lint`
Expected: no errors, no warnings (`--max-warnings 0`).

- [ ] **Step 5: Final commit (only if lint auto-fixes or tweaks were needed)**

```bash
git add -A
git commit -m "chore: lint + verification for LinkedIn iframe + content capture"
```

---

## Self-Review

**Spec coverage:**

- Iframe-only Feed display (Option B layout) → Task 5.
- Shared embed component / refactor My Posts → Tasks 4, 6.
- Embed URN namespace fix → Task 4.
- Parse full content + media from HTML → Task 2.
- Media as labeled links appended to `content` + structured `mediaUrls` → Tasks 1, 3.
- New posts only / no backfill → reflected by only touching `submitPost` (no migration task). ✔
- Apify cron untouched → no task modifies `syncPostsApify.ts`. ✔
- Best-effort/non-fatal parsing → Task 2 returns empty results; Task 3 uses `ownership.content || parsedContent.text`. ✔

**Placeholder scan:** No TBD/TODO; every code step contains complete code and exact commands. ✔

**Type consistency:** `PostMedia` / `ParsedPostContent` defined in Task 1, reused in Tasks 2-3. `parsePostContent` / `appendMediaLinks` signatures match their imports in `submitPost`. `buildEmbedUrl` defined in Task 4, consumed by Tasks 4-6. `PostWithAuthor.linkedinPostUrn` added in Task 5 and asserted in its test. New variable named `parsedContent` to avoid colliding with the existing `parsed` (URL parse) in `submitPost`. ✔
