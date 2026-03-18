// LinkedIn API response types

export interface LinkedInProfile {
  id: string
  localizedFirstName: string
  localizedLastName: string
  headline?: string
  profilePicture?: {
    'displayImage~'?: {
      elements?: Array<{
        identifiers?: Array<{ identifier: string }>
      }>
    }
  }
}

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

export interface LinkedInUGCPostMedia {
  originalUrl?: string
}

export interface LinkedInUGCPost {
  id: string
  specificContent?: {
    'com.linkedin.ugc.ShareContent'?: {
      shareCommentary?: { text: string }
      shareMediaCategory?: string
      media?: LinkedInUGCPostMedia[]
    }
  }
  created?: { time: number }
  socialDetail?: {
    totalSocialActivityCounts?: {
      numLikes?: number
      numComments?: number
    }
  }
}

export interface LinkedInUGCPostsResponse {
  elements?: LinkedInUGCPost[]
}

export interface LinkedInConnectionElement {
  connectedMember?: string | null
}

export interface LinkedInConnectionsResponse {
  elements?: LinkedInConnectionElement[]
}
