import { useTranslation } from 'react-i18next'
import type { Id } from '../../../convex/_generated/dataModel'

export type PostWithAuthor = {
  _id: Id<'posts'>
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
    <div className="rounded-xl border border-slate-200 bg-white p-5 font-sans">
      {post.isFeatured && (
        <span className="mb-2 inline-block text-[11px] font-bold uppercase tracking-wider text-amber-600">
          {t('feed.featured')}
        </span>
      )}

      {post.author && (
        <div className="mb-3 flex items-center gap-2.5">
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

      <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{post.content}</p>

      <div className="flex gap-4">
        <button
          onClick={() => onReact(post._id)}
          className="flex cursor-pointer items-center gap-1 border-none bg-none text-[13px] text-slate-500 outline-none"
        >
          👍 {post.likeCount} {t('feed.like')}
        </button>
        <button
          onClick={() => onComment(post._id)}
          className="flex cursor-pointer items-center gap-1 border-none bg-none text-[13px] text-slate-500 outline-none"
        >
          💬 {post.commentCount} {t('feed.comment')}
        </button>
      </div>
    </div>
  )
}
