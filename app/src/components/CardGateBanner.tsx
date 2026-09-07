import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../convex'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { captureEvent } from '@/lib/observability/analytics'
import { resolveTargetPlan } from '@/lib/targetPlan'
import { useCardGate } from '@/hooks/useCardGate'

/**
 * Own-post state for a card-gated member, off the same query MyPostsPage already uses: whether
 * their post is sitting hidden (`postCreatedHidden` in convex/lib/access.ts) and whether they have
 * a post at all. Subscribed only while `enabled` — a gated member has at most one post, so reusing
 * `getMyPosts` costs less than a new query. Shared with Task 4's success dialog and Task 5's
 * empty-feed checklist, so the signature must not drift.
 */
export function useOwnPostState(enabled: boolean): { hasHiddenPost: boolean; hasAnyPost: boolean } {
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const posts = useQuery(api.posts.getMyPosts, enabled && sessionToken ? { sessionToken } : 'skip') as
    | { hidden?: boolean }[]
    | undefined
  return {
    hasHiddenPost: !!posts?.some(p => p.hidden === true),
    hasAnyPost: !!posts && posts.length > 0
  }
}

/** Names what the member already owns — their hidden first post — with the one CTA that reveals it. */
export default function CardGateBanner({ className }: { className?: string }) {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const plan = resolveTargetPlan(searchParams)
  // A past_due member already has a card and already had a trial — "start your trial" copy is
  // wrong for them (F5); they need to fix a failed payment, not sign up.
  const { status } = useCardGate()
  const pastDue = status === 'past_due'

  return (
    <div
      className={cn('border-primary bg-accent text-accent-foreground mb-4 rounded-xl border p-4 text-sm', className)}
    >
      <p className="m-0">{t(pastDue ? 'feed.hiddenPostBannerPastDue' : 'feed.hiddenPostBanner')}</p>
      <Button
        asChild
        className="mt-3"
      >
        <Link
          to={`/billing?plan=${plan}`}
          onClick={() => captureEvent('card_gate_cta_clicked', { plan })}
        >
          {t(pastDue ? 'feed.cardGatePastDueCta' : 'feed.cardGateCta')}
        </Link>
      </Button>
    </div>
  )
}
