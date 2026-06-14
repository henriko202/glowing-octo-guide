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
