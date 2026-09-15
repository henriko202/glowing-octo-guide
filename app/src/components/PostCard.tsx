import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Check, Clock, Loader2, MessageSquare, MessageSquareCheck } from 'lucide-react'
import type { Id } from '../../../convex/_generated/dataModel'
import { REACTIONS, type Reaction } from '../../../convex/lib/reactions'
import type { FeedViewerState } from '../../../convex/lib/feedHygiene'
import type { GateSource } from './CardGateDialog'
import LinkedInEmbed from './LinkedInEmbed'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { medalRing } from '@/lib/medalRing'

export type PostWithAuthor = {
  _id: Id<'posts'>
  linkedinPostUrn: string
  authorId?: Id<'users'>
  content: string
  publishedAt: number
  likeCount: number
  commentCount: number
  mediaUrls: string[]
  isFeatured: boolean
  author: {
    name: string
    headline?: string
    profilePictureUrl?: string
    industry?: string
  } | null
  sourceUrl: string
  suggestedReaction?: Reaction
  /** backlog/R21 — set by feed.getFeed when the viewer already reacted/commented; absent elsewhere. */
  viewerState?: FeedViewerState | null
}

/**
 * The feed's reaction control: a single button that *displays* the post's AI‑suggested reaction
 * (default LIKE) + the live count, with the reaction name in its tooltip — a visual cue of the
 * recommendation. Clicking it hands off to LinkedIn (the parent's onReact opens the post there),
 * so there is no in‑app reaction *picker*: the deep link can't carry a chosen reaction type, so
 * letting the user pick one in‑app would be meaningless. The suggested type is still sent to the
 * backend for the optimistic count.
 */
function ReactionButton({
  postId,
  suggested,
  likeCount,
  onReact,
  gated,
  onGated,
  loading
}: {
  postId: Id<'posts'>
  suggested: Reaction
  likeCount: number
  onReact: (postId: Id<'posts'>, reaction: Reaction) => void
  gated?: boolean
  onGated?: (source: GateSource) => void
  loading?: boolean
}) {
  const { t } = useTranslation()
  const current = REACTIONS.find(r => r.value === suggested) ?? REACTIONS[0]

  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={t('reactions.react')}
      onClick={loading ? undefined : () => (gated ? onGated?.('react') : onReact(postId, current.value))}
      disabled={loading}
      title={t(current.labelKey)}
      className="text-muted-foreground flex h-8 min-h-11 cursor-pointer items-center gap-1 px-2 text-[13px] sm:min-h-8"
    >
      {loading ? (
        <Loader2
          className="h-4 w-4 animate-spin"
          aria-hidden="true"
        />
      ) : (
        <span aria-hidden="true">{current.emoji}</span>
      )}
      <span className="tabular-nums">{likeCount}</span>
    </Button>
  )
}

export default function PostCard({
  post,
  onComment,
  onReact,
  gated,
  onGated,
  reacting,
  onHide,
  authorMedal,
  now: feedNow
}: {
  post: PostWithAuthor
  onComment: (postId: Id<'posts'>) => void
  onReact: (postId: Id<'posts'>, reaction: Reaction) => void
  gated?: boolean
  onGated?: (source: GateSource) => void
  reacting?: boolean
  /** backlog/R21 — "Hide now" on a post the viewer already handled. */
  onHide?: () => void
  /** RCD — medal for the newest 7d board's top-3 poster who authored this card. */
  authorMedal?: 1 | 2 | 3
  now?: number
}) {
  const { t } = useTranslation()
  const [mountedAt] = useState(() => Date.now())
  const now = feedNow ?? mountedAt
  const done = post.viewerState ?? null
  const hoursLeft = done ? Math.min(24, Math.max(1, Math.ceil((done.hidesAt - now) / 3_600_000))) : 0
  const doneLabel =
    done?.reacted && done.commented ? 'feed.doneBoth' : done?.reacted ? 'feed.doneReacted' : 'feed.doneCommented'
  const reaction = REACTIONS.find(r => r.value === (post.suggestedReaction ?? 'LIKE')) ?? REACTIONS[0]

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border font-sans">
      {/* App-owned header: Featured badge + author. The iframe can't render the
          app's Featured concept, so it lives here above the embed. */}
      <div className="p-4 pb-3">
        {post.isFeatured && (
          <Badge
            variant="warning"
            className="mb-2 text-[11px] tracking-wider uppercase"
          >
            {t('feed.featured')}
          </Badge>
        )}

        {post.author && (
          <div className="flex items-center gap-2.5">
            <span
              role={authorMedal ? 'img' : undefined}
              aria-label={authorMedal ? t('rankings.topThreeTitle', { position: authorMedal }) : undefined}
              className="inline-flex"
            >
              <Avatar
                name={post.author.name}
                src={post.author.profilePictureUrl}
                size="md"
                className={medalRing(authorMedal)}
              />
            </span>
            <div>
              <p className="text-foreground m-0 text-sm font-semibold">{post.author.name}</p>
              {(post.author.headline ?? post.author.industry) && (
                <p className="text-muted-foreground m-0 text-xs">{post.author.headline ?? post.author.industry}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* LinkedIn embed. Our own Reaction/Comment bar is overlaid at the bottom,
          covering LinkedIn's clipped native action bar. These buttons drive the
          app's in-app engagement (onReact / onComment), independent of LinkedIn. */}
      <LinkedInEmbed
        urn={post.linkedinPostUrn}
        footer={
          // One fixed-height row on desktop; on small screens the trailing meta/hide/link cluster
          // takes a second row. The layout is the same in every viewer state, so reacting or
          // commenting never reflows the footer or changes its height.
          <div className="border-border bg-card flex flex-wrap items-center gap-x-2 border-t px-4 sm:h-13 sm:flex-nowrap sm:gap-x-3">
            <div className="flex min-w-0 flex-1 items-center gap-x-1 sm:gap-x-2">
              {done?.reacted ? (
                // The reaction stays put after it is recorded, as a checked chip carrying the same
                // emoji + count the button showed, so the leftmost action never moves or vanishes.
                <span
                  className="text-muted-foreground flex h-8 shrink-0 items-center gap-1 px-2 text-[13px]"
                  title={t(doneLabel)}
                >
                  <Check
                    className="size-3.5"
                    aria-hidden="true"
                  />
                  <span aria-hidden="true">{reaction.emoji}</span>
                  <span className="tabular-nums">{post.likeCount}</span>
                  <span className="sr-only">{t(doneLabel)}</span>
                </span>
              ) : (
                <ReactionButton
                  postId={post._id}
                  suggested={post.suggestedReaction ?? 'LIKE'}
                  likeCount={post.likeCount}
                  onReact={onReact}
                  gated={gated}
                  onGated={onGated}
                  loading={reacting}
                />
              )}
              {done?.commented ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onComment(post._id)}
                  title={t('feed.doneCommented')}
                  className="text-muted-foreground h-8 min-h-11 min-w-0 shrink cursor-pointer gap-1.5 px-2 text-[13px] sm:min-h-8"
                >
                  <MessageSquareCheck
                    className="size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="truncate">{t('feed.viewGeneratedComment')}</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={t('feed.comments', { count: post.commentCount })}
                  title={t('feed.comment')}
                  onClick={() => (gated ? onGated?.('comment') : onComment(post._id))}
                  className="text-muted-foreground flex h-8 min-h-11 shrink-0 cursor-pointer items-center gap-1 px-2 text-[13px] sm:min-h-8"
                >
                  <MessageSquare
                    className="size-4"
                    aria-hidden="true"
                  />
                  <span className="tabular-nums">{post.commentCount}</span>
                </Button>
              )}
            </div>

            <div className="flex items-center gap-x-1.5 max-sm:w-full max-sm:justify-end sm:shrink-0 sm:gap-x-3">
              {done && (
                <span className="text-muted-foreground flex items-center gap-1 text-xs whitespace-nowrap">
                  <Clock
                    className="size-3.5"
                    aria-hidden="true"
                  />
                  {t('feed.leavesIn', { hours: hoursLeft })}
                </span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onHide}
                className="text-muted-foreground h-7 min-h-11 shrink-0 cursor-pointer px-2 text-xs sm:min-h-0"
              >
                {done ? t('feed.hideNow') : t('feed.hide')}
              </Button>
              {!!post.sourceUrl && (
                <a
                  href={post.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={
                    gated
                      ? e => {
                          e.preventDefault()
                          onGated?.('linkedin')
                        }
                      : undefined
                  }
                  className="shrink-0 whitespace-nowrap text-gold-text no-underline hover:underline"
                >
                  {t('feed.viewOnLinkedIn')}
                </a>
              )}
            </div>
          </div>
        }
      />
    </div>
  )
}
