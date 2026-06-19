import { useState } from 'react'
import { useAction, usePaginatedQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import type { Id } from '../../../convex/_generated/dataModel'
import { api } from '../convex'
import PostCard, { type PostWithAuthor } from '../components/PostCard'
import CommentBox from '../components/CommentBox'
import PostComposer from '../components/PostComposer'
import LoadingSpinner from '../components/LoadingSpinner'

const FEED_PAGE_SIZE = 20

export default function FeedPage() {
  const { t } = useTranslation()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  // Cursor-paginated feed (convex/feed.ts getFeed over the by_feed_rank index). `results`
  // accumulates loaded pages; `loadMore` advances the cursor on demand.
  const { results, status, loadMore } = usePaginatedQuery(
    api.feed.getFeed,
    { sessionToken },
    { initialNumItems: FEED_PAGE_SIZE }
  )
  const react = useAction(api.interactions.reactToPost)
  const submitPost = useAction(api.posts.submitPost)
  const [commentingOn, setCommentingOn] = useState<Id<'posts'> | null>(null)

  async function handlePostSubmit(url: string) {
    if (!sessionToken) throw new Error('Not signed in')
    await submitPost({ sessionToken, postUrl: url })
  }

  if (status === 'LoadingFirstPage') {
    return <LoadingSpinner />
  }

  return (
    <div className="mx-auto max-w-[640px] px-4 py-8 font-sans">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">{t('feed.title')}</h1>

      <PostComposer onSubmit={handlePostSubmit} />

      {results.length === 0 && <p className="py-8 text-center text-slate-500">{t('feed.empty')}</p>}
      <div className="flex flex-col gap-4">
        {(results as unknown as PostWithAuthor[]).map(post => (
          <div key={post._id}>
            <PostCard
              post={post}
              onComment={id => setCommentingOn(id === commentingOn ? null : id)}
              onReact={(id, reactionType) => react({ postId: id, reactionType, sessionToken: sessionToken ?? '' })}
            />
            {commentingOn === post._id && (
              <CommentBox
                postId={post._id}
                sessionToken={sessionToken ?? ''}
                onClose={() => setCommentingOn(null)}
              />
            )}
          </div>
        ))}
      </div>

      {status === 'CanLoadMore' && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => loadMore(FEED_PAGE_SIZE)}
            className="rounded-md border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {t('feed.loadMore')}
          </button>
        </div>
      )}
      {status === 'LoadingMore' && (
        <div className="mt-6 flex justify-center">
          <LoadingSpinner />
        </div>
      )}
    </div>
  )
}
