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
}

/** Top-3 rows carry the visible "medal" treatment (a filled chip); 4+ stay plain numbers. */
function rankChipClass(rank: number): string {
  return rank <= 3
    ? 'bg-primary text-primary-foreground inline-flex size-6 items-center justify-center rounded-full text-xs'
    : ''
}

export default function RankingList({
  titleKey,
  rows,
  meId,
  titleTo
}: {
  titleKey: string
  rows: RankingRow[]
  meId?: string
  titleTo?: string
}) {
  const { t } = useTranslation()
  const title = t(titleKey)
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
              className={cn('flex items-center gap-3 rounded-lg border px-3 py-2', isMe && 'bg-muted')}
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
              <span className="text-muted-foreground shrink-0 text-xs">
                {t('rankings.count', { count: row.count })}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
