// app/src/pages/MyPostsPage.tsx
import { useQuery } from 'convex/react'
import type { Id } from '../../../convex/_generated/dataModel'
import { api } from '../convex'

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
  const posts = (useQuery(api.posts.getMyPosts, { userId }) ?? []) as MyPost[]

  return (
    <div
      style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: '32px 16px',
        fontFamily: 'system-ui, sans-serif'
      }}
    >
      <h1
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: '#0f172a',
          marginBottom: 24
        }}
      >
        My Posts
      </h1>

      {/* Profile header */}
      {me && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 24
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: '#334155',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              fontWeight: 700
            }}
          >
            {me.name[0]}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{me.name}</div>
            <div style={{ fontSize: 12, color: '#64748b', textTransform: 'capitalize' }}>{me.tier} plan</div>
          </div>
        </div>
      )}

      {/* Section header */}
      <div
        style={{
          fontSize: 10,
          textTransform: 'uppercase',
          color: '#64748b',
          marginBottom: 12,
          letterSpacing: '0.05em'
        }}
      >
        Your posts ({posts.length})
      </div>

      {/* Post list */}
      {posts.length === 0 ? (
        <div
          style={{
            borderTop: '1px solid #e2e8f0',
            paddingTop: 20,
            textAlign: 'center'
          }}
        >
          <p style={{ fontSize: 13, color: '#64748b' }}>Add posts from the Feed page composer ↑</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {posts.map(post => (
            <div
              key={post._id}
              style={{
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                background: '#fff'
              }}
            >
              {/* LinkedIn embed — clipped to hide the Like/Comment/Share button bar */}
              <div
                style={{
                  position: 'relative',
                  // Container height clips the iframe — LinkedIn's action buttons are
                  // ~52px tall at the bottom of the embed, so we hide that strip.
                  // The iframe itself renders at full height; overflow hides the buttons.
                  height: 420,
                  overflow: 'hidden'
                }}
              >
                <iframe
                  src={buildEmbedUrl(post.linkedinPostUrn)}
                  title="LinkedIn post"
                  width="100%"
                  // Render taller than the container so content is visible;
                  // the container's overflow:hidden clips the button bar below.
                  height={480}
                  style={{ border: 'none', display: 'block' }}
                  allowFullScreen
                  loading="lazy"
                />
                {/* Opaque overlay covering the bottom action buttons strip.
                    Positioned absolute so it sits over the iframe without shifting layout. */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 52,
                    background: '#fff',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 14px'
                  }}
                >
                  {/* Engagement stats from our own tracking data */}
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    👍 {post.likeCount} · 💬 {post.commentCount}
                  </span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    {timeAgo(post.publishedAt)} ·{' '}
                    <a
                      href={buildLinkedInUrl(post)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#3b82f6', textDecoration: 'none' }}
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
