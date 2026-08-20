// LinkedIn API response types

export interface LinkedInTokenResponse {
  access_token: string
  refresh_token?: string // Only returned for some LinkedIn app configs (MDP / enterprise)
  expires_in: number
}

// OpenID Connect userinfo response (/v2/userinfo) — returned by the
// "Sign In with LinkedIn using OpenID Connect" product (default for new apps)
export interface LinkedInUserInfo {
  sub: string // LinkedIn member ID (replaces profile.id from legacy /v2/me)
  name: string // Full name
  given_name: string
  family_name: string
  picture?: string // Profile picture URL
  email?: string
  email_verified?: boolean
  locale?: { country: string; language: string }
}
