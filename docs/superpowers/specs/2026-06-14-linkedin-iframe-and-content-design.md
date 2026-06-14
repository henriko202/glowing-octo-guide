# LinkedIn Iframe Display + Complete Content/Media Capture

**Date:** 2026-06-14
**Status:** Approved — ready for implementation planning

## Summary

Two related changes:

1. **Display:** The Feed renders each post as a **LinkedIn embed iframe** (matching what My Posts already does) instead of rendering the saved post text. The iframe natively shows the post's text, images, carousels/slides, and article previews.
2. **Data:** Capture the full post content + media (image / article / slides) on the manual submit path and persist it on the backend. Media is saved both as labeled links appended to the end of the `content` field and in the structured `mediaUrls` array. This data is **not displayed** (the iframe is the display) — it is kept for future use.

A pre-existing embed-URL bug is fixed as part of this work.

## Decisions (resolved during brainstorming)

| Decision | Choice |
|---|---|
| Feed display | **Iframe only.** Content + media links saved on backend but never shown in-app. |
| Feed card chrome | Slim app-side author header (with **Featured** badge) above the iframe; in-app Like/Comment bar below; LinkedIn's native action bar clipped off. |
| Content/media source (manual submit) | **Parse the post's public HTML** that `submitPost` already fetches. |
| Existing posts | **New posts only** — no backfill (app is not yet in production). |
| Embed URN limitation | **Fix it** — preserve the real URN namespace instead of force-wrapping as `activity`. |

## Background — current state

- **`getFeed`** already returns full post documents (only author tokens are stripped), so `linkedinPostUrn` and `sourceUrl` already reach the Feed client — they were simply unused. The Feed display change is therefore purely client-side.
- **`PostCard`** currently renders `post.content` as a `<p>` and never shows media.
- **`MyPostsPage`** already uses a clipped LinkedIn embed iframe via an inline `buildEmbedUrl` helper.
- **Manual `submitPost`** fetches the post page HTML only to extract `data-attributed-urn`, then verifies ownership. In the common vanity-heuristic fallback the returned content is `''`, and `mediaUrls` is hardcoded to `[]`. So manual submissions persist almost nothing.
- **Apify cron sync** scrapes `content` + `postImages` (images only). Unchanged by this work.

## Section 1 — Display layer

### Shared embed component — `app/src/components/LinkedInEmbed.tsx` (new)

Extracts the clipped-iframe markup and embed-URL logic currently inline in `MyPostsPage` into a reusable component. Props: `urn` (required), optional `sourceUrl` and engagement/footer slots as needed by each caller. Renders the iframe with the existing sandbox (`allow-scripts allow-same-origin`), the taller-than-container + `overflow:hidden` clip that hides LinkedIn's native action bar, and `loading="lazy"`.

### Embed URN fix (`buildEmbedUrl`)

LinkedIn references the same post under three URN namespaces with **different IDs**: `urn:li:activity:{X}`, `urn:li:share:{Y}`, `urn:li:ugcPost:{Z}`. The current helper strips the namespace and force-wraps the ID as `urn:li:activity:{id}`, so an Apify `share` ID becomes an invalid activity URN that fails to resolve.

LinkedIn's `/embed/feed/update/` endpoint accepts any valid URN form directly. Fix: **preserve the stored URN's namespace.**

- `urn:li:share:123` → `https://www.linkedin.com/embed/feed/update/urn:li:share:123/`
- `urn:li:ugcPost:456` → `.../embed/feed/update/urn:li:ugcPost:456/`
- `urn:li:activity:789` → unchanged
- Fallback guard: a value not starting with `urn:li:` (malformed/legacy bare ID) is wrapped as `urn:li:activity:{id}` so nothing regresses.
- Colons are **not** URL-encoded (LinkedIn embed requirement).

This fixes both Feed and My Posts embeds in one place.

### `PostCard.tsx` (modify) — Option B layout

- Keep the slim author header (name, headline, avatar) and the **Featured** badge — the iframe cannot render the app's Featured concept.
- Replace `<p>{post.content}</p>` with `<LinkedInEmbed urn={post.linkedinPostUrn} />`.
- Keep the in-app **Like / Comment** bar exactly as is (`onReact` / `onComment` unchanged) — this is the product's core engagement loop and is independent of LinkedIn's native buttons.
- Extend the `PostWithAuthor` type with `linkedinPostUrn: string` (and optional `sourceUrl?: string` for a "View on LinkedIn" link). No `getFeed` change needed — the data is already returned.

### `MyPostsPage.tsx` (modify)

Use the shared `LinkedInEmbed` component; remove the duplicate inline `buildEmbedUrl`. Inherits the URN fix.

## Section 2 — Backend content + media extraction

### `convex/linkedin/parsePostContent.ts` (new) — pure parser

- **Input:** raw post-page HTML string. **Output:** `{ text: string; media: { type: 'image' | 'article' | 'document'; url: string }[] }`.
- **Text:** prefer LinkedIn's embedded `<script type="application/ld+json">` (`articleBody` / `text`); fall back to `<meta property="og:description">`.
- **Image:** `og:image` plus any ld+json `image` entries → type `image`.
- **Article:** an external article share (ld+json `sharedContent` / `og:type=article` URL) → type `article`.
- **Document/slides:** document / native-document URLs or carousel thumbnail URLs that can be located → type `document`.
- **Best-effort and non-fatal:** if nothing is found, parsing returns empty results and the submission still succeeds.

### `submitPost` (modify `convex/posts.ts`)

After the existing `fetch(postUrl)` → `rawLinkedinText`:

1. `const parsed = parsePostContent(rawLinkedinText)`.
2. `const baseText = ownership.content || parsed.text` (prefer real API content when present, else parsed text).
3. `const content = appendMediaLinks(baseText, parsed.media)` (Section 3).
4. Pass `content` and `mediaUrls: parsed.media.map(m => m.url)` into `upsertPost` (instead of the current `content: ownership.content` / `mediaUrls: []`).

No change to ownership verification, rate limiting, or weekly-limit logic.

## Section 3 — Saved-content format

Pure helper `appendMediaLinks(text, media): string`:

```
<post text>

[image] https://media.licdn.com/…
[article] https://example.com/the-article
[document] https://media.licdn.com/…/slides.pdf
```

Rules:

- A single blank line separates body text from links — only when both exist.
- Each link on its own line, prefixed with a `[type]` label so the stored data is self-describing.
- No media → content is just the text, no trailing whitespace.
- No text (media-only post) → just the link lines.

Both representations are persisted from the same parsed result — the appended-link form in `content` and the structured `mediaUrls` array — so they cannot drift.

## Section 4 — Testing

Test-driven (red → green) per the project's TDD practice:

- `convex/linkedin/parsePostContent.test.ts` — HTML fixtures for image / article / document(slides) / text-only / empty posts.
- `appendMediaLinks` tests — formatting, blank-line rules, empty/media-only cases.
- `buildEmbedUrl` tests — `share` / `ugcPost` / `activity` / bare-ID fallback.
- `convex/posts.test.ts` — `submitPost` composes content with appended links and populates `mediaUrls`.
- `app/src/components/PostCard.test.tsx` — renders the iframe with the correct `src`; keeps author header, Featured badge, and Like/Comment wiring; no longer renders body text.

## Files touched

| Action | File |
|---|---|
| New | `convex/linkedin/parsePostContent.ts` (parser + `appendMediaLinks`) |
| New | `convex/linkedin/parsePostContent.test.ts` |
| New | `app/src/components/LinkedInEmbed.tsx` (shared clipped iframe + URN-preserving `buildEmbedUrl`) |
| Modify | `convex/posts.ts` — `submitPost` parses HTML, composes content, fills `mediaUrls` |
| Modify | `app/src/components/PostCard.tsx` — Option B iframe layout, extend `PostWithAuthor` |
| Modify | `app/src/pages/MyPostsPage.tsx` — use shared `LinkedInEmbed`, drop inline `buildEmbedUrl` |
| Modify | `app/src/components/PostCard.test.tsx` |
| Modify | `convex/posts.test.ts` |

## Out of scope

- No backfill of existing posts (new posts only).
- No changes to the Apify cron's media extraction (continues to capture images as today).
- No change to the feed query, ownership verification, rate limiting, or plan-limit logic.

## Risks / notes

- **HTML-parsing fragility:** LinkedIn can change its public markup or serve an auth-walled minimal page to server-side fetches. The parser is best-effort and non-fatal, so submissions never break over parsing — they degrade to empty content/media, matching today's behavior.
- **Document/slides links:** LinkedIn documents (carousels) are not always exposed as clean URLs in public HTML; the parser captures what it can (document URL or thumbnails) and otherwise omits them.
