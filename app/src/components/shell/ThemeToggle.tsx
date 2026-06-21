import { useTranslation } from 'react-i18next'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../ThemeProvider'

export default function ThemeToggle() {
  const { t } = useTranslation()
  const { resolved, setPref } = useTheme()
  const isDark = resolved === 'dark'

  return (
    <button
      type="button"
      aria-label={t('shell.theme')}
      onClick={() => setPref(isDark ? 'light' : 'dark')}
      className="border-border text-foreground hover:bg-muted focus-visible:ring-ring flex size-9 items-center justify-center rounded-lg border outline-none focus-visible:ring-2"
    >
      {isDark ? (
        <Sun
          className="size-[18px]"
          aria-hidden="true"
        />
      ) : (
        <Moon
          className="size-[18px]"
          aria-hidden="true"
        />
      )}
    </button>
  )
}
