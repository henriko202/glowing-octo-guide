import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import type { Id } from '../../../convex/_generated/dataModel'
import { REACTIONS, type Reaction } from '../../../convex/lib/reactions'
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
  reacting
}: {
  post: PostWithAuthor
  onComment: (postId: Id<'posts'>) => void
  onReact: (postId: Id<'posts'>, reaction: Reaction) => void
  gated?: boolean
  onGated?: (source: GateSource) => void
  reacting?: boolean
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
          <div className="border-border bg-card flex h-[52px] items-center gap-4 border-t px-4">
            <ReactionButton
              postId={post._id}
              suggested={post.suggestedReaction ?? 'LIKE'}
              likeCount={post.likeCount}
              onReact={onReact}
              gated={gated}
              onGated={onGated}
              loading={reacting}
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => (gated ? onGated?.('comment') : onComment(post._id))}
              className="text-muted-foreground flex cursor-pointer items-center gap-1 text-[13px]"
            >
              💬 {post.commentCount} {t('feed.comment')}
            </Button>

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
          </div>
        }
      />
    </div>
  )
}
