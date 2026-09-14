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
    return t('rankings.count', { count: row.count })
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
        {rows.map((row, index) => {
          const rank = index + 1
          const isMe = row.userId === meId
          return (
            <li
              key={row.userId}
              className={cn(
                'border-border bg-card flex items-center gap-3 rounded-lg border px-3 py-2',
                isMe && 'ring-primary/40 ring-1'
              )}
            >
              <span
                className={cn('w-6 shrink-0 text-right text-sm tabular-nums', rankChipClass(rank))}
                aria-label={t('rankings.rankLabel', { rank })}
              >
                {rank}
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
        })}
      </ol>
    </section>
  )
}
