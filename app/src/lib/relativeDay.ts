import type { TFunction } from 'i18next'

/** "Today" under a day, "N days ago" after — uses the myPosts.* keys shared by My Posts and History. */
export function timeAgo(ts: number, t: TFunction): string {
  const days = Math.floor((Date.now() - ts) / 86400000)
  if (days <= 0) return t('myPosts.today')
  return t('myPosts.daysAgo', { count: days })
}

/** Inbox-grade relative time: minutes and hours matter here, unlike timeAgo's day buckets. */
export function timeAgoDetailed(ts: number, t: TFunction): string {
  const minutes = Math.floor(Math.max(0, Date.now() - ts) / 60_000)
  if (minutes < 1) return t('notifications.justNow')
  if (minutes < 60) return t('notifications.minutesAgo', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('notifications.hoursAgo', { count: hours })
  return t('notifications.daysAgo', { count: Math.floor(hours / 24) })
}
