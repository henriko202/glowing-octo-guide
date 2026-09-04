import { describe, expect, it } from 'vitest'
import { buildAuthUrl } from './oauth'

describe('buildAuthUrl', () => {
  it('generates a valid LinkedIn OAuth URL', () => {
    process.env.LINKEDIN_CLIENT_ID = 'test-client-id'
    process.env.LINKEDIN_REDIRECT_URI = 'https://shocking-dragon-458.convex.site/auth/linkedin/callback'

    const url = buildAuthUrl('test-state-123')
    expect(url).toContain('linkedin.com/oauth/v2/authorization')
    expect(url).toContain('response_type=code')
    expect(url).toContain('openid')
    expect(url).toContain('state=test-state-123')
    expect(url).toContain('client_id=test-client-id')
  })

  it('requests only the OpenID Connect scopes', () => {
    process.env.LINKEDIN_CLIENT_ID = 'test-client-id'
    process.env.LINKEDIN_REDIRECT_URI = 'https://shocking-dragon-458.convex.site/auth/linkedin/callback'

    const url = buildAuthUrl('state')
    const scope = new URL(url).searchParams.get('scope') ?? ''
    // Exactly these three (the Standard-tier Sign In / OIDC product). Anything else —
    // w_member_social*, r_basicprofile, or legacy r_liteprofile/r_emailaddress — is
    // Development-tier or ungranted and throws unauthorized_scope_error for members without a
    // role on the app, so this exact match guards the login flow for external users.
    expect(scope).toBe('openid profile email')
  })
})
