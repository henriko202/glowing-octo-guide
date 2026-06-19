import { useTranslation } from 'react-i18next'
import type { Id } from '../../../convex/_generated/dataModel'
import { REACTIONS, type Reaction } from '../../../convex/lib/reactions'
import { HoverCard, HoverCardContent, HoverCardTrigger } from './ui/hover-card'
import LinkedInEmbed from './LinkedInEmbed'

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
  onSelect
}: {
  suggested: Reaction
  onSelect: (reaction: Reaction) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex gap-1">
      {REACTIONS.map(r => (
        <button
          key={r.value}
          type="button"
          aria-pressed={r.value === suggested}
          title={t(r.labelKey)}
          onClick={() => onSelect(r.value)}
          className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border text-lg outline-none ${r.value === suggested ? 'border-blue-500 ring-2 ring-blue-300' : 'border-transparent hover:bg-slate-100'}`}
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
  onReact
}: {
  postId: Id<'posts'>
  suggested: Reaction
  likeCount: number
  onReact: (postId: Id<'posts'>, reaction: Reaction) => void
}) {
  const { t } = useTranslation()
  const current = REACTIONS.find(r => r.value === suggested) ?? REACTIONS[0]

  return (
    <HoverCard
      openDelay={150}
      closeDelay={150}
    >
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={t('reactions.react')}
          onClick={() => onReact(postId, current.value)}
          className="flex cursor-pointer items-center gap-1 border-none bg-none text-[13px] text-slate-500 outline-none"
        >
          <span aria-hidden="true">{current.emoji}</span> {likeCount}
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className="p-1"
      >
        <ReactionOptions
          suggested={suggested}
          onSelect={r => onReact(postId, r)}
        />
      </HoverCardContent>
    </HoverCard>
  )
}

export default function PostCard({
  post,
  onComment,
  onReact
}: {
  post: PostWithAuthor
  onComment: (postId: Id<'posts'>) => void
  onReact: (postId: Id<'posts'>, reaction: Reaction) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white font-sans">
      {/* App-owned header: Featured badge + author. The iframe can't render the
          app's Featured concept, so it lives here above the embed. */}
      <div className="p-4 pb-3">
        {post.isFeatured && (
          <span className="mb-2 inline-block text-[11px] font-bold uppercase tracking-wider text-amber-600">
            {t('feed.featured')}
          </span>
        )}

        {post.author && (
          <div className="flex items-center gap-2.5">
            {post.author.profilePictureUrl ? (
              <img
                src={post.author.profilePictureUrl}
                alt=""
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-base font-bold text-blue-700">
                {post.author.name[0]}
              </div>
            )}
            <div>
              <p className="m-0 text-sm font-semibold text-slate-900">{post.author.name}</p>
              {post.author.headline && <p className="m-0 text-xs text-slate-500">{post.author.headline}</p>}
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
          <div className="flex h-[52px] items-center gap-4 border-t border-slate-200 bg-white px-4">
            <ReactionPicker
              postId={post._id}
              suggested={post.suggestedReaction ?? 'LIKE'}
              likeCount={post.likeCount}
              onReact={onReact}
            />
            <button
              type="button"
              onClick={() => onComment(post._id)}
              className="flex cursor-pointer items-center gap-1 border-none bg-none text-[13px] text-slate-500 outline-none"
            >
              💬 {post.commentCount} {t('feed.comment')}
            </button>

            {!!post.sourceUrl && (
              <a
                href={post.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 no-underline"
              >
                View on LinkedIn ↗
              </a>
            )}
          </div>
        }
      />
    </div>
  )
}
