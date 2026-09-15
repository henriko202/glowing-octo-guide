import { useState } from 'react'
import { usePaginatedQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { MessageSquare, Sparkles } from 'lucide-react'
import { api } from '../convex'
import { PageHeader } from '@/components/PageHeader'
import WindowToggle, { type ToggleWindow } from '@/components/WindowToggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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

type HistoryAction = Pick<HistoryRow, 'id' | 'kind' | 'reaction' | 'comment' | 'createdAt'>

interface HistoryGroup {
  key: string
  post: HistoryRow['post']
  createdAt: number
  actions: HistoryAction[]
}

/** Fold consecutive rows on the same post into one group; rows without a post never group. */
function groupHistory(rows: HistoryRow[]): HistoryGroup[] {
  const groups: HistoryGroup[] = []
  for (const row of rows) {
    const last = groups[groups.length - 1]
    if (row.post !== null && last?.post?.id === row.post.id) {
      last.actions.push(row)
      last.createdAt = Math.max(last.createdAt, row.createdAt)
      continue
    }
    groups.push({ key: row.id, post: row.post, createdAt: row.createdAt, actions: [row] })
  }
  return groups
}

/** The one body shown per group: the newest comment wins, else the newest AI draft with text. */
function groupBody(group: HistoryGroup): string | undefined {
  const comment = group.actions.find(action => action.kind === 'comment' && action.comment)
  return (comment ?? group.actions.find(action => action.kind === 'ai_draft' && action.comment))?.comment
}

function ActionChip({ action }: { action: HistoryAction }) {
  const { t } = useTranslation()
  const reaction = action.kind === 'reaction' ? REACTIONS.find(r => r.value === action.reaction) : undefined
  const aiDraft = action.kind === 'ai_draft'
  const label = reaction
    ? t('history.youReactedWith', { reaction: t(reaction.labelKey) })
    : aiDraft
      ? t('history.youDrafted')
      : t('history.youCommented')
  return (
    <Badge className="gap-1">
      {/* Glyph and label are separate nodes so AT reads only the label, never the glyph. */}
      {reaction ? (
        <span aria-hidden="true">{reaction.emoji}</span>
      ) : aiDraft ? (
        <Sparkles
          aria-hidden="true"
          className="size-3.5 shrink-0"
        />
      ) : (
        <MessageSquare
          aria-hidden="true"
          className="size-3.5 shrink-0"
        />
      )}
      <span>{label}</span>
    </Badge>
  )
}

function GroupCard({ group }: { group: HistoryGroup }) {
  const { t, i18n } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const body = groupBody(group)
  const long = body !== undefined && isLong(body)
  const when = new Date(group.createdAt)
  return (
    <li className="border-border bg-card flex flex-col gap-2 rounded-xl border p-4 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="flex flex-wrap items-center gap-1">
          {group.actions.map(action => (
            <ActionChip
              key={action.id}
              action={action}
            />
          ))}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <time
              dateTime={when.toISOString()}
              className="text-muted-foreground shrink-0 text-xs"
              tabIndex={0}
            >
              {timeAgo(group.createdAt, t)}
            </time>
          </TooltipTrigger>
          <TooltipContent>{when.toLocaleString(i18n.language)}</TooltipContent>
        </Tooltip>
      </div>
      {body && (
        <>
          <p
            className={cn(
              'text-foreground m-0 text-sm break-words whitespace-pre-wrap',
              long && !expanded && 'line-clamp-6'
            )}
          >
            {body}
          </p>
          {long && (
            <button
              type="button"
              className="text-primary min-h-10 self-start text-xs hover:underline"
              aria-expanded={expanded}
              onClick={() => setExpanded(e => !e)}
            >
              {t(expanded ? 'history.showLess' : 'history.showMore')}
            </button>
          )}
        </>
      )}
      <div className="text-xs">
        {group.post ? (
          <div className="flex flex-col gap-1">
            <p className={cn('m-0 line-clamp-2', group.post.removed ? 'text-muted-foreground' : 'text-foreground')}>
              {group.post.excerpt}
            </p>
            <p className="text-muted-foreground m-0 flex flex-wrap items-center gap-2">
              {group.post.authorName && <span>{t('history.by', { name: group.post.authorName })}</span>}
              {group.post.removed && <Badge variant="outline">{t('history.removed')}</Badge>}
              <a
                href={buildPostUrl(group.post.linkedinPostUrn, group.post.sourceUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {t('feed.viewOnLinkedIn')}
              </a>
            </p>
          </div>
        ) : (
          <Badge variant="outline">{t('history.removed')}</Badge>
        )}
      </div>
    </li>
  )
}

// backlog/R16 — every recorded interaction, newest first. Comments are shown verbatim. Consecutive rows on the
// same post fold into one card so a react + comment + AI draft on one post reads as one activity.
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

  const groups = groupHistory(results)

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
          className="flex flex-col gap-3"
        >
          <div className="bg-muted h-32 animate-pulse rounded-xl" />
          <div className="bg-muted h-32 animate-pulse rounded-xl" />
          <div className="bg-muted h-32 animate-pulse rounded-xl" />
        </div>
      ) : results.length === 0 ? (
        <div className="border-border bg-card rounded-xl border p-8 text-center shadow-xs">
          <p className="text-muted-foreground mt-0 mb-4 text-sm">{t('history.empty')}</p>
          <Button asChild>
            <Link to="/feed">{t('history.emptyCta')}</Link>
          </Button>
        </div>
      ) : (
        <>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {groups.map(group => (
              <GroupCard
                key={group.key}
                group={group}
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
