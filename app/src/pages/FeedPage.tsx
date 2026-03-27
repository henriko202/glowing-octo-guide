import { useState } from 'react'
import { useAction, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import type { Id } from '../../../convex/_generated/dataModel'
import { api } from '../convex'
import PostCard, { type PostWithAuthor } from '../components/PostCard'
import CommentBox from '../components/CommentBox'
import PostComposer from '../components/PostComposer'
import LoadingSpinner from '../components/LoadingSpinner'

export default function FeedPage() {
  const { t } = useTranslation()
  const feed = useQuery(api.feed.getFeed, {})
  const react = useAction(api.interactions.reactToPost)
  const submitPost = useAction(api.posts.submitPost)
  const [commentingOn, setCommentingOn] = useState<Id<'posts'> | null>(null)

  const userId = (sessionStorage.getItem('convexUserId') ?? undefined) as Id<'users'> | undefined

  async function handlePostSubmit(url: string) {
    if (!userId) throw new Error('Not signed in')
    await submitPost({ userId, postUrl: url })
  }

  if (!feed) {
    return <LoadingSpinner />
  }

  return (
    <div className="mx-auto max-w-[640px] px-4 py-8 font-sans">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">{t('feed.title')}</h1>

      <PostComposer onSubmit={handlePostSubmit} />

      {feed.posts.length === 0 && <p className="py-8 text-center text-slate-500">{t('feed.empty')}</p>}
      <div className="flex flex-col gap-4">
        {(feed.posts as unknown as PostWithAuthor[]).map(post => (
          <div key={post._id}>
            <PostCard
              post={post}
              onComment={id => setCommentingOn(id === commentingOn ? null : id)}
              onReact={id => react({ postId: id, reactionType: 'LIKE' })}
            />
            {commentingOn === post._id && (
              <CommentBox
                postId={post._id}
                onClose={() => setCommentingOn(null)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
