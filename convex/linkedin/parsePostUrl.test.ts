import { describe, it, expect } from 'vitest'
import { parseLinkedInPostUrl } from './parsePostUrl'

describe('parseLinkedInPostUrl', () => {
  it('parses Format 1 — /posts/{vanity}_{slug}-{activityId}-{hash}/', () => {
    const url = 'https://www.linkedin.com/posts/henri-durand_typescript-patterns-7234567890123456789-Abcd/'
    const result = parseLinkedInPostUrl(url)
    expect(result).not.toBeNull()
    expect(result!.activityId).toBe('7234567890123456789')
    expect(result!.vanityName).toBe('henri-durand')
  })

  it('parses Format 1 without trailing slash', () => {
    const url = 'https://www.linkedin.com/posts/jane-doe_some-title-7111111111111111111-XyZa'
    const result = parseLinkedInPostUrl(url)
    expect(result).not.toBeNull()
    expect(result!.activityId).toBe('7111111111111111111')
    expect(result!.vanityName).toBe('jane-doe')
  })

  it('parses Format 2 — /feed/update/urn:li:activity:{id}/', () => {
    const url = 'https://www.linkedin.com/feed/update/urn:li:activity:7234567890123456789/'
    const result = parseLinkedInPostUrl(url)
    expect(result).not.toBeNull()
    expect(result!.activityId).toBe('7234567890123456789')
    expect(result!.vanityName).toBeNull()
  })

  it('returns null for unrecognized URL', () => {
    expect(parseLinkedInPostUrl('https://linkedin.com/in/someone')).toBeNull()
    expect(parseLinkedInPostUrl('not-a-url')).toBeNull()
    expect(parseLinkedInPostUrl('')).toBeNull()
  })

  it('extracts activityId from Format 1 with query params', () => {
    const url = 'https://www.linkedin.com/posts/bob-smith_hello-world-7999999999999999999-Abcd/?utm_source=share'
    const result = parseLinkedInPostUrl(url)
    expect(result).not.toBeNull()
    expect(result!.activityId).toBe('7999999999999999999')
    expect(result!.vanityName).toBe('bob-smith')
  })
})
