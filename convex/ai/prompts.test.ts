import { describe, expect, it } from 'vitest'
import { buildCommentPrompt, buildReactionPrompt } from './prompts'
import type { ChatMessage } from './openrouter'

function textOf(msg: ChatMessage): string {
  if (typeof msg.content === 'string') return msg.content
  return msg.content
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('')
}
function imagesOf(msg: ChatMessage): string[] {
  if (typeof msg.content === 'string') return []
  return msg.content
    .filter((p): p is { type: 'image_url'; image_url: { url: string } } => p.type === 'image_url')
    .map(p => p.image_url.url)
}

describe('buildReactionPrompt', () => {
  it('lists the 6 keywords and includes the post content', () => {
    const [system, user] = buildReactionPrompt({ content: 'We hit $1M ARR!' })
    expect(system.role).toBe('system')
    for (const k of ['LIKE', 'PRAISE', 'EMPATHY', 'INTEREST', 'APPRECIATION', 'ENTERTAINMENT']) {
      expect(system.content).toContain(k)
    }
    expect(textOf(user)).toContain('We hit $1M ARR!')
  })

  it('includes the article title/summary and the FULL body text (not truncated)', () => {
    const body = 'B'.repeat(3000) // longer than the old 2000-char cap
    const [, user] = buildReactionPrompt({
      content: 'x',
      article: { title: 'Scaling', summary: 'How we scaled', text: body }
    })
    const t = textOf(user)
    expect(t).toContain('Scaling')
    expect(t).toContain('How we scaled')
    expect(t).toContain(body)
  })

  it('attaches post + article images as image_url parts', () => {
    const user = buildReactionPrompt({
      content: 'x',
      imageUrls: ['https://img/1.png'],
      article: { imageUrls: ['https://img/2.png'] }
    })[1]
    expect(imagesOf(user)).toEqual(['https://img/1.png', 'https://img/2.png'])
  })
})

describe('buildCommentPrompt', () => {
  it('auto language → "same language as the post"', () => {
    const [system] = buildCommentPrompt({ content: 'x', mediaUrls: [] }, 'auto')
    expect(system.content).toMatch(/same language as the post/i)
    expect(system.content).toMatch(/at most 2/i)
  })

  it('specific language → names it', () => {
    const [system] = buildCommentPrompt({ content: 'x', mediaUrls: [] }, 'pt')
    expect(system.content).toMatch(/portuguese/i)
    expect(system.content).toContain('(pt)')
  })

  it('includes author + full article text, and lists non-image media as not viewable', () => {
    const body = 'A'.repeat(3000)
    const [, user] = buildCommentPrompt(
      {
        content: 'Body',
        mediaUrls: ['https://x/doc.pdf'],
        author: { name: 'Jane', headline: 'Eng' },
        article: { title: 'T', summary: 'S', text: body }
      },
      'en'
    )
    const t = textOf(user)
    expect(t).toContain('Jane')
    expect(t).toContain('T')
    expect(t).toContain(body)
    expect(t).toMatch(/not viewable/i)
    expect(t).toContain('https://x/doc.pdf')
  })

  it('attaches images and does not also list them as non-viewable links', () => {
    const [, user] = buildCommentPrompt(
      { content: 'Body', mediaUrls: ['https://img/a.png', 'https://x/doc.pdf'], imageUrls: ['https://img/a.png'] },
      'en'
    )
    expect(imagesOf(user)).toContain('https://img/a.png')
    const t = textOf(user)
    expect(t).not.toContain('https://img/a.png') // it's an image part, not text
    expect(t).toContain('https://x/doc.pdf') // the non-image media is still listed as context
  })
})
