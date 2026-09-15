import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Menu, Search } from 'lucide-react'
import { useTrialProgress } from '../../hooks/useTrialProgress'
import LanguageMenu from './LanguageMenu'
import NotificationBell from './NotificationBell'
import ThemeToggle from './ThemeToggle'

/**
 * The command-palette modifier to DISPLAY, per the user's OS: ⌘ on macOS/iOS, Ctrl elsewhere.
 * (The ⌘K / Ctrl-K listener in AppShell already accepts both, so this only affects the hint.)
 * ponytail: navigator.platform is deprecated but the simplest reliable signal in a client-only
 * SPA; swap to navigator.userAgentData?.platform if it ever stops reporting.
 */
export function getModifierKey(
  platform: string = typeof navigator === 'undefined' ? '' : navigator.platform
): '⌘' | 'Ctrl' {
  return /Mac|iP(hone|ad|od)/.test(platform) ? '⌘' : 'Ctrl'
}

const MOD_KEY = getModifierKey()
const IS_MAC = MOD_KEY === '⌘'

export default function TopBar({
  onOpenSidebar,
  onOpenSearch
}: {
  onOpenSidebar: () => void
  onOpenSearch: () => void
}) {
  const { t, i18n } = useTranslation()
  const { isTrialing, progress } = useTrialProgress()

  return (
    <header className="border-border bg-background sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-3 sm:px-4">
      <button
        type="button"
        aria-label={t('shell.openSidebar')}
        onClick={onOpenSidebar}
        className="text-foreground hover:bg-muted focus-visible:ring-ring flex size-9 items-center justify-center rounded-lg outline-none focus-visible:ring-2 lg:hidden"
      >
        <Menu
          className="size-5"
          aria-hidden="true"
        />
      </button>

      <button
        type="button"
        aria-label={t('shell.search')}
        onClick={onOpenSearch}
        className="border-border bg-card text-muted-foreground hover:bg-muted focus-visible:ring-ring ml-auto flex h-9 max-w-64 flex-1 items-center gap-2 rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-2"
      >
        <Search
          className="size-4"
          aria-hidden="true"
        />
        <span className="truncate sm:hidden">{t('shell.searchShort')}</span>
        <span className="hidden truncate sm:inline">{t('shell.search')}</span>
        <kbd className="border-border hidden h-5 flex-row gap-1 rounded border px-1.5 leading-none sm:flex">
          <span className={IS_MAC ? 'pt-1' : 'self-center'}>{MOD_KEY}</span>
          <span className="flex self-center pt-0.5">K</span>
        </kbd>
      </button>

      {/* The sidebar's trial card is a drawer away (closed by default) below lg — this compact
          pill carries the same X/50 meter on every page until the drawer is open. */}
      {isTrialing && progress != null && (
        <Link
          to="/billing"
          title={
            progress.trialEndsAt
              ? t('shell.trialStartsAt', {
                  threshold: progress.threshold,
                  date: new Date(progress.trialEndsAt).toLocaleDateString(i18n.language)
                })
              : undefined
          }
          aria-label={t('shell.trialPillAriaLabel', { combined: progress.combined, threshold: progress.threshold })}
          className="border-border bg-accent text-accent-foreground hover:bg-accent/80 flex h-8 shrink-0 items-center rounded-full border px-2.5 text-xs font-semibold lg:hidden"
        >
          {t('shell.trialPill', { combined: progress.combined, threshold: progress.threshold })}
        </Link>
      )}

      <NotificationBell />
      <LanguageMenu />
      <ThemeToggle />
    </header>
  )
}
