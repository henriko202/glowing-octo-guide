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

  it('rejects non-LinkedIn hosts (SSRF guard) even with a valid post path', () => {
    expect(parseLinkedInPostUrl('https://evil.com/posts/x_y-7234567890123456789-Abcd/')).toBeNull()
    expect(parseLinkedInPostUrl('http://169.254.169.254/posts/x_y-7234567890123456789-Abcd/')).toBeNull()
    expect(parseLinkedInPostUrl('https://linkedin.com.evil.com/posts/x_y-7234567890123456789-Abcd/')).toBeNull()
    expect(parseLinkedInPostUrl('https://evil-linkedin.com/posts/x_y-7234567890123456789-Abcd/')).toBeNull()
  })

  it('rejects non-https schemes for LinkedIn hosts', () => {
    expect(parseLinkedInPostUrl('http://www.linkedin.com/posts/x_y-7234567890123456789-Abcd/')).toBeNull()
  })

  it('accepts linkedin.com subdomains over https', () => {
    const r = parseLinkedInPostUrl('https://de.linkedin.com/posts/x_y-7234567890123456789-Abcd/')
    expect(r).not.toBeNull()
    expect(r!.activityId).toBe('7234567890123456789')
  })
})
