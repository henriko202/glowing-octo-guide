import { useState } from 'react'
import { usePaginatedQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { api } from '../convex'
import { PageHeader } from '@/components/PageHeader'
import WindowToggle, { type ToggleWindow } from '@/components/WindowToggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { buildPostUrl } from '@/components/LinkedInEmbed'
import { timeAgo } from '@/lib/relativeDay'
import { cn } from '@/lib/utils'
import type { HistoryRow } from '../../../convex/lib/history'
import { REACTIONS } from '../../../convex/lib/reactions'
import { floorToHour, windowBounds } from '../../../convex/lib/recap'

const WINDOWS = ['7d', '30d', 'all'] as const
const PAGE = 20
const LONG_CHARS = 280
const LONG_LINES = 6

function isLong(comment: string): boolean {
  return comment.length > LONG_CHARS || comment.split('\n').length > LONG_LINES
}

function Row({ row }: { row: HistoryRow }) {
  const { t, i18n } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const reaction = row.kind === 'reaction' ? REACTIONS.find(r => r.value === row.reaction) : undefined
  const aiDraft = row.kind === 'ai_draft'
  const long = (row.kind === 'comment' || aiDraft) && !!row.comment && isLong(row.comment)
  const when = new Date(row.createdAt)
  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-foreground m-0 text-sm font-semibold">
          {/* Emoji and label are separate spans so AT reads only the label, never the glyph. */}
          <span aria-hidden="true">{reaction ? reaction.emoji : aiDraft ? '🤖' : '💬'}</span>{' '}
          <span>{reaction ? t(reaction.labelKey) : aiDraft ? t('history.aiDrafted') : t('history.commented')}</span>
        </p>
        {(row.kind === 'comment' || aiDraft) && row.comment && (
          <>
            <p
              className={cn(
                'text-foreground mt-1 mb-0 text-sm break-words whitespace-pre-wrap',
                long && !expanded && 'line-clamp-6'
              )}
            >
              {row.comment}
            </p>
            {long && (
              <button
                type="button"
                className="text-primary mt-1 min-h-10 text-xs hover:underline"
                aria-expanded={expanded}
                onClick={() => setExpanded(e => !e)}
              >
                {t(expanded ? 'history.showLess' : 'history.showMore')}
              </button>
            )}
          </>
        )}
        <div className="mt-2 text-xs">
          {row.post ? (
            <>
              <p className={cn('m-0 line-clamp-2', row.post.removed ? 'text-muted-foreground' : 'text-foreground')}>
                {row.post.excerpt}
              </p>
              <p className="text-muted-foreground m-0 mt-1 flex flex-wrap items-center gap-2">
                {row.post.authorName && <span>{t('history.by', { name: row.post.authorName })}</span>}
                {row.post.removed && <Badge variant="outline">{t('history.removed')}</Badge>}
                <a
                  href={buildPostUrl(row.post.linkedinPostUrn, row.post.sourceUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {t('feed.viewOnLinkedIn')}
                </a>
              </p>
            </>
          ) : (
            <Badge variant="outline">{t('history.removed')}</Badge>
          )}
        </div>
      </div>
      <time
        dateTime={when.toISOString()}
        title={when.toLocaleString(i18n.language)}
        className="text-muted-foreground shrink-0 text-xs"
      >
        {timeAgo(row.createdAt, t)}
      </time>
    </li>
  )
}

// backlog/R16 — every recorded interaction, newest first. Comments are shown verbatim.
export default function HistoryPage() {
  const { t } = useTranslation()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const [range, setRange] = useState<ToggleWindow>('30d')
  // Floored to the hour so the query args are stable across renders (one Convex subscription).
  const [now] = useState(() => floorToHour(Date.now()))
  const since = range === 'all' ? 0 : windowBounds(range, now).since
  const { results, status, loadMore } = usePaginatedQuery(
    api.interactions.listMyInteractions,
    sessionToken ? { sessionToken, since } : 'skip',
    { initialNumItems: PAGE }
  )

  return (
    <div className="mx-auto max-w-160 px-4 py-8 font-sans">
      {/* Header + window toggle stay mounted through loading, same as Recap (F1) — LoadingSpinner is a
          fixed viewport overlay, not a content-region placeholder, so it never stands in here. */}
      <PageHeader
        title={t('history.title')}
        lead={t('history.lead')}
      >
        <WindowToggle
          value={range}
          onChange={setRange}
          options={WINDOWS}
        />
      </PageHeader>

      {status === 'LoadingFirstPage' ? (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="space-y-3"
        >
          <div className="bg-muted h-16 animate-pulse rounded-xl" />
          <div className="bg-muted h-16 animate-pulse rounded-xl" />
          <div className="bg-muted h-16 animate-pulse rounded-xl" />
        </div>
      ) : results.length === 0 ? (
        <div className="bg-card rounded-xl border p-8 text-center">
          <p className="text-muted-foreground mt-0 mb-4 text-sm">{t('history.empty')}</p>
          <Button asChild>
            <Link to="/feed">{t('history.emptyCta')}</Link>
          </Button>
        </div>
      ) : (
        <>
          <ul className="divide-border m-0 list-none divide-y p-0">
            {results.map(row => (
              <Row
                key={row.id}
                row={row}
              />
            ))}
          </ul>
          {status === 'CanLoadMore' && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={() => loadMore(PAGE)}
              >
                {t('feed.loadMore')}
              </Button>
            </div>
          )}
          {status === 'LoadingMore' && <p className="text-muted-foreground text-center text-xs">…</p>}
        </>
      )}
    </div>
  )
}
