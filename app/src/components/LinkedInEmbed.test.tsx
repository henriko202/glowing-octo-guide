import { describe, expect, it } from 'vitest'
import { buildEmbedUrl } from './LinkedInEmbed'

describe('buildEmbedUrl', () => {
  it('preserves the share namespace', () => {
    expect(buildEmbedUrl('urn:li:share:123')).toBe(
      'https://www.linkedin.com/embed/feed/update/urn:li:share:123/'
    )
  })

  it('preserves the ugcPost namespace', () => {
    expect(buildEmbedUrl('urn:li:ugcPost:456')).toBe(
      'https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:456/'
    )
  })

  it('preserves the activity namespace', () => {
    expect(buildEmbedUrl('urn:li:activity:789')).toBe(
      'https://www.linkedin.com/embed/feed/update/urn:li:activity:789/'
    )
  })

  it('falls back to wrapping a bare numeric id as an activity URN', () => {
    expect(buildEmbedUrl('123456')).toBe(
      'https://www.linkedin.com/embed/feed/update/urn:li:activity:123456/'
    )
  })
})
