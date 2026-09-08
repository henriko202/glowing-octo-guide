import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAction, useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import type { Id } from '../../../convex/_generated/dataModel'
import { api } from '../convex'
import PostCard, { type PostWithAuthor } from '../components/PostCard'
import { buildPostUrl } from '../components/LinkedInEmbed'
import { toast } from '../components/ui/toast'
import { delay, HANDOFF_DELAY_MS, openLinkedIn } from '../lib/handoff'
import CommentBox from '../components/CommentBox'
import PostComposer from '../components/PostComposer'
import LoadingSpinner from '../components/LoadingSpinner'
import { FeedFilterPanel } from '../components/FeedFilterPanel'
import CardGateBanner, { useOwnPostState } from '../components/CardGateBanner'
import CardGateDialog, { type GateSource } from '../components/CardGateDialog'
import EmptyFeed from '../components/EmptyFeed'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { useCardGate } from '@/hooks/useCardGate'
import { friendlyError } from '@/lib/errors'
import { INTERACTED_TTL_MS } from '../../../convex/lib/feedHygiene'
import { captureEvent } from '@/lib/observability/analytics'

const FEED_PAGE_SIZE = 20
// backlog/R21 — how many empty pages to auto-load before trusting that the feed is empty.
// ponytail: 5 auto-loads (100 posts) then the manual Load more button takes over.
const MAX_EMPTY_LOADS = 5

export default function FeedPage() {
  const { t } = useTranslation()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const { gated } = useCardGate()
  // Which control opened the gate dialog — drives its copy/analytics. PostCard reports its own
  // source per control (react/comment/linkedin).
  const [gateSource, setGateSource] = useState<GateSource | null>(null)
  // Cursor-paginated feed (convex/feed.ts getFeed over the by_feed_rank index). `results`
  // accumulates loaded pages; `loadMore` advances the cursor on demand.
  const { results, status, loadMore } = usePaginatedQuery(
    api.feed.getFeed,
    { sessionToken },
    { initialNumItems: FEED_PAGE_SIZE }
  )
  const posts = results as unknown as PostWithAuthor[]
  // Own-post state backs both the R04 banner (gated + hidden, feed non-empty) and the R05 empty-feed
  // checklist/banner below — enabled whenever either could render, so a non-gated member sees the
  // checklist's "shared a first post" step too, not only gated members.
  const { hasHiddenPost, hasAnyPost } = useOwnPostState(gated || posts.length === 0)
  // Backs the R05 empty-feed checklist's "reacted to two posts" step (and its trial-reachability
  // gate, F12) — EmptyFeed only ever renders when the feed is empty, so skip this query the rest of
  // the time instead of firing it on every feed page load (F14).
  const progress = useQuery(api.users.getTrialProgress, sessionToken && posts.length === 0 ? { sessionToken } : 'skip')
  // Viewer profile — drives the Pro/Contact feed filter (tier gate + saved industries/countries).
  const me = useQuery(api.users.getMe, { sessionToken }) as
    | {
        tier?: string
        feedFilterIndustries?: string[]
        feedFilterCountries?: string[]
      }
    | null
    | undefined
  const canFilter = me?.tier === 'pro' || me?.tier === 'contact'
  const filterIndustries = me?.feedFilterIndustries ?? []
  const filterCountries = me?.feedFilterCountries ?? []
  const filterActive = filterIndustries.length + filterCountries.length > 0
  const react = useAction(api.interactions.reactToPost)
  const hidePost = useMutation(api.interactions.hidePost)
  const submitPost = useAction(api.posts.submitPost)
  const [commentingOn, setCommentingOn] = useState<Id<'posts'> | null>(null)
  const [reactingPostId, setReactingPostId] = useState<Id<'posts'> | null>(null)
  const [reactError, setReactError] = useState<{ postId: Id<'posts'>; msg: string } | null>(null)

  async function handlePostSubmit(url: string) {
    if (!sessionToken) throw new Error(t('auth.notSignedIn'))
    await submitPost({ sessionToken, postUrl: url })
  }

  // ─── Virtualizer ────────────────────────────────────────────────────────────
  // We use useWindowVirtualizer so the page itself scrolls (no nested
  // scroll-container). measureElement handles variable-height rows including
  // when the inline CommentBox expands/collapses.
  const listRef = useRef<HTMLDivElement | null>(null)
  // scrollMargin is the list's offset from the top of the page. Reading listRef.current during
  // render is disallowed (react-hooks/refs), so measure it in a layout effect and re-measure on
  // resize and whenever the post count changes the layout above the list (e.g. the empty state).
  const [scrollMargin, setScrollMargin] = useState(0)
  useLayoutEffect(() => {
    const measure = () => setScrollMargin(listRef.current?.offsetTop ?? 0)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [posts.length])

  const virtualizer = useWindowVirtualizer({
    count: posts.length,
    estimateSize: () => 220,
    overscan: 3,
    scrollMargin,
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
  useEffect(() => {
    loadMoreRef.current = loadMore
  }, [loadMore])

  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1]
    if (!lastItem) return
    if (lastItem.index >= posts.length - 1 && status === 'CanLoadMore') {
      loadMoreRef.current(FEED_PAGE_SIZE)
    }
  }, [virtualItems, posts.length, status])

  // ─── backlog/R21: keep loading while pages come back empty ──────────────────
  // fetchFeedPage drops posts the viewer already handled (24 h window / Hide now), so a page can
  // come back empty while more exist. Load a few more before showing any empty state.
  const [emptyLoads, setEmptyLoads] = useState(0)
  const autoLoading = posts.length === 0 && status === 'CanLoadMore' && emptyLoads < MAX_EMPTY_LOADS
  useEffect(() => {
    // The budget covers one RUN of empty pages, so a page that comes back with posts starts it
    // over — otherwise a session that burned all five once shows the empty state next to a "Load
    // more" button the next time the feed legitimately empties (the viewer hides their last cards).
    // The two cases never overlap: autoLoading already requires posts.length === 0.
    if (posts.length === 0 && !autoLoading) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: bound the auto-load loop, and reset it on a non-empty page
    setEmptyLoads(n => (posts.length > 0 ? 0 : n + 1))
    if (autoLoading) loadMoreRef.current(FEED_PAGE_SIZE)
  }, [autoLoading, posts.length])
  // Only read while the feed is really empty — tells the R05 empty state and the R21 caught-up
  // state apart.
  const caughtUp = useQuery(api.feed.getCaughtUp, sessionToken && posts.length === 0 ? { sessionToken } : 'skip')

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

      {/* One attention point per screen: never stacks with the empty state (Task 5) or the pulsing
          Billing nav item plus a dialog. */}
      {gated && hasHiddenPost && posts.length > 0 && <CardGateBanner />}

      <PostComposer onSubmit={handlePostSubmit} />

      {canFilter && sessionToken && (
        <FeedFilterPanel
          sessionToken={sessionToken}
          industries={filterIndustries}
          countries={filterCountries}
        />
      )}

      {/* Only an exhausted feed gets an empty state. While pages can still load — the auto-load chase,
          or its budget spent with the manual button showing — nothing sits above that button, so
          "You're caught up" never renders next to "Load more". */}
      {posts.length === 0 &&
        status === 'Exhausted' &&
        (filterActive ? (
          <p className="text-muted-foreground py-8 text-center">{t('feed.emptyFiltered')}</p>
        ) : (
          <EmptyFeed
            gated={gated}
            hasOwnPost={hasAnyPost}
            made={progress?.made ?? 0}
            trialStatus={progress?.status}
            caughtUp={caughtUp?.caughtUp ?? false}
          />
        ))}

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
                      setReactingPostId(id)
                      // No member API exists for reacting to another member's post — the user reacts
                      // there. Show the toast, count optimistically, then hand off to LinkedIn.
                      toast(t('reactions.openHint'))
                      try {
                        await react({ postId: id, reactionType, sessionToken: sessionToken ?? '' })
                      } catch (err: unknown) {
                        const msg = friendlyError(err, String(err))
                        setReactError({
                          postId: id,
                          msg: msg.startsWith('PAYMENT_REQUIRED') ? t('feed.cardGate') : msg
                        })
                        setReactingPostId(null)
                        return
                      }
                      // Keep the toast + spinner on screen for a beat, THEN open LinkedIn.
                      await delay(HANDOFF_DELAY_MS)
                      openLinkedIn(buildPostUrl(post.linkedinPostUrn, post.sourceUrl))
                      setReactingPostId(null)
                    }}
                    gated={gated}
                    onGated={setGateSource}
                    reacting={reactingPostId === post._id}
                    onHide={async () => {
                      const state = post.viewerState
                      if (!state) return
                      try {
                        await hidePost({ sessionToken: sessionToken ?? '', postId: post._id })
                        // How long after the interaction they hid it — the only number R21 wants.
                        captureEvent('post_hidden', {
                          after: Math.round((INTERACTED_TTL_MS - (state.hidesAt - Date.now())) / 3_600_000)
                        })
                      } catch (err: unknown) {
                        // NOT_INTERACTED means the viewer's row for this post is gone (an author
                        // erasure cascade beat the tap), so the card leaves on the next feed
                        // update either way — a raw backend code in a toast helps nobody.
                        const msg = friendlyError(err, String(err))
                        if (msg !== 'NOT_INTERACTED') toast(msg)
                      }
                    }}
                  />
                  {reactError?.postId === post._id && (
                    <p className="text-destructive px-1 pt-1 text-xs">{reactError.msg}</p>
                  )}
                  {isCommentOpen && (
                    <CommentBox
                      postId={post._id}
                      postUrl={buildPostUrl(post.linkedinPostUrn, post.sourceUrl)}
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

      <CardGateDialog
        open={gateSource !== null}
        onOpenChange={open => !open && setGateSource(null)}
        source={gateSource ?? 'react'}
      />
    </div>
  )
}
