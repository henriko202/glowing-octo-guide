import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bell } from 'lucide-react'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { api } from '../../convex'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { buildPostUrl } from '@/components/LinkedInEmbed'
import { timeAgoDetailed } from '@/lib/relativeDay'
import NotificationRow from './NotificationRow'

const PREVIEW = 5

// R23 — bell, unread badge, preview popover and the new-notification toast. The toast dedups on the newest id via
// refs (seed on first sighting, toast only when a newer id appears), so a reload never repeats one. Browser
// notifications are Phase 2.
export default function NotificationBell() {
  const { t } = useTranslation()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const [open, setOpen] = useState(false)
  const unread = useQuery(api.notifications.getUnreadCount, sessionToken ? { sessionToken } : 'skip')
  const latest = useQuery(api.notifications.getLatest, sessionToken ? { sessionToken } : 'skip')
  const markAllRead = useMutation(api.notifications.markAllRead)
  const markRead = useMutation(api.notifications.markRead)
  const { results, status } = usePaginatedQuery(api.notifications.listMine, sessionToken ? { sessionToken } : 'skip', {
    initialNumItems: PREVIEW
  })
  const seeded = useRef(false)
  const seenId = useRef<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // Loading (undefined) is not an empty inbox: the seed must wait for the first resolved value, null included.
    // Otherwise a member whose inbox is empty at mount would seed on null and never toast their first notification.
    if (latest === undefined) return
    if (!seeded.current) {
      seeded.current = true
      seenId.current = latest?._id ?? null
      return
    }
    if (latest === null || seenId.current === latest._id) return
    seenId.current = latest._id
    const message =
      latest.kind === 'record'
        ? t('notifications.toastRecord', { count: latest.total ?? 0 })
        : latest.kind === 'comment'
          ? t('notifications.toastComment', { name: latest.actorName })
          : t('notifications.toastReaction', { name: latest.actorName })
    if (latest.postUrn && latest.removed !== true) {
      const { postUrn, postSourceUrl } = latest
      toast(message, {
        onClick: () => window.open(buildPostUrl(postUrn, postSourceUrl), '_blank', 'noopener,noreferrer')
      })
      return
    }
    toast(message)
  }, [latest, t])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const label =
    unread && unread > 0 ? t('notifications.bellLabel', { count: unread }) : t('notifications.bellLabelNone')

  return (
    <div
      className="relative"
      ref={wrapperRef}
    >
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={() => setOpen(value => !value)}
        className="hover:bg-muted relative inline-flex size-10 items-center justify-center rounded-full"
      >
        <Bell
          className="size-5"
          aria-hidden="true"
        />
        {unread !== undefined && unread > 0 && (
          <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 min-w-4 rounded-full px-1 text-[10px] leading-4 tabular-nums">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          id="notification-panel"
          className="bg-background absolute right-0 z-50 mt-2 w-80 rounded-lg border shadow-lg"
        >
          <ul className="m-0 flex list-none flex-col p-1">
            {results.map(row => (
              <NotificationRow
                key={row.id}
                row={row}
                timeLabel={timeAgoDetailed(row.createdAt, t)}
                onOpen={id => {
                  if (sessionToken) void markRead({ sessionToken, ids: [id] })
                }}
              />
            ))}
            {results.length === 0 && status !== 'LoadingFirstPage' && (
              <li className="text-muted-foreground p-3 text-sm">{t('notifications.empty')}</li>
            )}
          </ul>
          <div className="flex items-center justify-between border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (sessionToken) void markAllRead({ sessionToken })
              }}
            >
              {t('notifications.markAllRead')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              asChild
            >
              <Link to="/notifications">{t('notifications.seeAll')}</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
