import { Fragment } from 'react'
import { useMutation, usePaginatedQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { api } from '../convex'
import { PageHeader } from '@/components/PageHeader'
import NotificationRow from '@/components/shell/NotificationRow'
import { Button } from '@/components/ui/button'
import { timeAgoDetailed } from '@/lib/relativeDay'

const PAGE = 20

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
          className="space-y-3"
        >
          <div className="bg-muted h-16 animate-pulse rounded-xl" />
          <div className="bg-muted h-16 animate-pulse rounded-xl" />
          <div className="bg-muted h-16 animate-pulse rounded-xl" />
        </div>
      ) : results.length === 0 ? (
        <div className="bg-card rounded-xl border p-8 text-center">
          <p className="text-muted-foreground mt-0 mb-4 text-sm">{t('notifications.empty')}</p>
          <Button asChild>
            <Link to="/feed">{t('history.emptyCta')}</Link>
          </Button>
        </div>
      ) : (
        <>
          <ul className="divide-border m-0 list-none divide-y p-0">
            {results.map((row, index) => (
              <Fragment key={row.id}>
                {index === firstUnread && (
                  <li className="text-muted-foreground m-0 px-2 py-2 text-xs font-semibold">
                    {t('notifications.newSince')}
                  </li>
                )}
                <NotificationRow
                  row={row}
                  timeLabel={timeAgoDetailed(row.createdAt, t)}
                  onOpen={id => {
                    if (sessionToken) void markRead({ sessionToken, ids: [id] })
                  }}
                />
              </Fragment>
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
