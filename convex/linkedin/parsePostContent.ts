// convex/linkedin/parsePostContent.ts
import { isAllowedLinkedInUrl, parseLinkedInPostUrl } from './parsePostUrl'

export type PostMedia = { type: 'image' | 'article' | 'document'; url: string }

export interface ParsedPostContent {
  text: string
  media: PostMedia[]
}

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
  const urls = html.match(/https?:\/\/[^\s"'<>]+/gi) ?? []
  return urls.map(decodeEntities).filter(u => /\.pdf$/i.test(u.split(/[?#]/)[0]))
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
    add('document', asRecord(b.associatedMedia)?.contentUrl)
  }

  // Document/slides: direct PDF links in the page
  for (const url of findPdfLinks(html)) add('document', url)

  // Shared article (e.g. a Pulse post): LinkedIn does NOT expose this in JSON-LD —
  // the link lives only in the post body anchor. extractArticleUrl picks the primary
  // one and ignores "more from author" links. See its doc comment.
  const articleUrl = extractArticleUrl(html)
  if (articleUrl) add('article', articleUrl)

  return media
}

/**
 * Extracts the URL of the article a post shares (e.g. a LinkedIn Pulse article).
 *
 * LinkedIn does NOT expose the shared article in the post's JSON-LD (the post is typed
 * `SocialMediaPosting`, whose only urls are the post's own `@id`, the author profile, and
 * the cover image). The article link lives only in the post body as an <a> tag marked
 * `data-test-id="article-content"` with a `feed-article-content` class/tracking name. Other
 * /pulse/ links on the page ("more from this author") lack those markers and must be ignored.
 *
 * Returns a clean canonical URL (tracking query/hash stripped) or null. The result is validated
 * against the LinkedIn host allowlist because the caller fetches it server-side (SSRF guard).
 */
export function extractArticleUrl(html: string): string | null {
  const anchorRe = /<a\b[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = anchorRe.exec(html)) !== null) {
    const tag = m[0]
    if (!/data-test-id=["']article-content["']/i.test(tag) && !/feed-article-content/i.test(tag)) continue
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1]
    if (!href) continue
    const clean = decodeEntities(href).split(/[?#]/)[0]
    if (isAllowedLinkedInUrl(clean)) return clean
  }
  return null
}

const URN_RE = /^urn:li:(ugcPost|activity|share):\d+$/

/**
 * Extracts the post's LinkedIn URN, **preserving its namespace** (ugcPost / share / activity).
 *
 * The namespace matters: LinkedIn addresses one post under all three with DIFFERENT ids, and its
 * embed endpoint auth-walls a post addressed under the wrong one (see `buildEmbedUrl` — forcing
 * `activity` broke share/ugcPost embeds). Priority:
 *   1. legacy `data-attributed-urn="…"` attribute — authoritative when present.
 *   2. a `-{namespace}-{id}-` slug from a candidate URL — the submitted/redirected URL first (it
 *      carries the ugcPost/share id LinkedIn minted for sharing), then the page's canonical
 *      permalink, then `og:url`. This is the "use the redirected URL" path.
 *   3. last resort: a bare activity id (Format-2 `/feed/update/urn:li:activity:{id}` or a plain
 *      slug) → `urn:li:activity:{id}`.
 *
 * `candidateUrls` are real URLs (submitted/resolved, then final Response.url), highest-priority
 * first. Returns a format-validated URN or null.
 */
export function extractPostUrn(html: string, candidateUrls: string[]): string | null {
  const attributed = html.match(/data-attributed-urn=["']([^"']+)["']/)?.[1]
  if (attributed && URN_RE.test(attributed)) return attributed

  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1]
  // Only trust https linkedin.com URLs to seed the URN — it feeds the embed URL and the dedup key.
  const urls = [...candidateUrls, canonical, getMeta(html, 'og:url')]
    .filter((u): u is string => !!u)
    .map(decodeEntities)
    .filter(isAllowedLinkedInUrl)

  // Prefer an explicit namespace slug (`…-ugcPost-{id}-…`) over the bare-activity fallback.
  for (const u of urls) {
    const ns = u.match(/-(ugcPost|activity|share)-(\d{15,20})-/)
    if (ns) return `urn:li:${ns[1]}:${ns[2]}`
  }
  for (const u of urls) {
    const parsed = parseLinkedInPostUrl(u)
    if (parsed) return `urn:li:activity:${parsed.activityId}`
  }
  return null
}

/**
 * Whether a LinkedIn embed (`/embed/feed/update/{urn}/`) will actually render the post to a
 * logged-out viewer — i.e. the iframe won't show LinkedIn's "This post is unavailable" auth-wall.
 *
 * LinkedIn only serves a post to the anonymous embed when its audience is public ("Anyone"); a
 * restricted-audience post (e.g. Connections-only, or some "new position" occasion posts) returns
 * a stub auth-wall instead. That decision is server-rendered, so we can detect it from a plain
 * `fetch` of the embed URL — no browser needed. The marker is the `main-feed-activity-embed-card__`
 * CSS-class prefix, which is present on every rendered card (text, image, or video post) and, being
 * a class name, is locale-independent (survives an `Accept-Language: pt-BR` request); the auth-wall
 * stub carries none of them. Verified empirically against walled vs. public embeds.
 */
export function isEmbeddablePostHtml(embedHtml: string): boolean {
  return embedHtml.includes('main-feed-activity-embed-card__')
}

/**
 * Parses a LinkedIn post page's HTML into post text + media.
 * Best-effort and non-fatal: unrecognized HTML yields { text: '', media: [] }.
 */
export function parsePostContent(html: string): ParsedPostContent {
  const blocks = extractJsonLd(html)
  return { text: extractText(html, blocks), media: extractMedia(html, blocks) }
}

export interface PostAuthor {
  /** Post author's display name — JSON-LD `author.name` on the post block. Compared to the member's
   *  OIDC name to verify post ownership. */
  name?: string
  /** Post author's LinkedIn vanity, parsed from `author.url` (e.g. `mateus-yonemoto`). Used to
   *  auto-fill the member's identifier once ownership is confirmed. */
  vanity?: string
}

const POST_LD_TYPE = /^(SocialMediaPosting|DiscussionForumPosting)$/i

function isPostType(type: unknown): boolean {
  if (typeof type === 'string') return POST_LD_TYPE.test(type)
  if (Array.isArray(type)) return type.some(t => POST_LD_TYPE.test(String(t)))
  return false
}

/** Extract + validate a LinkedIn vanity from a profile URL like `https://br.linkedin.com/in/mateus-yonemoto`.
 *  Lowercased; returns undefined unless it matches the accepted `^[a-z0-9\-_]{3,100}$` format so we
 *  never store garbage. */
function vanityFromProfileUrl(url: string): string | undefined {
  const m = url.match(/linkedin\.com\/in\/([^/?#]+)/i)
  if (!m) return undefined
  let slug: string
  try {
    slug = decodeURIComponent(m[1]).toLowerCase()
  } catch {
    return undefined
  }
  return /^[a-z0-9\-_]{3,100}$/.test(slug) ? slug : undefined
}

/**
 * Extracts the POST author's identity from a LinkedIn post page's JSON-LD — the `author` of the
 * SocialMediaPosting/DiscussionForumPosting block (NOT a comment's author). Returns the display
 * `name` (compared against the member's OIDC name to verify ownership) and the `vanity` parsed from
 * `author.url`. Best-effort: yields {} when the page has no post-typed JSON-LD block or no author.
 */
export function parsePostAuthor(html: string): PostAuthor {
  for (const b of extractJsonLd(html)) {
    if (!isPostType(b['@type'])) continue
    const author = asRecord(b.author)
    if (!author) continue
    const name = typeof author.name === 'string' && author.name.trim() ? author.name.trim() : undefined
    const vanity = typeof author.url === 'string' ? vanityFromProfileUrl(author.url) : undefined
    return { name, vanity }
  }
  return {}
}

export interface ParsedArticle {
  /** Article title — JSON-LD `name`, falling back to og:title. */
  title?: string
  /** Short intro/summary — JSON-LD `headline`/`description`, falling back to og:description. */
  summary?: string
  /**
   * Full article body as plain text — paragraphs (blank-line separated), headings, list items
   * (`- ` bullets), and code blocks (fenced with ```), extracted from the SSR `article-content-blocks`.
   */
  text?: string
  /** Author display name — JSON-LD `author.name`. */
  author?: string
  /** Public article images (cover + og:image + inline body images), de-duplicated. */
  imageUrls: string[]
}

/**
 * Parses a LinkedIn article (Pulse) guest page into title / summary / full body text / author /
 * images.
 *
 * The guest SSR page renders the FULL article body — despite the post JSON-LD's
 * `isAccessibleForFree:false` flag — inside `<div data-test-id="article-content-blocks">` as a
 * sequence of `publishing-text-block`s, so `extractArticleBody` recovers the whole text, isolated
 * from the surrounding sign-in / comments / "more articles" chrome. Title / summary / author come
 * from the article's `@type:Article` JSON-LD (LinkedIn unusually maps `name`→title and
 * `headline`→summary), with og: tags as a fallback. Best-effort and non-fatal: unrecognized HTML
 * yields empty fields. This data seeds a future AI-comment feature; it is not displayed in-app.
 */
export function parseArticle(html: string): ParsedArticle {
  const blocks = extractJsonLd(html)
  const article = blocks.find(b => isArticleType(b['@type']))

  const ldString = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

  const title = ldString(article?.name) ?? getMeta(html, 'og:title')?.trim() ?? undefined
  const summary =
    ldString(article?.headline) ??
    ldString(article?.description) ??
    getMeta(html, 'og:description')?.trim() ??
    undefined
  const author = ldString(asRecord(article?.author)?.name)
  const text = extractArticleBody(html) || undefined

  const imageUrls: string[] = []
  const seen = new Set<string>()
  const addImage = (u: unknown): void => {
    if (typeof u === 'string' && u && !seen.has(u)) {
      seen.add(u)
      imageUrls.push(u)
    }
  }
  const img = article?.image
  if (typeof img === 'string') addImage(img)
  else addImage(asRecord(img)?.url)
  for (const u of getAllMeta(html, 'og:image')) addImage(u)
  for (const u of extractArticleBodyImages(html)) addImage(u)

  return { title, summary, text, author, imageUrls }
}

/** Strips all HTML tags (and `<!---->` comments) from a fragment. */
function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '')
}

/** Tag-free, entity-decoded text with all whitespace collapsed to single spaces. */
function collapseWs(s: string): string {
  return decodeEntities(stripTags(s)).replace(/\s+/g, ' ').trim()
}

/**
 * Extracts the full article body as plain text from a LinkedIn article guest page.
 *
 * The body lives in `<div data-test-id="article-content-blocks"> … </div>` (inside `<article>`),
 * as a flat list of `<p>` / `<h1-6>` / `<pre>` elements. We isolate that region (up to `</article>`)
 * to exclude the header, sign-in chrome, comments, and "more articles" cards, then render each
 * element in document order:
 *   - `<pre>`  → fenced code block (internal whitespace preserved)
 *   - `<h1-6>` → heading text on its own line
 *   - `<p>` containing `<li>` → one `- ` bullet per list item
 *   - `<p>`    → a paragraph
 * Blocks are joined by blank lines. Returns '' when no article body is present.
 */
function extractArticleBody(html: string): string {
  const si = html.indexOf('data-test-id="article-content-blocks"')
  if (si === -1) return ''
  const ei = html.indexOf('</article>', si)
  const region = html.slice(si, ei === -1 ? undefined : ei)

  const parts: string[] = []
  const re = /<pre\b[^>]*>([\s\S]*?)<\/pre>|<h([1-6])\b[^>]*>([\s\S]*?)<\/h\2>|<p\b[^>]*>([\s\S]*?)<\/p>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(region)) !== null) {
    if (m[1] !== undefined) {
      // Code block — preserve internal whitespace; trim trailing space per line + outer blank lines.
      const code = decodeEntities(stripTags(m[1]))
        .replace(/[ \t]+$/gm, '')
        .replace(/^\n+|\s+$/g, '')
      if (code) parts.push('```\n' + code + '\n```')
    } else if (m[3] !== undefined) {
      const heading = collapseWs(m[3])
      if (heading) parts.push(heading)
    } else if (m[4] !== undefined) {
      const p = m[4]
      if (/<li[\s>]/i.test(p)) {
        const items: string[] = []
        const li = /<li\b[^>]*>([\s\S]*?)<\/li>/gi
        let lm: RegExpExecArray | null
        while ((lm = li.exec(p)) !== null) {
          const item = collapseWs(lm[1])
          if (item) items.push(`- ${item}`)
        }
        if (items.length) parts.push(items.join('\n'))
      } else {
        const paragraph = collapseWs(p)
        if (paragraph) parts.push(paragraph)
      }
    }
  }
  return parts.join('\n\n').trim()
}

/**
 * Inline article images (media.licdn.com) found within the article body region. Scoped to
 * `article-content-blocks` so it excludes the cover (already captured via og:image) and the
 * author avatar (in the header) — leaving only genuine in-body images.
 */
function extractArticleBodyImages(html: string): string[] {
  const si = html.indexOf('data-test-id="article-content-blocks"')
  if (si === -1) return []
  const ei = html.indexOf('</article>', si)
  const region = html.slice(si, ei === -1 ? undefined : ei)
  const urls: string[] = []
  const re = /(?:src|data-delayed-url)=["'](https:\/\/media\.licdn\.com\/[^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(region)) !== null) urls.push(decodeEntities(m[1]))
  return urls
}

export interface PostEngagement {
  /** Reaction count (schema.org LikeAction interaction count). */
  likeCount: number
  /** Comment count (schema.org CommentAction interaction count). */
  commentCount: number
}

/** schema.org `interactionType` may be a string or an `{ '@type': ... }` object. */
function interactionTypeName(t: unknown): string {
  if (typeof t === 'string') return t
  const rec = asRecord(t)
  return typeof rec?.['@type'] === 'string' ? (rec['@type'] as string) : ''
}

/** Coerce a userInteractionCount (string or number) to a safe non-negative integer. */
function toCount(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/**
 * Extracts like + comment counts from a LinkedIn post page's JSON-LD
 * `interactionStatistic` blocks (schema.org `InteractionCounter`). Best-effort
 * and non-fatal: unrecognized HTML yields { likeCount: 0, commentCount: 0 }, so
 * a manually-shared post simply starts at zero engagement when LinkedIn omits
 * the data — never throws.
 */
export function parsePostEngagement(html: string): PostEngagement {
  const blocks = extractJsonLd(html)
  let likeCount = 0
  let commentCount = 0
  for (const b of blocks) {
    const stat = b.interactionStatistic
    const counters = Array.isArray(stat) ? stat : stat ? [stat] : []
    for (const c of counters) {
      const rec = asRecord(c)
      if (!rec) continue
      const type = interactionTypeName(rec.interactionType).toLowerCase()
      const count = toCount(rec.userInteractionCount)
      // Take the largest matching counter across all blocks — LinkedIn occasionally
      // emits both a page-level and post-level block; the higher value is the real one.
      if (/like/.test(type)) likeCount = Math.max(likeCount, count)
      else if (/comment/.test(type)) commentCount = Math.max(commentCount, count)
    }
  }
  return { likeCount, commentCount }
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
