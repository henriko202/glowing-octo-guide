import { describe, it, expect, vi, afterEach } from 'vitest'
import { parseLinkedInPostUrl, resolveLinkedInShortlink, isHttpsUrl } from './parsePostUrl'

describe('isHttpsUrl', () => {
  it('accepts https URLs (incl. non-linkedin CDN hosts like licdn)', () => {
    expect(isHttpsUrl('https://media.licdn.com/dms/image/abc.jpg')).toBe(true)
    expect(isHttpsUrl('https://www.linkedin.com/posts/x')).toBe(true)
  })

  it('rejects non-https schemes and garbage', () => {
    expect(isHttpsUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpsUrl('data:text/html,<script>1</script>')).toBe(false)
    expect(isHttpsUrl('http://media.licdn.com/x.jpg')).toBe(false)
    expect(isHttpsUrl('file:///etc/passwd')).toBe(false)
    expect(isHttpsUrl('not a url')).toBe(false)
    expect(isHttpsUrl('')).toBe(false)
  })
})

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

describe('resolveLinkedInShortlink', () => {
  afterEach(() => vi.unstubAllGlobals())

  // Redirect responses only expose Location; assert we never fetch the redirect TARGET.
  function stubRedirects(chain: Record<string, string>) {
    const fetchMock = vi.fn(async (input: string) => {
      const location = chain[input]
      if (!location) throw new Error(`unexpected fetch to ${input}`)
      return { headers: new Headers({ location }) } as unknown as Response
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('returns a linkedin.com URL unchanged WITHOUT any network call', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const url = 'https://www.linkedin.com/posts/x_y-7234567890123456789-Abcd/'
    expect(await resolveLinkedInShortlink(url)).toBe(url)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('follows a lnkd.in shortlink to its linkedin.com target', async () => {
    const target = 'https://www.linkedin.com/posts/henriko202_x-7152671040479911937-O4Ev/'
    const fetchMock = stubRedirects({ 'https://lnkd.in/p/dzsyKxh9': target })
    expect(await resolveLinkedInShortlink('https://lnkd.in/p/dzsyKxh9')).toBe(target)
    // Only the shortener was fetched — never the linkedin.com target. redirect:'manual' is the
    // security-critical option (objectContaining tolerates the AbortSignal the timeout wrapper adds).
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://lnkd.in/p/dzsyKxh9',
      expect.objectContaining({ redirect: 'manual' })
    )
  })

  it('rejects a shortlink that redirects off the allowlist WITHOUT fetching the target (SSRF)', async () => {
    const fetchMock = stubRedirects({ 'https://lnkd.in/evil': 'https://evil.com/pwn' })
    expect(await resolveLinkedInShortlink('https://lnkd.in/evil')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1) // evil.com was never requested
  })

  it('rejects a shortlink redirect to a non-https target', async () => {
    stubRedirects({ 'https://lnkd.in/x': 'http://169.254.169.254/' })
    expect(await resolveLinkedInShortlink('https://lnkd.in/x')).toBeNull()
  })

  it('gives up after the hop budget on a shortener loop', async () => {
    stubRedirects({ 'https://lnkd.in/loop': 'https://lnkd.in/loop' })
    expect(await resolveLinkedInShortlink('https://lnkd.in/loop')).toBeNull()
  })

  it('returns null for non-allowlisted or malformed input without fetching', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await resolveLinkedInShortlink('https://evil.com/x')).toBeNull()
    expect(await resolveLinkedInShortlink('http://www.linkedin.com/posts/x')).toBeNull()
    expect(await resolveLinkedInShortlink('not-a-url')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
