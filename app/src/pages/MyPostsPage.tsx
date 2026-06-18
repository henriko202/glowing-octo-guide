// app/src/pages/MyPostsPage.tsx
import { useState } from 'react'
import { useAction, useMutation, useQuery } from 'convex/react'
import type { Id } from '../../../convex/_generated/dataModel'
import { api } from '../convex'

import LoadingSpinner from '../components/LoadingSpinner'
import PostComposer from '../components/PostComposer'
import LinkedInEmbed from '../components/LinkedInEmbed'

// The shape returned by getMyPosts — matches the posts table schema
interface MyPost {
  _id: Id<'posts'>
  linkedinPostUrn: string
  content: string
  publishedAt: number
  likeCount: number
  commentCount: number
  hidden?: boolean
  sourceUrl?: string
}

// The shape returned by getWeeklyUsage (null when not signed in).
interface WeeklyUsage {
  postsThisWeek: number
  postsPerWeek: number
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
  if (days <= 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

export default function MyPostsPage() {
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined

  const me = useQuery(api.users.getMe, { sessionToken })
  const usage = useQuery(api.posts.getWeeklyUsage, { sessionToken }) as WeeklyUsage | null | undefined
  const posts = useQuery(api.posts.getMyPosts, { sessionToken }) as unknown as MyPost[] | undefined
  const submitPost = useAction(api.posts.submitPost)
  const setPostHidden = useMutation(api.posts.setPostHidden)
  const deletePost = useMutation(api.posts.deletePost)

  // Transient error surfaced above the list when a hide/delete action fails.
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleSubmit(postUrl: string) {
    if (!sessionToken) throw new Error('Not signed in')
    await submitPost({ sessionToken, postUrl })
  }

  // Toggle a post's feed visibility. Convex queries are reactive, so getMyPosts
  // re-renders with the new `hidden` state automatically — no manual refetch.
  async function handleToggleHidden(post: MyPost) {
    if (!sessionToken) return
    setActionError(null)
    try {
      await setPostHidden({ sessionToken, postId: post._id, hidden: !post.hidden })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update the post.')
    }
  }

  // Soft-delete: drops the post from the feed and this list. It still counts
  // toward the weekly limit, so we say so in the confirmation.
  async function handleDelete(post: MyPost) {
    if (!sessionToken) return
    const ok = window.confirm(
      'Delete this post? It will be removed from the feed and from My Posts. It still counts toward your weekly post limit.'
    )
    if (!ok) return
    setActionError(null)
    try {
      await deletePost({ sessionToken, postId: post._id })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not delete the post.')
    }
  }

  if (posts === undefined) {
    return <LoadingSpinner />
  }

  // Hit the weekly cap once usage loads and the count meets the plan limit.
  const atLimit = usage != null && usage.postsThisWeek >= usage.postsPerWeek

  return (
    <div className="mx-auto max-w-[640px] px-4 py-8 font-sans">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">My Posts</h1>

      {/* Profile header — with the weekly-usage pill on the right */}
      {me && (
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="color-[#94a3b8] flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-700 font-bold">
              {me.name[0]}
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">{me.name}</div>
              <div className="text-xs capitalize text-slate-500">{me.tier} plan</div>
            </div>
          </div>
          {usage && (
            <span
              title="In the last 7 days"
              className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${
                atLimit ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
              }`}
            >
              {usage.postsThisWeek} of {usage.postsPerWeek} posts this week
            </span>
          )}
        </div>
      )}

      {/* Manual share — copied from the Feed page, re-themed light to match this page.
          Disabled at the weekly limit so we don't trigger a guaranteed-to-fail submit. */}
      <PostComposer
        theme="light"
        atLimit={atLimit}
        limitHint="Weekly limit reached"
        onSubmit={handleSubmit}
      />

      {/* Section header */}
      <div className="mb-3 text-[10px] uppercase tracking-wider text-slate-500">Your posts ({posts.length})</div>

      {/* Transient error from a hide/delete action */}
      {actionError && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {actionError}
        </div>
      )}

      {/* Post list */}
      {posts.length === 0 ? (
        <div className="border-t border-slate-200 pt-5 text-center">
          <p className="text-[13px] text-slate-500">Share your first post using the composer above ↑</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map(post => (
            <div
              key={post._id}
              className={`overflow-hidden rounded-lg border border-slate-200 bg-white ${post.hidden ? 'opacity-60' : ''}`}
            >
              {/* Owner action bar: visibility state + Hide/Unhide + Delete */}
              <div className="flex items-center justify-between border-b border-slate-200 px-[14px] py-2">
                {post.hidden ? (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    Hidden from feed
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">Visible in feed</span>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleHidden(post)}
                    className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    {post.hidden ? 'Unhide' : 'Hide'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(post)}
                    className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <LinkedInEmbed
                urn={post.linkedinPostUrn}
                footer={
                  <div className="flex h-[52px] items-center justify-between border-t border-slate-200 bg-white px-[14px]">
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
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
