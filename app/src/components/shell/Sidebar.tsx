import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Link as LinkIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_GROUPS, isActivePath } from './navItems'
import UserMenu from './UserMenu'

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation()
  const { t } = useTranslation()

  return (
    <div className="bg-sidebar text-sidebar-foreground flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
          <LinkIcon
            className="size-4"
            aria-hidden="true"
          />
        </span>
        <span
          className="font-display text-base font-semibold"
          translate="no"
        >
          Link Into The SSI
        </span>
      </div>

      <nav
        aria-label={t('nav.primary')}
        className="flex-1 overflow-y-auto px-3 py-2"
      >
        {NAV_GROUPS.map(group => (
          <div
            key={group.labelKey}
            className="mb-2"
          >
            <p className="text-muted-foreground px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide">
              {t(group.labelKey)}
            </p>
            {group.items.map(item => {
              const active = isActivePath(item.path, pathname)
              const Icon = item.icon
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium no-underline transition-colors',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60'
                  )}
                >
                  <Icon
                    className="size-[18px]"
                    aria-hidden="true"
                  />
                  {t(item.labelKey)}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="border-sidebar-border border-t p-3">
        <UserMenu />
      </div>
    </div>
  )
}
