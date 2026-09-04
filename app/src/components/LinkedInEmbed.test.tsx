import { describe, expect, it } from 'vitest'
import { buildEmbedUrl, buildPostUrl } from './LinkedInEmbed'

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

describe('buildPostUrl', () => {
  it('prefers the stored sourceUrl when present', () => {
    expect(buildPostUrl('urn:li:activity:1', 'https://www.linkedin.com/posts/jane_abc')).toBe(
      'https://www.linkedin.com/posts/jane_abc'
    )
  })

  it('reconstructs a raw-colon /feed/update/ permalink from the URN when no sourceUrl', () => {
    expect(buildPostUrl('urn:li:activity:789')).toBe('https://www.linkedin.com/feed/update/urn:li:activity:789/')
  })
})
