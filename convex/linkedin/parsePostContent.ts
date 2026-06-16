// convex/linkedin/parsePostContent.ts

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
