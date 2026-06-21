import { useCallback, useEffect, useRef, useState } from 'react'
import { useAction, usePaginatedQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
// eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual is intentional; its API is used directly.
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import type { Id } from '../../../convex/_generated/dataModel'
import { api } from '../convex'
import PostCard, { type PostWithAuthor } from '../components/PostCard'
import CommentBox from '../components/CommentBox'
import PostComposer from '../components/PostComposer'
import LoadingSpinner from '../components/LoadingSpinner'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/button'
import { useCardGate } from '../hooks/useCardGate'

const FEED_PAGE_SIZE = 20

export default function FeedPage() {
  const { t } = useTranslation()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const { gated } = useCardGate()
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
  const [reactError, setReactError] = useState<string | null>(null)

  async function handlePostSubmit(url: string) {
    if (!sessionToken) throw new Error('Not signed in')
    await submitPost({ sessionToken, postUrl: url })
  }

  const posts = results as unknown as PostWithAuthor[]

  // ─── Virtualizer ────────────────────────────────────────────────────────────
  // We use useWindowVirtualizer so the page itself scrolls (no nested
  // scroll-container). measureElement handles variable-height rows including
  // when the inline CommentBox expands/collapses.
  const listRef = useRef<HTMLDivElement | null>(null)

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual is intentional; its API is used directly.
  const virtualizer = useWindowVirtualizer({
    count: posts.length,
    estimateSize: () => 220,
    overscan: 3,
    scrollMargin: listRef.current?.offsetTop ?? 0,
    measureElement:
      typeof window !== 'undefined'
        ? element => {
            return element.getBoundingClientRect().height
          }
        : undefined
  })

  const virtualItems = virtualizer.getVirtualItems()

  // ─── Auto-load more when the last virtual item becomes visible ───────────────
  const loadMoreRef = useRef(loadMore)
  loadMoreRef.current = loadMore

  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1]
    if (!lastItem) return
    if (lastItem.index >= posts.length - 1 && status === 'CanLoadMore') {
      loadMoreRef.current(FEED_PAGE_SIZE)
    }
  }, [virtualItems, posts.length, status])

  // ─── Re-measure when comment box toggles ────────────────────────────────────
  const handleToggleComment = useCallback((id: Id<'posts'>) => {
    setCommentingOn(prev => (prev === id ? null : id))
    // After the state update + re-render the virtualizer will re-measure
    // the affected row via the measureElement ref callback.
  }, [])

  if (status === 'LoadingFirstPage') {
    return <LoadingSpinner />
  }

  return (
    <div className="mx-auto max-w-[640px] px-4 py-8 font-sans">
      <PageHeader title={t('feed.title')} />

      <PostComposer onSubmit={handlePostSubmit} />

      {posts.length === 0 && <p className="text-muted-foreground py-8 text-center">{t('feed.empty')}</p>}

      {/* Outer list ref used for scrollMargin calculation */}
      <div ref={listRef}>
        {/* Total-size container so the page scrollbar reflects the full list */}
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {/* Gap between items handled via paddingBottom on each row */}
          {virtualItems.map(virtualRow => {
            const post = posts[virtualRow.index]
            if (!post) return null
            const isCommentOpen = commentingOn === post._id

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`
                }}
              >
                {/* paddingBottom provides the gap-4 equivalent between rows */}
                <div className="pb-4">
                  <PostCard
                    post={post}
                    onComment={id => handleToggleComment(id)}
                    onReact={async (id, reactionType) => {
                      setReactError(null)
                      try {
                        await react({ postId: id, reactionType, sessionToken: sessionToken ?? '' })
                      } catch (err: unknown) {
                        const msg = err instanceof Error ? err.message : String(err)
                        if (msg.startsWith('PAYMENT_REQUIRED')) {
                          setReactError(t('feed.cardGate'))
                        } else {
                          setReactError(msg)
                        }
                      }
                    }}
                    gated={gated}
                  />
                  {reactError && <p className="text-destructive px-1 pt-1 text-xs">{reactError}</p>}
                  {isCommentOpen && (
                    <CommentBox
                      postId={post._id}
                      sessionToken={sessionToken ?? ''}
                      onClose={() => setCommentingOn(null)}
                      gated={gated}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Manual fallback trigger — also the primary trigger until scroll-based fires */}
      {status === 'CanLoadMore' && (
        <div className="mt-6 flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => loadMore(FEED_PAGE_SIZE)}
          >
            {t('feed.loadMore')}
          </Button>
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
