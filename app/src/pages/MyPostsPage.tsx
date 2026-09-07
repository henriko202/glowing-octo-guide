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
import Modal from '../components/Modal'
import PostComposer from '../components/PostComposer'
import LinkedInEmbed, { buildPostUrl } from '../components/LinkedInEmbed'
import PlanUsagePills, { type FeaturedUsage, type WeeklyUsage } from '@/components/PlanUsagePills'
import UpgradeAtLimit from '../components/UpgradeAtLimit'
import { friendlyError, mapLimitError } from '@/lib/errors'
import { timeAgo } from '@/lib/relativeDay'

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
  // Set when this post's engagement met the author's per-post interaction cap and it left the
  // feed (convex/posts.ts:439,473,533,567 — Option A, total engagement counts toward the cap).
  interactionLimitReached?: boolean
}

export default function MyPostsPage() {
  const { t } = useTranslation()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined

  const me = useQuery(api.users.getMe, { sessionToken })
  const usage = useQuery(api.posts.getWeeklyUsage, { sessionToken }) as WeeklyUsage | null | undefined
  const featuredUsage = useQuery(api.posts.getFeaturedUsage, { sessionToken }) as FeaturedUsage | null | undefined
  // Current tier's interaction cap, for the "reached N interactions" badge below — a post's own
  // cap isn't stored (it's evaluated against the author's tier at write time), so this shows the
  // CURRENT tier limit, same convention as getFeaturedUsage/getWeeklyUsage above.
  const tierLimits = useQuery(api.posts.getTierLimits, {})
  const posts = useQuery(api.posts.getMyPosts, { sessionToken }) as unknown as MyPost[] | undefined
  const submitPost = useAction(api.posts.submitPost)
  const setPostHidden = useMutation(api.posts.setPostHidden)
  const deletePost = useMutation(api.posts.deletePost)
  const featurePost = useMutation(api.posts.featurePost)
  const unfeaturePost = useMutation(api.posts.unfeaturePost)

  // Transient error surfaced above the list when a hide/delete action fails.
  const [actionError, setActionError] = useState<string | null>(null)
  // The post awaiting delete confirmation in the themed Dialog below (null = closed).
  const [confirmDeletePost, setConfirmDeletePost] = useState<MyPost | null>(null)

  async function handleSubmit(postUrl: string) {
    if (!sessionToken) throw new Error(t('auth.notSignedIn'))
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
      setActionError(friendlyError(err, t('myPosts.updateError')))
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
      setActionError(mapLimitError(friendlyError(err, t('myPosts.updateError')), t))
    }
  }

  // Soft-delete: drops the post from the feed and this list. It still counts
  // toward the weekly limit, so we say so in the confirmation dialog opened here.
  function handleDelete(post: MyPost) {
    if (!sessionToken) return
    setConfirmDeletePost(post)
  }

  // Runs once the user confirms in the Dialog (see render below). Closes the dialog
  // immediately — matching the fire-and-forget style of handleToggleHidden/
  // handleToggleFeatured above — and surfaces any failure in the same error banner.
  async function handleConfirmDelete() {
    if (!sessionToken || !confirmDeletePost) return
    const postId = confirmDeletePost._id
    setConfirmDeletePost(null)
    setActionError(null)
    try {
      await deletePost({ sessionToken, postId })
    } catch (err) {
      setActionError(friendlyError(err, t('myPosts.deleteError')))
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
    <div className="mx-auto max-w-160 px-4 py-8 font-sans">
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
              <div className="text-muted-foreground text-xs capitalize">{t('myPosts.tierPlan', { tier: me.tier })}</div>
            </div>
          </div>
          <PlanUsagePills
            usage={usage}
            featuredUsage={featuredUsage}
          />
        </div>
      )}

      {/* Upgrade ask at the moment of the featured cap (backlog/R08) — under the pill row, not
          inside the pill itself, so the pill stays a short badge. Only for a plan that includes
          featured posts at all: on Starter (0/month) `featuredAtCap` is 0 >= 0 on every visit, and
          an ask that fires on page load is an interruption, not a limit moment. Starter meets the
          featured ask where it binds — the Feature button's own disabled state. */}
      {featuredUsage != null && featuredAtCap && featuredUsage.featuredPerMonth > 0 && (
        <p className="text-muted-foreground mb-6 text-[13px]">
          <UpgradeAtLimit limit="featured" />
        </p>
      )}

      {/* Manual share — copied from the Feed page, re-themed light to match this page.
          Disabled at the weekly limit so we don't trigger a guaranteed-to-fail submit. */}
      <PostComposer
        atLimit={atLimit}
        limitHint={<UpgradeAtLimit limit="weeklyPosts" />}
        onSubmit={handleSubmit}
      />

      {/* Section header */}
      <div className="text-muted-foreground mb-3 text-[10px] tracking-wider uppercase">
        {t('myPosts.heading', { count: posts.length })}
      </div>

      {/* Transient error from a hide/delete action */}
      {actionError && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mb-3 rounded-md border px-3 py-2 text-xs">
          {actionError}
        </div>
      )}

      {/* Post list */}
      {posts.length === 0 ? (
        <div className="border-border border-t pt-5 text-center">
          <p className="text-muted-foreground text-[13px]">{t('myPosts.emptyState')}</p>
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
              <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-3.5 py-2">
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
                      {t('myPosts.hiddenFromFeed')}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-[11px]">{t('myPosts.visibleInFeed')}</span>
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
                    className="cursor-pointer"
                  >
                    {post.isFeatured ? t('myPosts.unfeature') : t('myPosts.feature')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleHidden(post)}
                    className="cursor-pointer"
                  >
                    {post.hidden ? t('myPosts.unhide') : t('myPosts.hide')}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(post)}
                    className="cursor-pointer"
                  >
                    {t('myPosts.delete')}
                  </Button>
                </div>
              </div>
              {/* Interaction cap reached — the post left the feed silently (no toast, no notice on
                  the next feed visit); this row is the only place it's surfaced. */}
              {post.interactionLimitReached && me && tierLimits && (
                <div className="border-border flex flex-wrap items-center gap-2 border-b px-3.5 py-2">
                  <Badge
                    variant="warning"
                    className="rounded-full px-2 py-0.5 text-[11px]"
                  >
                    {t('myPosts.interactionCapBadge', { limit: tierLimits[me.tier ?? 'starter'].interactionsPerPost })}
                  </Badge>
                  <span className="text-muted-foreground text-[11px]">
                    <UpgradeAtLimit limit="interactionCap" />
                  </span>
                </div>
              )}
              <LinkedInEmbed
                urn={post.linkedinPostUrn}
                footer={
                  <div className="border-border bg-card flex h-13 items-center justify-between border-t px-3.5">
                    {/* Engagement stats from our own tracking data */}
                    <span className="text-muted-foreground text-xs">
                      👍 {post.likeCount} · 💬 {post.commentCount}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {timeAgo(post.publishedAt, t)} ·{' '}
                      <a
                        href={buildPostUrl(post.linkedinPostUrn, post.sourceUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gold-text no-underline hover:underline"
                      >
                        {t('feed.viewOnLinkedIn')}
                      </a>
                    </span>
                  </div>
                }
              />
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation — themed Dialog replacing window.confirm. Radix handles the
          focus trap, focus restore, and Escape/overlay dismiss; Cancel sits first in the DOM
          so it receives initial focus (safe default for a destructive dialog). */}
      {confirmDeletePost && (
        <Modal
          onClose={() => setConfirmDeletePost(null)}
          title={t('myPosts.delete')}
        >
          <p className="text-foreground m-0 text-sm">{t('myPosts.deleteConfirm')}</p>
          <div className="mt-5 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer"
              onClick={() => setConfirmDeletePost(null)}
            >
              {t('privacy.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="cursor-pointer"
              onClick={() => void handleConfirmDelete()}
            >
              {t('myPosts.delete')}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
