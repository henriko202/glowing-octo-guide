import { useState } from 'react'
import { useQuery, useAction } from 'convex/react'
import { useTranslation } from 'react-i18next'
import type { Id } from '../../../convex/_generated/dataModel'
import { api } from '../convex'
import PostCard, { type PostWithAuthor } from '../components/PostCard'
import CommentBox from '../components/CommentBox'
import PostComposer from '../components/PostComposer'

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
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#64748b', fontFamily: 'system-ui, sans-serif' }}>
        {t('feed.loading')}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 24 }}>{t('feed.title')}</h1>

      <PostComposer onSubmit={handlePostSubmit} />

      {feed.posts.length === 0 && (
        <p style={{ textAlign: 'center', color: '#64748b', padding: '32px 0' }}>{t('feed.empty')}</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
