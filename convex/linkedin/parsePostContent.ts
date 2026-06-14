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
