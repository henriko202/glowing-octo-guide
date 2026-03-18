import { describe, it, expect } from 'vitest'
import { buildAuthUrl } from './oauth'

describe('buildAuthUrl', () => {
  it('generates a valid LinkedIn OAuth URL', () => {
    process.env.LINKEDIN_CLIENT_ID = 'test-client-id'
    process.env.LINKEDIN_REDIRECT_URI = 'https://shocking-dragon-458.convex.site/auth/linkedin/callback'

    const url = buildAuthUrl('test-state-123')
    expect(url).toContain('linkedin.com/oauth/v2/authorization')
    expect(url).toContain('response_type=code')
    expect(url).toContain('openid')
    expect(url).toContain('w_member_social')
    expect(url).toContain('state=test-state-123')
    expect(url).toContain('client_id=test-client-id')
  })

  it('includes the required OIDC scopes', () => {
    process.env.LINKEDIN_CLIENT_ID = 'test-client-id'
    process.env.LINKEDIN_REDIRECT_URI = 'https://shocking-dragon-458.convex.site/auth/linkedin/callback'

    const url = buildAuthUrl('state')
    const parsed = new URL(url)
    const scope = parsed.searchParams.get('scope') ?? ''
    // OpenID Connect scopes (current LinkedIn sign-in product)
    expect(scope).toContain('openid')
    expect(scope).toContain('profile')
    expect(scope).toContain('email')
    expect(scope).toContain('w_member_social')
    // Deprecated scopes are no longer requested
    expect(scope).not.toContain('r_liteprofile')
    expect(scope).not.toContain('r_emailaddress')
  })
})
