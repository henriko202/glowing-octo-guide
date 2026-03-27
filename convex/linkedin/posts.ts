// convex/linkedin/posts.ts
import type { LinkedInUGCPost, LinkedInUGCPostsResponse } from './types.js'

export interface ParsedPost {
  linkedinPostUrn: string
  content: string
  publishedAt: number
  likeCount: number
  commentCount: number
  mediaUrls: string[]
}

export function parseLinkedInPost(raw: LinkedInUGCPost): ParsedPost {
  const share = raw.specificContent?.['com.linkedin.ugc.ShareContent']
  const content = share?.shareCommentary?.text ?? ''
  const mediaUrls: string[] = (share?.media ?? [])
    .map(m => m?.originalUrl)
    .filter((url): url is string => typeof url === 'string' && url.length > 0)

  const counts = raw.socialDetail?.totalSocialActivityCounts ?? {}
  return {
    linkedinPostUrn: raw.id,
    content,
    publishedAt: raw.created?.time ?? Date.now(),
    likeCount: counts.numLikes ?? 0,
    commentCount: counts.numComments ?? 0,
    mediaUrls
  }
}

/**
 * Diagnostic probe — calls memberCreatorPostAnalytics?q=me for the rolling
 * last 7 days and logs the raw JSON response. Used to discover what LinkedIn
 * actually returns with our Partner API access (especially post URNs/links).
 * Remove or replace once we know the response shape.
 */
export async function probePostAnalyticsAPI(accessToken: string): Promise<void> {
  const today = new Date()
  const sevenDaysAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000)

  const dateRange = [
    `start:(day:${sevenDaysAgo.getUTCDate()},month:${sevenDaysAgo.getUTCMonth() + 1},year:${sevenDaysAgo.getUTCFullYear()})`,
    `end:(day:${today.getUTCDate()},month:${today.getUTCMonth() + 1},year:${today.getUTCFullYear()})`
  ].join(',')

  const url = `https://api.linkedin.com/rest/memberCreatorPostAnalytics?q=me&queryType=MEMBERS_REACHED&aggregation=TOTAL&dateRange=(${dateRange})`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'LinkedIn-Version': '202603',
      'X-Restli-Protocol-Version': '2.0.0'
    }
  })

  const body = await res.text()
  console.log(`[probePostAnalyticsAPI] status=${res.status} body=${body}`)
}

// Returns null when the r_member_social scope has not been granted (403).
// The caller should treat null as "skip silently" rather than an error.
// r_member_social requires LinkedIn Marketing Developer Platform (MDP) approval —
// until approved, post syncing will be a no-op for all users.
export async function fetchUserPosts(accessToken: string, linkedinPersonId: string): Promise<ParsedPost[] | null> {
  const authorUrn = encodeURIComponent(`urn:li:person:${linkedinPersonId}`)
  const res = await fetch(`https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(${authorUrn})&count=20`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0'
    }
  })
  if (res.status === 403) {
    // r_member_social scope not granted — needs LinkedIn MDP approval
    return null
  }
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Posts fetch failed: ${res.status} — ${body}`)
  }
  const data = (await res.json()) as LinkedInUGCPostsResponse
  return (data.elements ?? []).map(parseLinkedInPost)
}
