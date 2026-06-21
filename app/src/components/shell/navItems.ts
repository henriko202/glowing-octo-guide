import { Rss, FileText, CreditCard, Settings, ShieldCheck, type LucideIcon } from 'lucide-react'

export type NavItem = { path: string; labelKey: string; icon: LucideIcon }
export type NavGroup = { labelKey: string; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: 'nav.groups.main',
    items: [
      { path: '/feed', labelKey: 'nav.feed', icon: Rss },
      { path: '/my-posts', labelKey: 'nav.myPosts', icon: FileText }
    ]
  },
  {
    labelKey: 'nav.groups.manage',
    items: [
      { path: '/billing', labelKey: 'nav.billing', icon: CreditCard },
      { path: '/settings', labelKey: 'nav.settings', icon: Settings },
      { path: '/privacy-data', labelKey: 'nav.privacy', icon: ShieldCheck }
    ]
  }
]

export function isActivePath(itemPath: string, pathname: string): boolean {
  return itemPath === pathname
}
