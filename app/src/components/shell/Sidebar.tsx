import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { NAV_GROUPS, isActivePath } from './navItems'
import UserMenu from './UserMenu'
import BrandMark from '../BrandMark'
import { useCardGate } from '../../hooks/useCardGate'

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation()
  const { t } = useTranslation()
  const { gated } = useCardGate()

  return (
    <div className="bg-sidebar text-sidebar-foreground flex h-full flex-col">
      <div className="px-4 py-4">
        <BrandMark />
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
            <p className="text-muted-foreground px-2 pt-3 pb-1 text-[11px] font-semibold tracking-wide uppercase">
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
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60',
                    item.path === '/billing' && gated && 'text-primary animate-pulse'
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
        <a
          href="https://linkedin.com/sales/ssi"
          target="_blank"
          rel="noopener noreferrer"
          className="mb-2 flex items-center gap-2 px-3 py-1.5 text-[13px] text-gold-text hover:underline"
        >
          {t('nav.viewSsi')} ↗
        </a>
        <UserMenu />
      </div>
    </div>
  )
}
