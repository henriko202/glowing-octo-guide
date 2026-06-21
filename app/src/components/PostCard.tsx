import { useTranslation } from 'react-i18next'
import type { Id } from '../../../convex/_generated/dataModel'
import { REACTIONS, type Reaction } from '../../../convex/lib/reactions'
import { HoverCard, HoverCardContent, HoverCardTrigger } from './ui/hover-card'
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
}

/**
 * The row of six reaction buttons shown inside the picker flyout. Pure + exported so the
 * selection behaviour is unit-testable without driving the Radix HoverCard (which is
 * hover/pointer-only and does not open in jsdom). Selecting one calls onSelect(reaction).
 */
export function ReactionOptions({
  suggested,
  onSelect,
  gated
}: {
  suggested: Reaction
  onSelect: (reaction: Reaction) => void
  gated?: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="flex gap-1">
      {REACTIONS.map(r => (
        <button
          key={r.value}
          type="button"
          aria-pressed={r.value === suggested}
          title={gated ? t('feed.cardGate') : t(r.labelKey)}
          onClick={gated ? undefined : () => onSelect(r.value)}
          disabled={gated}
          className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border text-lg outline-none ${r.value === suggested ? 'border-primary ring-ring ring-2' : 'hover:bg-muted border-transparent'} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <span aria-hidden="true">{r.emoji}</span>
          <span className="sr-only">{t(r.labelKey)}</span>
        </button>
      ))}
    </div>
  )
}

/**
 * LinkedIn-style reaction control. The trigger shows the post's AI-suggested reaction (default
 * LIKE) and the live count; clicking it reacts with that suggestion (the keyboard/click path).
 * Hovering it opens a Radix HoverCard with all six reactions (the suggestion pre-highlighted) so
 * the viewer can pick another — the HoverCard's close-delay bridges the gap to the flyout.
 */
function ReactionPicker({
  postId,
  suggested,
  likeCount,
  onReact,
  gated
}: {
  postId: Id<'posts'>
  suggested: Reaction
  likeCount: number
  onReact: (postId: Id<'posts'>, reaction: Reaction) => void
  gated?: boolean
}) {
  const { t } = useTranslation()
  const current = REACTIONS.find(r => r.value === suggested) ?? REACTIONS[0]

  return (
    <HoverCard
      openDelay={150}
      closeDelay={150}
    >
      <HoverCardTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label={t('reactions.react')}
          onClick={gated ? undefined : () => onReact(postId, current.value)}
          disabled={gated}
          title={gated ? t('feed.cardGate') : undefined}
          className="text-muted-foreground flex cursor-pointer items-center gap-1 text-[13px]"
        >
          <span aria-hidden="true">{current.emoji}</span> {likeCount}
        </Button>
      </HoverCardTrigger>
      {!gated && (
        <HoverCardContent
          side="top"
          align="start"
          className="p-1"
        >
          <ReactionOptions
            suggested={suggested}
            onSelect={r => onReact(postId, r)}
            gated={gated}
          />
        </HoverCardContent>
      )}
    </HoverCard>
  )
}

export default function PostCard({
  post,
  onComment,
  onReact,
  gated
}: {
  post: PostWithAuthor
  onComment: (postId: Id<'posts'>) => void
  onReact: (postId: Id<'posts'>, reaction: Reaction) => void
  gated?: boolean
}) {
  const { t } = useTranslation()

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border font-sans">
      {/* App-owned header: Featured badge + author. The iframe can't render the
          app's Featured concept, so it lives here above the embed. */}
      <div className="p-4 pb-3">
        {post.isFeatured && (
          <Badge
            variant="warning"
            className="mb-2 text-[11px] uppercase tracking-wider"
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
          <div className="border-border bg-card flex h-[52px] items-center gap-4 border-t px-4">
            <ReactionPicker
              postId={post._id}
              suggested={post.suggestedReaction ?? 'LIKE'}
              likeCount={post.likeCount}
              onReact={onReact}
              gated={gated}
            />
            <Button
              type="button"
              variant="ghost"
              onClick={gated ? undefined : () => onComment(post._id)}
              disabled={gated}
              title={gated ? t('feed.cardGate') : undefined}
              className="text-muted-foreground flex cursor-pointer items-center gap-1 text-[13px]"
            >
              💬 {post.commentCount} {t('feed.comment')}
            </Button>

            {!!post.sourceUrl &&
              (gated ? (
                <button
                  type="button"
                  disabled
                  title={t('feed.cardGate')}
                  className="text-gold-text cursor-not-allowed opacity-50"
                >
                  View on LinkedIn ↗
                </button>
              ) : (
                <a
                  href={post.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gold-text no-underline hover:underline"
                >
                  View on LinkedIn ↗
                </a>
              ))}
          </div>
        }
      />
    </div>
  )
}
