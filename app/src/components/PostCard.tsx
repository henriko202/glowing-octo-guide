import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Loader2, MessageSquare } from 'lucide-react'
import type { Id } from '../../../convex/_generated/dataModel'
import { REACTIONS, type Reaction } from '../../../convex/lib/reactions'
import type { FeedViewerState } from '../../../convex/lib/feedHygiene'
import type { GateSource } from './CardGateDialog'
import LinkedInEmbed from './LinkedInEmbed'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export type PostWithAuthor = {
  _id: Id<'posts'>
  linkedinPostUrn: string
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
      className="text-muted-foreground flex cursor-pointer items-center gap-1 text-[13px]"
    >
      {loading ? (
        <Loader2
          className="h-4 w-4 animate-spin"
          aria-hidden="true"
        />
      ) : (
        <span aria-hidden="true">{current.emoji}</span>
      )}{' '}
      {likeCount}
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
  now?: number
}) {
  const { t } = useTranslation()
  const [mountedAt] = useState(() => Date.now())
  const now = feedNow ?? mountedAt
  const done = post.viewerState ?? null
  const hoursLeft = done ? Math.min(24, Math.max(1, Math.ceil((done.hidesAt - now) / 3_600_000))) : 0
  const doneLabel =
    done?.reacted && done.commented ? 'feed.doneBoth' : done?.reacted ? 'feed.doneReacted' : 'feed.doneCommented'

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
            <Avatar
              name={post.author.name}
              src={post.author.profilePictureUrl}
              size="md"
            />
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
          <div className="border-border bg-card flex min-h-[52px] flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-1.5">
            {!done?.reacted && (
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
                className="text-muted-foreground min-h-11 cursor-pointer text-[13px]"
              >
                <MessageSquare
                  className="size-4"
                  aria-hidden="true"
                />
                {t('feed.viewGeneratedComment')}
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={() => (gated ? onGated?.('comment') : onComment(post._id))}
                className="text-muted-foreground flex cursor-pointer items-center gap-1 text-[13px]"
              >
                💬 {post.commentCount} {t('feed.comment')}
              </Button>
            )}
            {done && (
              // The ✓ trails the controls it describes, so the react button keeps its place as the
              // leftmost action whether or not the viewer has interacted.
              <span className="text-muted-foreground text-[13px]">
                <span aria-hidden="true">✓</span> {t(doneLabel)}
              </span>
            )}

            {!!post.sourceUrl &&
              (gated ? (
                <a
                  href={post.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => {
                    e.preventDefault()
                    onGated?.('linkedin')
                  }}
                  className="ml-auto text-gold-text no-underline hover:underline"
                >
                  {t('feed.viewOnLinkedIn')}
                </a>
              ) : (
                <a
                  href={post.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-gold-text no-underline hover:underline"
                >
                  {t('feed.viewOnLinkedIn')}
                </a>
              ))}

            {done ? (
              // No ml-auto here: the LinkedIn link above already carries one, and two of them
              // split the free space and strand the link mid-row.
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">{t('feed.leavesIn', { hours: hoursLeft })}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onHide}
                  className="text-muted-foreground h-7 min-h-11 cursor-pointer px-2 text-xs sm:min-h-0"
                >
                  {t('feed.hideNow')}
                </Button>
              </span>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onHide}
                className="text-muted-foreground h-7 min-h-11 cursor-pointer px-2 text-xs sm:min-h-0"
              >
                {t('feed.hide')}
              </Button>
            )}
          </div>
        }
      />
    </div>
  )
}
