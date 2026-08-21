import { query } from './_generated/server'
import { v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import { requireAuth } from './lib/auth'
import { toFeedAuthor, isAuthorFeedEligible } from './feed'

const MAX_POSTS = 8
const MAX_PEOPLE = 6

/**
 * Pure allow-list projection of a person for search results. Returns ONLY safe display
 * fields — never tokens, admin/ban state, or any other PII. Allow-list (not deny-list) so
 * new user schema fields never leak into search by default. Mirrors toFeedAuthor's contract.
 */
export function toSearchPerson(u: Doc<'users'>) {
  return {
    _id: u._id,
    name: u.name,
    headline: u.headline,
    profilePictureUrl: u.profilePictureUrl,
    linkedinPublicIdentifier: u.linkedinPublicIdentifier
  }
}

/**
 * Command-palette search over posts (by content) and people (by name). Requires a valid
 * session. Post results honor the SAME visibility + author-eligibility rules as getFeed
 * (convex/feed.ts) so search can't become a bypass around the feed's access controls.
 */
export const search = query({
  args: { sessionToken: v.optional(v.string()), queryText: v.string() },
  handler: async (ctx, { sessionToken, queryText }) => {
    const text = queryText.trim()
    if (!sessionToken || text.length < 2) return { posts: [], people: [] }

    let viewer: Doc<'users'>
    try {
      viewer = await requireAuth(ctx, sessionToken)
    } catch {
      return { posts: [], people: [] }
    }

    // Posts: full-text matches already pinned to inFeed=true by the search index, then the
    // same per-viewer visibility + author-eligibility filters getFeed applies. Over-fetch so
    // the post-filter drops don't starve the result set.
    const rawPosts = await ctx.db
      .query('posts')
      .withSearchIndex('search_content', q => q.search('content', text).eq('inFeed', true))
      .take(MAX_POSTS * 3)

    const authorIds = [...new Set(rawPosts.map(p => p.authorId))]
    const authors = await Promise.all(authorIds.map(id => ctx.db.get(id)))
    const authorMap = new Map(authors.filter((a): a is Doc<'users'> => a !== null).map(a => [a._id, a]))

    const now = Date.now()
    const posts = rawPosts
      .filter(post => {
        if (post.visibilityIndustries.length > 0) {
          if (!viewer.industry || !post.visibilityIndustries.includes(viewer.industry)) return false
        }
        if (post.visibilityCountries.length > 0) {
          if (!viewer.country || !post.visibilityCountries.includes(viewer.country)) return false
        }
        return isAuthorFeedEligible(authorMap.get(post.authorId) ?? null, now)
      })
      .slice(0, MAX_POSTS)
      .map(post => {
        const author = authorMap.get(post.authorId)
        return {
          _id: post._id,
          content: post.content,
          sourceUrl: post.sourceUrl,
          author: author ? toFeedAuthor(author) : null
        }
      })

    const people = (
      await ctx.db
        .query('users')
        .withSearchIndex('search_name', q => q.search('name', text))
        .take(MAX_PEOPLE)
    ).map(toSearchPerson)

    return { posts, people }
  }
})
