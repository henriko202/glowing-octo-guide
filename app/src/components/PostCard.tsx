import { useTranslation } from 'react-i18next'
import type { Id } from '../../../convex/_generated/dataModel'
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
}

export default function PostCard({
  post,
  onComment,
  onReact
}: {
  post: PostWithAuthor
  onComment: (postId: Id<'posts'>) => void
  onReact: (postId: Id<'posts'>) => void
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

      {/* LinkedIn embed. Our own Like/Comment bar is overlaid at the bottom,
          covering LinkedIn's clipped native action bar. These buttons drive the
          app's in-app engagement (onReact / onComment), independent of LinkedIn. */}
      <LinkedInEmbed
        urn={post.linkedinPostUrn}
        footer={
          <div className="flex h-[52px] items-center gap-4 border-t border-slate-200 bg-white px-4">
            <button
              type="button"
              onClick={() => onReact(post._id)}
              className="flex cursor-pointer items-center gap-1 border-none bg-none text-[13px] text-slate-500 outline-none"
            >
              👍 {post.likeCount} {t('feed.like')}
            </button>
            <button
              type="button"
              onClick={() => onComment(post._id)}
              className="flex cursor-pointer items-center gap-1 border-none bg-none text-[13px] text-slate-500 outline-none"
            >
              💬 {post.commentCount} {t('feed.comment')}
            </button>
          </div>
        }
      />
    </div>
  )
}
