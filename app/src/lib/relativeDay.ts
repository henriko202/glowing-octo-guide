import type { TFunction } from 'i18next'

/** "Today" under a day, "N days ago" after — uses the myPosts.* keys shared by My Posts and History. */
export function timeAgo(ts: number, t: TFunction): string {
  const days = Math.floor((Date.now() - ts) / 86400000)
  if (days <= 0) return t('myPosts.today')
  return t('myPosts.daysAgo', { count: days })
}
