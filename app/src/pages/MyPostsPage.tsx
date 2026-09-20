// app/src/pages/MyPostsPage.tsx
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useSearchParams } from 'react-router-dom'
import type { Id } from '../../../convex/_generated/dataModel'
import { api } from '../convex'

import { PageHeader } from '@/components/PageHeader'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import LoadingSpinner from '../components/LoadingSpinner'
import Modal from '../components/Modal'
import PostComposer from '../components/PostComposer'
import LinkedInEmbed, { buildPostUrl } from '../components/LinkedInEmbed'
import PlanUsagePills, { type FeaturedUsage, type WeeklyUsage } from '@/components/PlanUsagePills'
import UpgradeAtLimit from '../components/UpgradeAtLimit'
import PaymentRequiredHint from '../components/PaymentRequiredHint'
import { friendlyError, mapLimitError } from '@/lib/errors'
import { timeAgo } from '@/lib/relativeDay'
import { toast } from '@/components/ui/toast'
import { captureEvent } from '@/lib/observability/analytics'
import { useCardGate } from '@/hooks/useCardGate'
import { FEATURED_POST_PRICE, usdLabel } from '@/lib/planPrices'
import { FEATURED_CAP_BONUS, type Tier } from '../../../convex/lib/planLimits'
import { effectiveInteractionCap } from '../../../convex/lib/interactionLimit'
import { hasPermanentFeaturedEntitlement, isUnlimitedFeatured } from '../../../convex/lib/postLimit'

// The shape returned by getMyPosts — matches the posts table schema
interface MyPost {
  _id: Id<'posts'>
  linkedinPostUrn: string
  content: string
  publishedAt: number
  likeCount: number
  commentCount: number
  hidden?: boolean
  isFeatured?: boolean
  featuredAt?: number
  sourceUrl?: string
  // Set when this post's engagement met the author's per-post interaction cap and it left the
  // feed (convex/posts.ts:439,473,533,567 — Option A, total engagement counts toward the cap).
  interactionLimitReached?: boolean
  // backlog/R17 — set by posts.applyPurchasedFeature when this post's featured slot was bought.
  interactionCapBonus?: number
  featuredPurchase?: { checkoutSessionId: string; amountCents: number; paidAt: number }
}

type BuySource = 'cap' | 'billing' | 'quota'

// backlog/R17 — the $5 control. The value details live in its tooltip so the card action bar stays
// compact, while the solid button makes the paid action explicit.
function BuyFeaturedButton({
  post,
  source,
  newCap,
  isTrialing,
  pending,
  onBuy
}: {
  post: MyPost
  source: BuySource
  newCap: number
  isTrialing: boolean
  pending: boolean
  onBuy: (post: MyPost, source: BuySource) => void
}) {
  const { t, i18n } = useTranslation()
  const hint = `${t('myPosts.buyFeaturedHint', { newCap })}${isTrialing ? ` ${t('myPosts.buyFeaturedTrial')}` : ''}`
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="default"
          size="sm"
          disabled={pending}
          className={pending ? 'cursor-wait' : 'cursor-pointer'}
          onClick={() => onBuy(post, source)}
        >
          {pending
            ? '...'
            : t(post.isFeatured ? 'myPosts.buyFeaturedRoom' : 'myPosts.buyFeatured', {
                price: usdLabel(i18n.language, FEATURED_POST_PRICE)
              })}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{hint}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export default function MyPostsPage() {
  const { t, i18n } = useTranslation()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  // Latched once per mount: the usage queries take a client-supplied `now` (queries must not read
  // the wall clock themselves). A fresh Date.now() on every render would change the query args
  // and re-subscribe each render, so capture it once — same pattern as RecapPage.
  const [now] = useState(() => Date.now())

  const me = useQuery(api.users.getMe, { sessionToken })
  const usage = useQuery(api.posts.getWeeklyUsage, { sessionToken, now }) as WeeklyUsage | null | undefined
  const featuredUsage = useQuery(api.posts.getFeaturedUsage, { sessionToken, now }) as FeaturedUsage | null | undefined
  // Current tier's interaction cap, for the "reached N interactions" badge below — a post's own
  // cap isn't stored (it's evaluated against the author's tier at write time), so this shows the
  // CURRENT tier limit, same convention as getFeaturedUsage/getWeeklyUsage above.
  const tierLimits = useQuery(api.posts.getTierLimits, {})
  const posts = useQuery(api.posts.getMyPosts, { sessionToken }) as unknown as MyPost[] | undefined
  const submitPost = useAction(api.posts.submitPost)
  const setPostHidden = useMutation(api.posts.setPostHidden)
  const deletePost = useMutation(api.posts.deletePost)
  const featurePost = useMutation(api.posts.featurePost)
  const unfeaturePost = useMutation(api.posts.unfeaturePost)
  const purchaseFeaturedPost = useAction(api.billingNode.purchaseFeaturedPost)
  const { gated, isTrialing, status } = useCardGate()
  // A failed payment blocks submission (convex/lib/access.ts: assertCanSubmitPost). A `none`
  // member keeps the composer — their onboarding first post is created hidden by design.
  const pastDue = status === 'past_due'
  const [searchParams, setSearchParams] = useSearchParams()

  // backlog/R17 — two one-shot URL params, latched during render (BillingPage's `justSubscribed`
  // pattern) so they survive being stripped a moment later:
  //   ?feature=buy            Billing's "Pick a post": selects the billing source once plan slots are exhausted.
  //   ?featured=paid&post=ID  Stripe's success_url: that card reads "Confirming…" until the
  //                           webhook writes featuredPurchase onto it. No timeout, by decision.
  const paidPostId = searchParams.get('featured') === 'paid' ? searchParams.get('post') : null
  const wantsBuy = searchParams.get('feature') === 'buy'
  const [buyMode, setBuyMode] = useState(false)
  const [confirmingPostId, setConfirmingPostId] = useState<string | null>(null)
  if (wantsBuy && !buyMode) setBuyMode(true)
  if (paidPostId && confirmingPostId !== paidPostId) setConfirmingPostId(paidPostId)

  const tier: Tier = me?.tier ?? 'starter'
  const planCap = tierLimits?.[tier]?.interactionsPerPost
  // The cap a bought post gets: plan cap + this tier's bonus. Undefined until the limits load.
  const newCap = planCap === undefined ? undefined : effectiveInteractionCap(planCap, FEATURED_CAP_BONUS[tier])
  const featuredUnlimited = featuredUsage != null && isUnlimitedFeatured(featuredUsage.featuredPerMonth)
  // The $5 add-on's blocker keys on the tier's cap bonus: a tier with none (contact) has
  // NOTHING_TO_BUY server-side. Contact's featured cap is now a finite 5, so the old
  // isUnlimitedFeatured-only guard no longer covers it on its own.
  const canBuyAddon = FEATURED_CAP_BONUS[tier] > 0
  const atLimit = usage != null && usage.postsThisWeek >= usage.postsPerWeek
  const featuredAtCap = featuredUsage != null && featuredUsage.usedCount >= featuredUsage.featuredPerMonth
  // Hidden for a bought post, an unlimited tier, a tier with no cap bonus (contact), anyone the card
  // gate would stop at the purchase, a canceled member (backlog/R17 A2): assertCanEngage lets them buy
  // server-side — they're still inside their paid window — but a $5 feature for a post that leaves the
  // feed once that window ends is a bad sale. The server stays permissive; the UI is what actually says no.
  // Also hidden while the post is itself hidden (F1): a hidden post's inFeed stays false even once
  // bought (convex/lib/featuredPurchase.ts), so the $5 promise can't hold until the member unhides.
  // canBuy is recomputed per render, so unhiding re-enables the control on its own.
  const canBuy = (post: MyPost) =>
    !post.hidden &&
    !hasPermanentFeaturedEntitlement(post) &&
    // Spec §4.9: the confirming state replaces ANY buy control. The entitlement helper above
    // cannot carry this yet — neither purchase field has arrived during the confirming window,
    // which is the only window where a second Checkout Session is possible.
    confirmingPostId !== post._id &&
    !featuredUnlimited &&
    canBuyAddon &&
    !gated &&
    me?.subscriptionStatus !== 'canceled' &&
    newCap !== undefined

  useEffect(() => {
    if (paidPostId || wantsBuy) setSearchParams({}, { replace: true })
  }, [paidPostId, wantsBuy, setSearchParams])

  // One toast per return leg, once the numbers it names AND the list it names them for have loaded;
  // the ref survives StrictMode's double effect. It waits on `posts` too, so the latch is never
  // spent on a render where the id could not have matched yet.
  const paidToastFired = useRef(false)
  useEffect(() => {
    if (!confirmingPostId || newCap === undefined || posts === undefined || paidToastFired.current) return
    paidToastFired.current = true
    captureEvent('featured_purchase_completed')
    // The toast promises room on one specific post, so it only fires for a post still in the list:
    // in spec §4.12's orphaned case (deleted between Checkout and the webhook) it would otherwise
    // promise room on a post that will never be featured. The event stays unconditional — the
    // member did pay, orphaned or not.
    if (posts.some(p => p._id === confirmingPostId)) toast(t('myPosts.featuredPaidToast', { newCap }))
  }, [confirmingPostId, newCap, posts, t])

  // Transient error surfaced above the list when a hide/delete action fails.
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmUnfeaturePost, setConfirmUnfeaturePost] = useState<MyPost | null>(null)
  // The post awaiting delete confirmation in the themed Dialog below (null = closed).
  const [confirmDeletePost, setConfirmDeletePost] = useState<MyPost | null>(null)
  // backlog/R17 F4 — the post id mid-Checkout-redirect, so only the clicked card's button disables
  // (not every buy button on the page) and a second click can't fire a second Checkout Session.
  const [buyingPostId, setBuyingPostId] = useState<Id<'posts'> | null>(null)

  async function handleSubmit(postUrl: string) {
    if (!sessionToken) throw new Error(t('auth.notSignedIn'))
    await submitPost({ sessionToken, postUrl })
    // backlog/R17 order bump: one line, no second action — the new card below carries the control.
    // Members who cannot buy (card-gated, unlimited tier, no-bonus contact, canceled — F2) get the
    // plain "feature it" line.
    const bump = featuredAtCap && !gated && !featuredUnlimited && canBuyAddon && me?.subscriptionStatus !== 'canceled'
    toast(
      t(bump ? 'myPosts.postAddedBuy' : 'myPosts.postAddedFeature', {
        price: usdLabel(i18n.language, FEATURED_POST_PRICE)
      })
    )
  }

  // Toggle a post's feed visibility. Convex queries are reactive, so getMyPosts
  // re-renders with the new `hidden` state automatically — no manual refetch.
  async function handleToggleHidden(post: MyPost) {
    if (!sessionToken) return
    setActionError(null)
    try {
      await setPostHidden({ sessionToken, postId: post._id, hidden: !post.hidden })
    } catch (err) {
      setActionError(friendlyError(err, t('myPosts.updateError')))
    }
  }

  // Feature/unfeature toggle. Featuring is quota-gated server-side (getFeaturedUsage
  // backs the disabled state below), but we still catch here since the cap can tick
  // over between render and click. No optimistic update needed — getFeaturedUsage and
  // getMyPosts are both reactive Convex queries, so the pill and badge update together
  // once the mutation commits.
  async function handleToggleFeatured(post: MyPost) {
    if (!sessionToken) return
    setActionError(null)
    try {
      if (post.isFeatured) {
        setConfirmUnfeaturePost(post)
      } else {
        await featurePost({ sessionToken, postId: post._id })
      }
    } catch (err) {
      setActionError(mapLimitError(friendlyError(err, t('myPosts.updateError')), t))
    }
  }

  async function handleConfirmUnfeature() {
    if (!sessionToken || !confirmUnfeaturePost) return
    const postId = confirmUnfeaturePost._id
    setConfirmUnfeaturePost(null)
    setActionError(null)
    try {
      await unfeaturePost({ sessionToken, postId })
    } catch (err) {
      setActionError(friendlyError(err, t('myPosts.updateError')))
    }
  }

  async function handleBuyFeatured(post: MyPost, source: BuySource) {
    if (!sessionToken) return
    setActionError(null)
    setBuyingPostId(post._id)
    captureEvent('featured_purchase_started', { source })
    try {
      const { url } = await purchaseFeaturedPost({ sessionToken, postId: post._id })
      if (!url) throw new Error('NO_CHECKOUT_URL')
      // eslint-disable-next-line react-hooks/immutability -- a browser redirect, not a React mutation
      window.location.href = url
    } catch {
      // F3 — every failure here (a thrown ConvexError code, or a missing url) is a state the UI
      // already prevents, so none of them need telling apart for the buyer; friendlyError would
      // otherwise leak a raw server code like FEATURED_PRICE_UNSET verbatim.
      setActionError(t('myPosts.buyFeaturedError'))
      setBuyingPostId(null)
    }
  }

  // Soft-delete: drops the post from the feed and this list. It still counts
  // toward the weekly limit, so we say so in the confirmation dialog opened here.
  function handleDelete(post: MyPost) {
    if (!sessionToken) return
    setConfirmDeletePost(post)
  }

  // Runs once the user confirms in the Dialog (see render below). Closes the dialog
  // immediately — matching the fire-and-forget style of handleToggleHidden/
  // handleToggleFeatured above — and surfaces any failure in the same error banner.
  async function handleConfirmDelete() {
    if (!sessionToken || !confirmDeletePost) return
    const postId = confirmDeletePost._id
    setConfirmDeletePost(null)
    setActionError(null)
    try {
      await deletePost({ sessionToken, postId })
    } catch (err) {
      setActionError(friendlyError(err, t('myPosts.deleteError')))
    }
  }

  if (posts === undefined) {
    return <LoadingSpinner />
  }

  return (
    <div className="mx-auto max-w-160 px-4 py-8 font-sans">
      <PageHeader title={t('nav.myPosts')} />

      {/* Profile header — with the weekly-usage + featured-usage pills on the right.
          flex-wrap on both the outer row and the pill group so the pills stack as whole
          units (never mid-label) instead of overflowing on narrow screens. */}
      {me && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar
              name={me.name}
              src={me.profilePictureUrl}
              size="md"
            />
            <div>
              <div className="text-foreground text-sm font-semibold">{me.name}</div>
              <div className="text-muted-foreground text-xs capitalize">{t('myPosts.tierPlan', { tier: me.tier })}</div>
            </div>
          </div>
          <PlanUsagePills
            usage={usage}
            featuredUsage={featuredUsage}
          />
        </div>
      )}

      {/* Upgrade ask at the moment of the featured cap (backlog/R08) — under the pill row, not
          inside the pill itself, so the pill stays a short badge. Only for a plan that includes
          featured posts at all: on Starter (0/month) `featuredAtCap` is 0 >= 0 on every visit, and
          an ask that fires on page load is an interruption, not a limit moment. Starter meets the
          featured ask where it binds — the Feature button's own disabled state. */}
      {featuredUsage != null && featuredAtCap && featuredUsage.featuredPerMonth > 0 && (
        <p className="text-muted-foreground mb-6 text-[13px]">
          <UpgradeAtLimit limit="featured" />
        </p>
      )}

      {/* Manual share — copied from the Feed page, re-themed light to match this page.
          Disabled at the weekly limit so we don't trigger a guaranteed-to-fail submit. */}
      <PostComposer
        atLimit={atLimit || pastDue}
        limitHint={pastDue ? <PaymentRequiredHint /> : <UpgradeAtLimit limit="weeklyPosts" />}
        onSubmit={handleSubmit}
      />

      {/* Section header */}
      <div className="text-muted-foreground mb-3 text-[10px] tracking-wider uppercase">
        {t('myPosts.heading', { count: posts.length })}
      </div>

      {/* Transient error from a hide/delete action */}
      {actionError && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mb-3 rounded-md border px-3 py-2 text-xs">
          {actionError}
        </div>
      )}

      {/* Post list */}
      {posts.length === 0 ? (
        <div className="border-border border-t pt-5 text-center">
          <p className="text-muted-foreground text-[13px]">{t('myPosts.emptyState')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map(post => (
            <div
              key={post._id}
              className={`border-border bg-card overflow-hidden rounded-lg border ${post.hidden ? 'opacity-60' : ''}`}
            >
              {/* Owner action bar: visibility/featured state + Feature/Unfeature + Hide/Unhide + Delete.
                  flex-wrap on both sides guards against overflow if translated labels run long. */}
              <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-3.5 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  {post.isFeatured && (
                    <Badge
                      variant="warning"
                      className="rounded-full px-2 py-0.5 text-[11px]"
                    >
                      {post.featuredPurchase && planCap !== undefined
                        ? t('myPosts.featuredPaidBadge', {
                            cap: effectiveInteractionCap(planCap, post.interactionCapBonus)
                          })
                        : t('feed.featured')}
                    </Badge>
                  )}
                  {post.hidden || pastDue ? (
                    <Badge
                      variant="warning"
                      className="rounded-full px-2 py-0.5 text-[11px]"
                    >
                      {t(pastDue && !post.hidden ? 'myPosts.hiddenPaymentPending' : 'myPosts.hiddenFromFeed')}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-[11px]">{t('myPosts.visibleInFeed')}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {confirmingPostId === post._id && !post.featuredPurchase ? (
                    <span
                      role="status"
                      className="text-muted-foreground text-[11px]"
                    >
                      {t('myPosts.confirmingPayment')}
                    </span>
                  ) : !post.isFeatured &&
                    !post.interactionLimitReached &&
                    featuredAtCap &&
                    canBuy(post) &&
                    newCap !== undefined ? (
                    <BuyFeaturedButton
                      post={post}
                      source={buyMode ? 'billing' : 'quota'}
                      newCap={newCap}
                      isTrialing={isTrialing}
                      pending={buyingPostId === post._id}
                      onBuy={handleBuyFeatured}
                    />
                  ) : (
                    /* The plan allowance is card-gated too: featurePostHandler refuses a
                       past_due/none member with PAYMENT_REQUIRED (convex/posts.ts). The control
                       stays visible with the reason, and Unfeature always works — removing a boost
                       must never be blocked. */
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-pressed={post.isFeatured ?? false}
                      disabled={
                        !post.isFeatured &&
                        (gated ||
                          (featuredAtCap && !hasPermanentFeaturedEntitlement(post)) ||
                          post.interactionLimitReached === true)
                      }
                      title={
                        post.isFeatured
                          ? undefined
                          : post.interactionLimitReached === true
                            ? t('myPosts.featuredCappedTitle')
                            : featuredAtCap && !hasPermanentFeaturedEntitlement(post)
                              ? t('myPosts.featureLimitReached')
                              : gated
                                ? t('myPosts.featurePaymentRequired')
                                : undefined
                      }
                      onClick={() => handleToggleFeatured(post)}
                      className="cursor-pointer"
                    >
                      {post.isFeatured ? t('myPosts.unfeature') : t('myPosts.feature')}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleHidden(post)}
                    className="cursor-pointer"
                  >
                    {post.hidden ? t('myPosts.unhide') : t('myPosts.hide')}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(post)}
                    className="cursor-pointer"
                  >
                    {t('myPosts.delete')}
                  </Button>
                </div>
              </div>
              {/* Interaction cap reached — the post left the feed silently (no toast, no notice on
                  the next feed visit); this row is the only place it's surfaced. */}
              {post.interactionLimitReached && me && planCap !== undefined && (
                <div className="border-border flex flex-col gap-2 border-b px-3.5 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="warning"
                      className="rounded-full px-2 py-0.5 text-[11px]"
                    >
                      {t('myPosts.interactionCapBadge', {
                        limit: effectiveInteractionCap(planCap, post.interactionCapBonus)
                      })}
                    </Badge>
                    <span className="text-muted-foreground text-[11px]">
                      <UpgradeAtLimit limit="interactionCap" />
                    </span>
                  </div>
                  {/* Upgrade first, add-on second (backlog/R17): a featured slot brings the post back. */}
                  {canBuy(post) && newCap !== undefined && (
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground text-[11px]">
                        {t('myPosts.buyFeaturedCapped', { cap: planCap, newCap })}
                      </span>
                      <BuyFeaturedButton
                        post={post}
                        source="cap"
                        newCap={newCap}
                        isTrialing={isTrialing}
                        pending={buyingPostId === post._id}
                        onBuy={handleBuyFeatured}
                      />
                    </div>
                  )}
                </div>
              )}
              <LinkedInEmbed
                urn={post.linkedinPostUrn}
                footer={
                  <div className="border-border bg-card flex h-13 items-center justify-between border-t px-3.5">
                    {/* Engagement stats from our own tracking data */}
                    <span className="text-muted-foreground text-xs">
                      👍 {post.likeCount} · 💬 {post.commentCount}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {timeAgo(post.publishedAt, t)} ·{' '}
                      <a
                        href={buildPostUrl(post.linkedinPostUrn, post.sourceUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gold-text no-underline hover:underline"
                      >
                        {t('feed.viewOnLinkedIn')}
                      </a>
                    </span>
                  </div>
                }
              />
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation — themed Dialog replacing window.confirm. Radix handles the
          focus trap, focus restore, and Escape/overlay dismiss; Cancel sits first in the DOM
          so it receives initial focus (safe default for a destructive dialog). */}
      {confirmDeletePost && (
        <Modal
          onClose={() => setConfirmDeletePost(null)}
          title={t('myPosts.delete')}
        >
          <p className="text-foreground m-0 text-sm">{t('myPosts.deleteConfirm')}</p>
          <DialogFooter className="mt-5">
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer"
              onClick={() => setConfirmDeletePost(null)}
            >
              {t('privacy.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="cursor-pointer"
              onClick={() => void handleConfirmDelete()}
            >
              {t('myPosts.delete')}
            </Button>
          </DialogFooter>
        </Modal>
      )}

      {confirmUnfeaturePost && (
        <Modal
          onClose={() => setConfirmUnfeaturePost(null)}
          title={t('myPosts.unfeatureConfirmTitle')}
        >
          <p className="text-foreground m-0 text-sm">{t('myPosts.unfeatureConfirm')}</p>
          <DialogFooter className="mt-5">
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer"
              onClick={() => setConfirmUnfeaturePost(null)}
            >
              {t('privacy.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="cursor-pointer"
              onClick={() => void handleConfirmUnfeature()}
            >
              {t('myPosts.unfeature')}
            </Button>
          </DialogFooter>
        </Modal>
      )}
    </div>
  )
}
