import { query, type QueryCtx } from './_generated/server'
import { v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import { requireAuth } from './lib/auth'
import { toFeedAuthor, isPostVisibleToViewer, isAuthorFeedEligible } from './feed'

const MAX_POSTS = 8
const MAX_PEOPLE = 6
// Upper bound on the search box input. Full-text search consumes any string safely (no injection),
// so this is a resource guard only — a pathologically long query is treated as no query.
const MAX_QUERY_LENGTH = 200

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
    if (!sessionToken || text.length < 2 || text.length > MAX_QUERY_LENGTH) return { posts: [], people: [] }

    let viewer: Doc<'users'>
    try {
      viewer = await requireAuth(ctx, sessionToken)
    } catch {
      return { posts: [], people: [] }
    }

    // Server clock required for the lapsed-author eligibility gate below — this mirrors the
    // documented feed exception (getFeed reads its own Date.now()): do NOT take `now` from the
    // client, or a direct caller could pass `now: 0` to surface canceled-and-lapsed authors.
    return searchPostsAndPeople(ctx, viewer, { text, now: Date.now() })
  }
})

/**
 * Runs the command-palette search for `viewer`. Split out of the `search` wrapper so the filtering
 * is unit-testable with a mock `ctx` (the query wrapper isn't callable in unit tests). The wrapper
 * owns auth + the min-length guard and supplies the server clock; the explicit `now` param exists
 * for unit tests only — it is never client-supplied (see the `search` wrapper).
 */
export async function searchPostsAndPeople(ctx: QueryCtx, viewer: Doc<'users'>, opts: { text: string; now: number }) {
  const { text, now } = opts

  // Posts: full-text matches already pinned to inFeed=true by the search index, then the SAME
  // per-viewer gate getFeed applies (isPostVisibleToViewer: own-post, visibility, eligibility) so
  // search can't bypass the feed's access controls. Over-fetch so the drops don't starve results.
  const rawPosts = await ctx.db
    .query('posts')
    .withSearchIndex('search_content', q => q.search('content', text).eq('inFeed', true))
    .take(MAX_POSTS * 3)

  const authorIds = [...new Set(rawPosts.map(p => p.authorId))]
  const authors = await Promise.all(authorIds.map(id => ctx.db.get(id)))
  const authorMap = new Map(authors.filter((a): a is Doc<'users'> => a !== null).map(a => [a._id, a]))

  const posts = rawPosts
    .filter(post => isPostVisibleToViewer(post, viewer, authorMap.get(post.authorId) ?? null, now))
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

  // People: hide anyone the feed also hides (banned, pending-deletion, canceled-and-lapsed) via the
  // SAME isAuthorFeedEligible rule the post results use, so moderation is consistent across both.
  // Over-fetch then slice so the eligibility drops don't starve the result count.
  const people = (
    await ctx.db
      .query('users')
      .withSearchIndex('search_name', q => q.search('name', text))
      .take(MAX_PEOPLE * 3)
  )
    .filter(u => isAuthorFeedEligible(u, now))
    .slice(0, MAX_PEOPLE)
    .map(toSearchPerson)

  return { posts, people }
}
