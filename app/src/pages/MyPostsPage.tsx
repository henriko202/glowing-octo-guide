// app/src/pages/MyPostsPage.tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAction, useMutation, useQuery } from 'convex/react'
import type { Id } from '../../../convex/_generated/dataModel'
import { api } from '../convex'

import { PageHeader } from '@/components/PageHeader'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '../components/LoadingSpinner'
import PostComposer from '../components/PostComposer'
import LinkedInEmbed, { buildPostUrl } from '../components/LinkedInEmbed'

// The shape returned by getMyPosts — matches the posts table schema
interface MyPost {
  _id: Id<'posts'>
  linkedinPostUrn: string
  content: string
  publishedAt: number
  likeCount: number
  commentCount: number
  hidden?: boolean
  isFeatured?: boolean
  sourceUrl?: string
}

// The shape returned by getWeeklyUsage (null when not signed in).
interface WeeklyUsage {
  postsThisWeek: number
  postsPerWeek: number
}

// The shape returned by getFeaturedUsage (null when not signed in).
interface FeaturedUsage {
  usedCount: number
  featuredPerMonth: number
}

function timeAgo(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

export default function MyPostsPage() {
  const { t } = useTranslation()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined

  const me = useQuery(api.users.getMe, { sessionToken })
  const usage = useQuery(api.posts.getWeeklyUsage, { sessionToken }) as WeeklyUsage | null | undefined
  const featuredUsage = useQuery(api.posts.getFeaturedUsage, { sessionToken }) as FeaturedUsage | null | undefined
  const posts = useQuery(api.posts.getMyPosts, { sessionToken }) as unknown as MyPost[] | undefined
  const submitPost = useAction(api.posts.submitPost)
  const setPostHidden = useMutation(api.posts.setPostHidden)
  const deletePost = useMutation(api.posts.deletePost)
  const featurePost = useMutation(api.posts.featurePost)
  const unfeaturePost = useMutation(api.posts.unfeaturePost)

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

  // Feature/unfeature toggle. Featuring is quota-gated server-side (getFeaturedUsage
  // backs the disabled state below), but we still catch here since the cap can tick
  // over between render and click. No optimistic update needed — getFeaturedUsage and
  // getMyPosts are both reactive Convex queries, so the pill and badge update together
  // once the mutation commits.
  async function handleToggleFeatured(post: MyPost) {
    if (!sessionToken) return
    setActionError(null)
    try {
      if (post.isFeatured) {
        await unfeaturePost({ sessionToken, postId: post._id })
      } else {
        await featurePost({ sessionToken, postId: post._id })
      }
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
  // Hit the monthly featured cap — mirrors the same >= boundary featurePost enforces
  // server-side (isFeaturedLimitReached), so the button disables in lockstep with the API.
  const featuredAtCap = featuredUsage != null && featuredUsage.usedCount >= featuredUsage.featuredPerMonth

  return (
    <div className="mx-auto max-w-[640px] px-4 py-8 font-sans">
      <PageHeader title={t('nav.myPosts')} />

      {/* Profile header — with the weekly-usage + featured-usage pills on the right.
          flex-wrap on both the outer row and the pill group so the pills stack as whole
          units (never mid-label) instead of overflowing on narrow screens. */}
      {me && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar
              name={me.name}
              src={me.profilePictureUrl}
              size="md"
            />
            <div>
              <div className="text-foreground text-sm font-semibold">{me.name}</div>
              <div className="text-muted-foreground text-xs capitalize">{me.tier} plan</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {usage && (
              <Badge
                title="In the last 7 days"
                variant={atLimit ? 'warning' : 'primary'}
                className="shrink-0 rounded-full px-3 py-1 text-xs"
              >
                {usage.postsThisWeek} of {usage.postsPerWeek} posts this week
              </Badge>
            )}
            {featuredUsage && (
              <Badge
                title={t('myPosts.featuredPillHint')}
                variant={featuredAtCap ? 'warning' : 'primary'}
                className="shrink-0 rounded-full px-3 py-1 text-xs"
              >
                {/* featuredPerMonth >= 999 is the contact/enterprise "unlimited" sentinel
                    (see convex/lib/planLimits.ts DEFAULTS.contact) — never show the raw
                    number to the user. */}
                {featuredUsage.featuredPerMonth >= 999
                  ? t('myPosts.featuredPillUnlimited', { used: featuredUsage.usedCount })
                  : t('myPosts.featuredPill', { used: featuredUsage.usedCount, limit: featuredUsage.featuredPerMonth })}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Manual share — copied from the Feed page, re-themed light to match this page.
          Disabled at the weekly limit so we don't trigger a guaranteed-to-fail submit. */}
      <PostComposer
        atLimit={atLimit}
        limitHint="Weekly limit reached"
        onSubmit={handleSubmit}
      />

      {/* Section header */}
      <div className="text-muted-foreground mb-3 text-[10px] tracking-wider uppercase">Your posts ({posts.length})</div>

      {/* Transient error from a hide/delete action */}
      {actionError && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mb-3 rounded-md border px-3 py-2 text-xs">
          {actionError}
        </div>
      )}

      {/* Post list */}
      {posts.length === 0 ? (
        <div className="border-border border-t pt-5 text-center">
          <p className="text-muted-foreground text-[13px]">Share your first post using the composer above ↑</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map(post => (
            <div
              key={post._id}
              className={`border-border bg-card overflow-hidden rounded-lg border ${post.hidden ? 'opacity-60' : ''}`}
            >
              {/* Owner action bar: visibility/featured state + Feature/Unfeature + Hide/Unhide + Delete.
                  flex-wrap on both sides guards against overflow if translated labels run long. */}
              <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-[14px] py-2">
                <div className="flex flex-wrap items-center gap-2">
                  {post.isFeatured && (
                    <Badge
                      variant="warning"
                      className="rounded-full px-2 py-0.5 text-[11px]"
                    >
                      {t('feed.featured')}
                    </Badge>
                  )}
                  {post.hidden ? (
                    <Badge
                      variant="warning"
                      className="rounded-full px-2 py-0.5 text-[11px]"
                    >
                      Hidden from feed
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-[11px]">Visible in feed</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-pressed={post.isFeatured ?? false}
                    disabled={!post.isFeatured && featuredAtCap}
                    title={!post.isFeatured && featuredAtCap ? t('myPosts.featureLimitReached') : undefined}
                    onClick={() => handleToggleFeatured(post)}
                  >
                    {post.isFeatured ? t('myPosts.unfeature') : t('myPosts.feature')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleHidden(post)}
                  >
                    {post.hidden ? 'Unhide' : 'Hide'}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(post)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
              <LinkedInEmbed
                urn={post.linkedinPostUrn}
                footer={
                  <div className="border-border bg-card flex h-[52px] items-center justify-between border-t px-[14px]">
                    {/* Engagement stats from our own tracking data */}
                    <span className="text-muted-foreground text-xs">
                      👍 {post.likeCount} · 💬 {post.commentCount}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {timeAgo(post.publishedAt)} ·{' '}
                      <a
                        href={buildPostUrl(post.linkedinPostUrn, post.sourceUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gold-text no-underline hover:underline"
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
