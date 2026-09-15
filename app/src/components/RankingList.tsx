import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

export interface RankingRow {
  userId: string
  name: string
  headline?: string
  profilePictureUrl?: string
  count: number
  lastAt: number
  reactionsReceived?: number
  postsTouched?: number
  postsCount?: number
  position?: number
}

export type RankingVariant = 'personal' | 'posts' | 'interactors'

/** Top-3 rows carry the visible "medal" treatment (gold, silver, bronze); 4+ stay plain numbers. */
function rankChipClass(rank: number): string {
  const chip = 'inline-flex size-6 items-center justify-center rounded-full text-xs ring-1 ring-black/5'
  if (rank === 1) return `bg-amber-400 text-amber-950 ${chip}`
  if (rank === 2) return `bg-zinc-300 text-zinc-900 ${chip}`
  if (rank === 3) return `bg-amber-700 text-amber-50 ${chip}`
  return ''
}

/** The same medal palette tints the card border of the top 3; 4+ keep the neutral border. */
function rankBorderClass(rank: number): string {
  if (rank === 1) return 'border-amber-500'
  if (rank === 2) return 'border-zinc-400'
  if (rank === 3) return 'border-amber-700'
  return 'border-border'
}

/** Positions 1-10 always render; beyond #12 the list windows to the member plus two rows either side. */
const TOP_VISIBLE = 10
const WINDOW_BUFFER = 2

export default function RankingList({
  titleKey,
  rows,
  variant,
  meId,
  titleTo
}: {
  titleKey: string
  rows: RankingRow[]
  variant: RankingVariant
  meId?: string
  titleTo?: string
}) {
  const { t } = useTranslation()
  const title = t(titleKey)

  function rowMeta(row: RankingRow): string {
    if (variant === 'posts') {
      return `${t('rankings.postsCount', { count: row.count })} · ${t('rankings.reactionsCount', { count: row.reactionsReceived ?? 0 })}`
    }
    if (variant === 'interactors') {
      return `${t('rankings.interactionsCount', { count: row.count })} · ${t('rankings.postsTouched', { count: row.postsTouched ?? 0 })}`
    }
    return `${t('rankings.count', { count: row.count })} · ${t('rankings.postsCount', { count: row.postsCount ?? 0 })}`
  }

  // `position` comes from the server for site rows (competition rank over the filtered list). Personal
  // rows are just their display order, so the array index is the rank fallback.
  const positioned = rows.map((row, index) => ({ row, position: row.position ?? index + 1 }))
  const mePosition = meId ? positioned.find(entry => entry.row.userId === meId)?.position : undefined
  const windowed =
    mePosition !== undefined &&
    mePosition > TOP_VISIBLE + WINDOW_BUFFER &&
    positioned.length > TOP_VISIBLE + WINDOW_BUFFER
  const topRows = windowed ? positioned.filter(entry => entry.position <= TOP_VISIBLE) : positioned
  const aroundRows =
    windowed && mePosition !== undefined
      ? positioned.filter(
          entry => entry.position >= mePosition - WINDOW_BUFFER && entry.position <= mePosition + WINDOW_BUFFER
        )
      : []

  function renderRow(entry: { row: RankingRow; position: number }) {
    const { row, position } = entry
    const isMe = row.userId === meId
    return (
      <li
        key={row.userId}
        className={cn(
          'bg-card flex items-center gap-3 rounded-lg border px-3 py-2',
          rankBorderClass(position),
          isMe && 'ring-primary/40 ring-1'
        )}
      >
        <span
          className={cn('w-6 shrink-0 text-right text-sm tabular-nums', rankChipClass(position))}
          aria-label={t('rankings.rankLabel', { rank: position })}
        >
          {position}
        </span>
        <Avatar
          name={row.name}
          src={row.profilePictureUrl}
          size="sm"
        />
        <span className="text-foreground min-w-0 flex-1 truncate text-sm">{row.name}</span>
        <span className="text-muted-foreground shrink-0 text-xs">{rowMeta(row)}</span>
      </li>
    )
  }

  return (
    <section className="mt-4">
      {titleTo ? (
        <Link
          to={titleTo}
          className="text-foreground mb-2 block text-sm font-semibold hover:underline"
        >
          {title}
        </Link>
      ) : (
        <h2 className="text-foreground mb-2 text-sm font-semibold">{title}</h2>
      )}
      <ol className="m-0 flex list-none flex-col gap-1 p-0">
        {topRows.map(renderRow)}
        {windowed && (
          <li
            aria-hidden="true"
            className="text-muted-foreground px-3 py-1 text-center text-xs"
          >
            …
          </li>
        )}
        {aroundRows.map(renderRow)}
      </ol>
    </section>
  )
}
