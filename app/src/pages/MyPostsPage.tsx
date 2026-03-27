// app/src/pages/MyPostsPage.tsx
import { useQuery } from 'convex/react'
import type { Id } from '../../../convex/_generated/dataModel'
import { api } from '../convex'
import LoadingSpinner from '../components/LoadingSpinner'

// The shape returned by getMyPosts — matches the posts table schema
interface MyPost {
  _id: Id<'posts'>
  linkedinPostUrn: string
  content: string
  publishedAt: number
  likeCount: number
  commentCount: number
  sourceUrl?: string
}

/** Build a LinkedIn embed iframe URL from a ugcPost URN */
function buildEmbedUrl(urn: string): string {
  // Extract numeric ID: urn:li:ugcPost:{id} → urn:li:activity:{id}
  // LinkedIn embed requires activity URN format; colons must NOT be URL-encoded.
  const id = urn.split(':').pop() ?? ''
  return `https://www.linkedin.com/embed/feed/update/urn:li:activity:${id}/`
}

/**
 * Build the "open on LinkedIn" link.
 * Uses the original sourceUrl if we stored it (most accurate).
 * Falls back to reconstructing a /feed/update/ URL for cron-synced posts.
 * NOTE: urn:li:ugcPost IDs and urn:li:activity IDs can differ in LinkedIn's
 * data model, so sourceUrl is always preferred over reconstruction.
 */
function buildLinkedInUrl(post: MyPost): string {
  if (post.sourceUrl) return post.sourceUrl
  // Fallback for cron-synced posts: use the /feed/update/ format with the ugcPost URN.
  // This may not always resolve correctly due to URN type differences.
  return `https://www.linkedin.com/feed/update/${encodeURIComponent(post.linkedinPostUrn)}/`
}

function timeAgo(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

export default function MyPostsPage() {
  const userId = (sessionStorage.getItem('convexUserId') ?? undefined) as Id<'users'> | undefined

  const me = useQuery(api.users.getMe, { userId })
  const posts = useQuery(api.posts.getMyPosts, { userId }) as unknown as MyPost[] | undefined

  if (posts === undefined) {
    return <LoadingSpinner />
  }

  return (
    <div className="mx-auto max-w-[640px] px-4 py-8 font-sans">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">My Posts</h1>

      {/* Profile header */}
      {me && (
        <div className="mb-6 flex items-center gap-3">
          <div className="color-[#94a3b8] flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-700 font-bold">
            {me.name[0]}
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">{me.name}</div>
            <div className="text-xs capitalize text-slate-500">{me.tier} plan</div>
          </div>
        </div>
      )}

      {/* Section header */}
      <div className="mb-3 text-[10px] uppercase tracking-wider text-slate-500">Your posts ({posts.length})</div>

      {/* Post list */}
      {posts.length === 0 ? (
        <div className="border-t border-slate-200 pt-5 text-center">
          <p className="text-[13px] text-slate-500">Add posts from the Feed page composer ↑</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map(post => (
            <div
              key={post._id}
              className="overflow-hidden rounded-lg border border-slate-200 bg-white"
            >
              {/* LinkedIn embed — clipped to hide the Like/Comment/Share button bar */}
              <div className="relative h-[420px] overflow-hidden">
                <iframe
                  src={buildEmbedUrl(post.linkedinPostUrn)}
                  title="LinkedIn post"
                  width="100%"
                  // Render taller than the container so content is visible;
                  // the container's overflow:hidden clips the button bar below.
                  height={480}
                  className="block border-none"
                  allowFullScreen
                  loading="lazy"
                />
                {/* Opaque overlay covering the bottom action buttons strip.
                    Positioned absolute so it sits over the iframe without shifting layout. */}
                <div className="absolute bottom-0 left-0 right-0 flex h-[52px] items-center justify-between border-t border-slate-200 bg-white px-[14px]">
                  {/* Engagement stats from our own tracking data */}
                  <span className="text-xs text-slate-500">
                    👍 {post.likeCount} · 💬 {post.commentCount}
                  </span>
                  <span className="text-xs text-slate-500">
                    {timeAgo(post.publishedAt)} ·{' '}
                    <a
                      href={buildLinkedInUrl(post)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 no-underline"
                    >
                      View on LinkedIn ↗
                    </a>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
