import { useMutation, usePaginatedQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { api } from '../convex'
import { PageHeader } from '@/components/PageHeader'
import NotificationRow from '@/components/shell/NotificationRow'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { timeAgoDetailed } from '@/lib/relativeDay'

const PAGE = 20

// NotificationRow owns its own <li> (another wave owns that file), so the card surface and the
// unread marker are applied from the list onto its rows with child variants.
const LIST = 'm-0 flex list-none flex-col gap-3 p-0'
const CARD_ROW = '[&>li]:border-border [&>li]:bg-card [&>li]:rounded-xl [&>li]:border [&>li]:p-4'
const UNREAD_ROW = '[&>li]:border-l-primary [&>li]:border-l-2'

// R23 — the full inbox: newest first, an unread divider above the first unread row, and mark-all-read.
export default function NotificationsPage() {
  const { t } = useTranslation()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const markAllRead = useMutation(api.notifications.markAllRead)
  const markRead = useMutation(api.notifications.markRead)
  const { results, status, loadMore } = usePaginatedQuery(
    api.notifications.listMine,
    sessionToken ? { sessionToken } : 'skip',
    { initialNumItems: PAGE }
  )
  const firstUnread = results.findIndex(row => row.unread)
  const readRows = firstUnread === -1 ? results : results.slice(0, firstUnread)
  const unreadRows = firstUnread === -1 ? [] : results.slice(firstUnread)

  const renderRow = (row: (typeof results)[number]) => (
    <NotificationRow
      key={row.id}
      row={row}
      timeLabel={timeAgoDetailed(row.createdAt, t)}
      onOpen={id => {
        if (sessionToken) void markRead({ sessionToken, ids: [id] })
      }}
    />
  )

  return (
    <div className="mx-auto max-w-160 px-4 py-8 font-sans">
      <PageHeader title={t('notifications.title')}>
        <Button
          variant="outline"
          disabled={!sessionToken}
          onClick={() => {
            if (sessionToken) void markAllRead({ sessionToken })
          }}
        >
          {t('notifications.markAllRead')}
        </Button>
      </PageHeader>

      {status === 'LoadingFirstPage' ? (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="flex flex-col gap-3"
        >
          <div className="bg-muted h-24 animate-pulse rounded-xl" />
          <div className="bg-muted h-24 animate-pulse rounded-xl" />
          <div className="bg-muted h-24 animate-pulse rounded-xl" />
        </div>
      ) : results.length === 0 ? (
        <div className="border-border bg-card rounded-xl border p-8 text-center shadow-xs">
          <p className="text-muted-foreground mt-0 mb-4 text-sm">{t('notifications.empty')}</p>
          <Button asChild>
            <Link to="/feed">{t('history.emptyCta')}</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {readRows.length > 0 && <ul className={cn(LIST, CARD_ROW)}>{readRows.map(renderRow)}</ul>}
            {firstUnread !== -1 && (
              <h2
                id="notifications-new-since"
                className="text-muted-foreground m-0 text-xs font-semibold"
              >
                {t('notifications.newSince')}
              </h2>
            )}
            {unreadRows.length > 0 && (
              <ul
                aria-labelledby="notifications-new-since"
                className={cn(LIST, CARD_ROW, UNREAD_ROW)}
              >
                {unreadRows.map(renderRow)}
              </ul>
            )}
          </div>
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
