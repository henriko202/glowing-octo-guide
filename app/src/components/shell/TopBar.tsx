import { useTranslation } from 'react-i18next'
import { Menu, Search } from 'lucide-react'
import LanguageMenu from './LanguageMenu'
import ThemeToggle from './ThemeToggle'

export default function TopBar({
  onOpenSidebar,
  onOpenSearch
}: {
  onOpenSidebar: () => void
  onOpenSearch: () => void
}) {
  const { t } = useTranslation()

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
        <span className="truncate">{t('shell.search')}</span>
        <kbd className="border-border flex h-5 flex-row gap-1 rounded border px-1.5 leading-none">
          <span className="pt-1">⌘</span>
          <span className="flex self-center pt-0.5">K</span>
        </kbd>
      </button>

      <LanguageMenu />
      <ThemeToggle />
    </header>
  )
}
