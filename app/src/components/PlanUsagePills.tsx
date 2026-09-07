import { useTranslation } from 'react-i18next'
import { isUnlimitedFeatured } from '../../../convex/lib/postLimit'
import { Badge } from '@/components/ui/badge'

// The shape returned by posts.getWeeklyUsage (null when not signed in).
export interface WeeklyUsage {
  postsThisWeek: number
  postsPerWeek: number
}

// The shape returned by posts.getFeaturedUsage (null when not signed in).
export interface FeaturedUsage {
  usedCount: number
  featuredPerMonth: number
}

// Weekly-post + featured-post pills shared by My Posts and Recap. flex-wrap so the pills stack as
// whole units (never mid-label) on narrow screens.
export default function PlanUsagePills({
  usage,
  featuredUsage
}: {
  usage: WeeklyUsage | null | undefined
  featuredUsage: FeaturedUsage | null | undefined
}) {
  const { t } = useTranslation()
  const atLimit = usage != null && usage.postsThisWeek >= usage.postsPerWeek
  // Mirrors the >= boundary featurePost enforces server-side (isFeaturedLimitReached).
  const featuredAtCap = featuredUsage != null && featuredUsage.usedCount >= featuredUsage.featuredPerMonth
  return (
    <div className="flex flex-wrap items-center gap-2">
      {usage && (
        <Badge
          title={t('myPosts.weeklyUsageHint')}
          variant={atLimit ? 'warning' : 'primary'}
          className="shrink-0 rounded-full px-3 py-1 text-xs"
        >
          {t('myPosts.weeklyUsage', { used: usage.postsThisWeek, limit: usage.postsPerWeek })}
        </Badge>
      )}
      {featuredUsage && (
        <Badge
          title={t('myPosts.featuredPillHint')}
          variant={featuredAtCap ? 'warning' : 'primary'}
          className="shrink-0 rounded-full px-3 py-1 text-xs"
        >
          {/* The contact/enterprise "unlimited" sentinel (convex/lib/postLimit.ts) is
              never shown as a raw number. */}
          {isUnlimitedFeatured(featuredUsage.featuredPerMonth)
            ? t('myPosts.featuredPillUnlimited', { used: featuredUsage.usedCount })
            : t('myPosts.featuredPill', { used: featuredUsage.usedCount, limit: featuredUsage.featuredPerMonth })}
        </Badge>
      )}
    </div>
  )
}
