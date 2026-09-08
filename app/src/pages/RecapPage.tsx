import { useEffect, useRef, useState } from 'react'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { api } from '../convex'
import { PageHeader } from '@/components/PageHeader'
import PlanUsagePills, { type FeaturedUsage, type WeeklyUsage } from '@/components/PlanUsagePills'
import TrialMeter from '@/components/TrialMeter'
import UpgradeAtLimit from '@/components/UpgradeAtLimit'
import WindowToggle from '@/components/WindowToggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { buildPostUrl } from '@/components/LinkedInEmbed'
import { useTrialProgress } from '@/hooks/useTrialProgress'
import { captureEvent } from '@/lib/observability/analytics'
import {
  floorToHour,
  RECAP_ROW_CEILING,
  windowDays,
  type RecapCounts,
  type RecapWindow
} from '../../../convex/lib/recap'
import { INVITED_TRIAL_PERIOD_DAYS } from '../../../convex/lib/trialMilestone'

const WINDOWS = ['7d', '30d'] as const

function Tile({
  label,
  counts,
  previous,
  days
}: {
  label: string
  counts: RecapCounts
  previous: RecapCounts
  days: number
}) {
  const { t, i18n } = useTranslation()
  const delta = counts.total - previous.total
  const signed = new Intl.NumberFormat(i18n.language, { signDisplay: 'exceptZero' }).format(delta)
  return (
    <div className="bg-card rounded-xl border p-5">
      <p className="text-muted-foreground m-0 text-sm">{label}</p>
      <p className="text-foreground m-0 mt-1 font-display text-4xl font-semibold tabular-nums">{counts.total}</p>
      <p className="text-muted-foreground m-0 mt-2 text-xs">
        {[
          t('recap.reactionsCount', { count: counts.reactions }),
          t('recap.commentsCount', { count: counts.comments }),
          t('recap.postsCount', { count: counts.posts })
        ].join(' · ')}
      </p>
      {previous.total > 0 && (
        <p className="text-muted-foreground m-0 mt-1 text-xs tabular-nums">
          {t('recap.delta', { delta: signed, days })}
        </p>
      )}
      {counts.total > previous.total && previous.total > 0 && (
        <p className="text-foreground m-0 mt-2 text-xs font-medium">{t('recap.celebrate', { days })}</p>
      )}
    </div>
  )
}

// backlog/R15 — the in-app recap. Real recorded numbers only; never the SSI itself.
export default function RecapPage() {
  const { t } = useTranslation()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const [range, setRange] = useState<RecapWindow>('7d')
  // Floored to the hour so the query args are stable across renders (one Convex subscription).
  const [now] = useState(() => floorToHour(Date.now()))
  const recap = useQuery(api.interactions.getRecap, sessionToken ? { sessionToken, window: range, now } : 'skip')
  const usage = useQuery(api.posts.getWeeklyUsage, { sessionToken }) as WeeklyUsage | null | undefined
  const featuredUsage = useQuery(api.posts.getFeaturedUsage, { sessionToken }) as FeaturedUsage | null | undefined
  const { isTrialing, progress } = useTrialProgress()
  const tracked = useRef<RecapWindow | null>(null)

  useEffect(() => {
    if (!recap || tracked.current === recap.window) return
    tracked.current = recap.window
    captureEvent('recap_viewed', { window: recap.window, nearCap: recap.nearCapPost !== null })
  }, [recap])

  // Safe defaults while `recap` is still loading — only read once the loaded branch below narrows it.
  const days = recap ? windowDays(recap.window) : 7
  const cap = recap?.plan.interactionsPerPost ?? 0
  const empty = recap
    ? recap.made.current.total === 0 && recap.received.current.total === 0 && recap.posts.length === 0
    : false

  return (
    <div className="mx-auto max-w-160 px-4 py-8 font-sans">
      {/* Header + window toggle stay mounted through loading (F1) — Convex's useQuery returns
          undefined for every arg change (not just the first load), so gating the whole page on it
          would unmount this on every 7d/30d toggle and blow away the button's keyboard focus. */}
      <PageHeader
        title={t('recap.title')}
        lead={t('recap.lead')}
      >
        <WindowToggle
          value={range}
          onChange={setRange}
          options={WINDOWS}
        />
      </PageHeader>

      {recap === undefined ? (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="grid gap-4 sm:grid-cols-2"
        >
          <div className="bg-muted h-32 animate-pulse rounded-xl" />
          <div className="bg-muted h-32 animate-pulse rounded-xl" />
        </div>
      ) : (
        <>
          {isTrialing && progress && (
            <div className="bg-card mb-6 rounded-xl border p-4">
              <TrialMeter progress={progress} />
            </div>
          )}

          {empty ? (
            <div className="bg-card rounded-xl border p-8 text-center">
              <h2 className="text-foreground m-0 text-lg font-semibold">{t('recap.emptyTitle', { days })}</h2>
              <p className="text-muted-foreground mt-2 mb-4 text-sm">{t('recap.emptyBody')}</p>
              <Button asChild>
                <Link to="/feed">{t('recap.emptyCta')}</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Tile
                  label={t('recap.made')}
                  counts={recap.made.current}
                  previous={recap.made.previous}
                  days={days}
                />
                <Tile
                  label={t('recap.received')}
                  counts={recap.received.current}
                  previous={recap.received.previous}
                  days={days}
                />
              </div>
              {recap.truncated && (
                <p className="text-muted-foreground mt-2 mb-0 text-xs">
                  {t('recap.truncated', { count: RECAP_ROW_CEILING })}
                </p>
              )}

              {recap.nearCapPost && (
                <section className="mt-6">
                  <div className="bg-card rounded-xl border p-4">
                    <p className="text-muted-foreground m-0 line-clamp-2 text-sm italic">{recap.nearCapPost.excerpt}</p>
                    <UpgradeAtLimit
                      limit="interactionCap"
                      nearCap={{ total: recap.nearCapPost.total, cap }}
                      className="mt-2 block"
                    />
                  </div>
                </section>
              )}

              <section className="mt-8">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-foreground m-0 text-base font-semibold">{t('recap.planUsage')}</h2>
                  <PlanUsagePills
                    usage={usage}
                    featuredUsage={featuredUsage}
                  />
                </div>
                {recap.posts.length === 0 ? (
                  <p className="text-muted-foreground m-0 text-sm">{t('recap.noPosts')}</p>
                ) : (
                  <ul className="divide-border m-0 list-none divide-y p-0">
                    {recap.posts.map(p => {
                      const total = p.likeCount + p.commentCount
                      const label = t('recap.postUsage', { total, cap })
                      const labelId = `usage-${p.id}`
                      const pct = p.interactionLimitReached
                        ? 100
                        : cap > 0
                          ? Math.min(100, Math.round((total / cap) * 100))
                          : 0
                      return (
                        <li
                          key={p.id}
                          className="py-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <a
                              href={buildPostUrl(p.linkedinPostUrn, p.sourceUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-foreground line-clamp-2 min-w-0 flex-1 text-sm no-underline hover:underline"
                            >
                              {p.excerpt}
                            </a>
                            {p.isFeatured && <Badge variant="primary">{t('feed.featured')}</Badge>}
                            {p.interactionLimitReached && (
                              <Badge
                                variant="warning"
                                className="rounded-full px-2 py-0.5 text-[11px]"
                              >
                                {t('myPosts.interactionCapBadge', { limit: cap })}
                              </Badge>
                            )}
                          </div>
                          <p
                            id={labelId}
                            className="text-muted-foreground mt-1 mb-1 text-xs tabular-nums"
                          >
                            {label}
                          </p>
                          <div
                            role="progressbar"
                            aria-labelledby={labelId}
                            aria-valuemin={0}
                            aria-valuemax={cap}
                            aria-valuenow={Math.min(total, cap)}
                            className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
                          >
                            <div
                              className="bg-primary h-full rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            </>
          )}

          {/* F7 — honesty line + History link belong to both the empty and non-empty states, so
              they sit after the empty/non-empty branch instead of inside only one of them. */}
          <footer className="text-muted-foreground mt-8 space-y-2 text-xs">
            <p className="m-0">{t('recap.honest')}</p>
            <p className="m-0">
              {t('recap.salesNav')}{' '}
              <a
                href="https://www.linkedin.com/sales/ssi"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                linkedin.com/sales/ssi
              </a>
            </p>
            <p className="m-0">
              <Link
                to="/history"
                className="text-primary hover:underline"
              >
                {t('recap.seeAll')}
              </Link>
            </p>
            {/* backlog/R19 — only when people are finding them: an ask made from strength, not need. */}
            {recap.received.current.total > 0 && (
              <p className="m-0">
                {t('recap.inviteLine', { days: INVITED_TRIAL_PERIOD_DAYS })}{' '}
                <Link
                  to="/settings#invite"
                  className="text-primary hover:underline"
                >
                  {t('feed.inviteLink')}
                </Link>
              </p>
            )}
          </footer>
        </>
      )}
    </div>
  )
}
