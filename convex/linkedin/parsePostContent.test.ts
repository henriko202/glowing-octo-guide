import { describe, expect, it } from 'vitest'
import { appendMediaLinks, type PostMedia } from './parsePostContent'
import { parsePostContent } from './parsePostContent'

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
    expect(result.media).toEqual([
      { type: 'document', url: 'https://media.licdn.com/dms/document/slides.pdf' }
    ])
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
