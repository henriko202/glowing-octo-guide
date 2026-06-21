import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog } from 'radix-ui'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="bg-background flex min-h-dvh">
      <a
        href="#main-content"
        className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:px-3 focus:py-2"
      >
        {t('shell.skipToContent')}
      </a>

      {/* Persistent sidebar (desktop) — sticky + viewport-tall so the user chip stays pinned to
          the bottom of the screen while the page scrolls (page-scroll model preserved for the
          feed's window virtualizer). */}
      <aside className="border-sidebar-border hidden w-56 shrink-0 border-r lg:sticky lg:top-0 lg:block lg:h-dvh lg:self-start">
        <Sidebar />
      </aside>

      {/* Drawer (mobile) */}
      <Dialog.Root
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 lg:hidden" />
          <Dialog.Content
            aria-label={t('nav.primary')}
            className="fixed inset-y-0 left-0 z-50 w-64 overscroll-contain outline-none lg:hidden"
          >
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenSidebar={() => setDrawerOpen(true)} />
        <main
          id="main-content"
          className="flex-1"
        >
          {children}
        </main>
      </div>
    </div>
  )
}
