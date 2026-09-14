import { useTranslation } from 'react-i18next'
import { buildPostUrl } from '@/components/LinkedInEmbed'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface NotificationRowData {
  id: string
  kind: 'reaction' | 'comment'
  excerpt?: string
  unread: boolean
  actorName: string
  actorPictureUrl?: string
  postExcerpt: string
  postUrn: string
  postSourceUrl?: string
  removed: boolean
}

export default function NotificationRow({
  row,
  timeLabel,
  onOpen
}: {
  row: NotificationRowData
  timeLabel: string
  /** Called when the member activates the row; pages use it to mark the notification read. */
  onOpen?: (id: string) => void
}) {
  const { t } = useTranslation()
  const open = () => onOpen?.(row.id)
  const body = (
    <span className="flex items-start gap-2">
      <Avatar
        name={row.actorName}
        src={row.actorPictureUrl}
        size="sm"
      />
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm', row.unread ? 'text-foreground font-medium' : 'text-muted-foreground')}>
          {row.kind === 'comment'
            ? t('notifications.commented', { name: row.actorName })
            : t('notifications.reacted', { name: row.actorName })}
          {row.unread && (
            <span
              data-testid="notification-unread-dot"
              aria-hidden="true"
              className="bg-primary ml-2 inline-block size-2 shrink-0 rounded-full align-middle"
            />
          )}
        </span>
        {row.excerpt && <span className="text-muted-foreground block truncate text-xs">{row.excerpt}</span>}
        {row.removed && (
          <Badge
            variant="outline"
            className="mt-1"
          >
            {t('notifications.removed')}
          </Badge>
        )}
        <span className="text-muted-foreground block text-xs">{timeLabel}</span>
      </span>
    </span>
  )
  return (
    <li className={cn('rounded-md p-2', row.unread && 'bg-muted/60')}>
      {row.removed ? (
        <div onClick={open}>{body}</div>
      ) : (
        <a
          href={buildPostUrl(row.postUrn, row.postSourceUrl)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={open}
        >
          {body}
        </a>
      )}
    </li>
  )
}
