// Bounded visible-post counting shared by the people and ranking reads: getMyRankings, listPeopleIInteractedWith
// and the site board's member `postsCount` all read at most POSTS_COUNT_CAP of an author's newest in-window posts.
import type { QueryCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'

/** Posts read per author when counting their window posts; the 500 cap bounds the read. */
export const POSTS_COUNT_CAP = 500

/** The author's visible posts published since `since`, respecting the POSTS_COUNT_CAP bound. */
export async function countVisiblePostsSince(ctx: QueryCtx, authorId: Id<'users'>, since: number): Promise<number> {
  const posts = await ctx.db
    .query('posts')
    .withIndex('by_author_and_publishedAt', q => q.eq('authorId', authorId).gte('publishedAt', since))
    .order('desc')
    .take(POSTS_COUNT_CAP)
  return posts.filter(p => p.hidden !== true && p.deletedAt === undefined).length
}
