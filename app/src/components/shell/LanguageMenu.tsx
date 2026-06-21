import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu'

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'pt', label: 'PT' },
  { code: 'es', label: 'ES' }
]

export default function LanguageMenu() {
  const { i18n, t } = useTranslation()
  const current = i18n.language?.split('-')[0] ?? 'en'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('shell.language')}
        className="border-border text-foreground hover:bg-muted focus-visible:ring-ring flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-2"
      >
        <Globe
          className="size-4"
          aria-hidden="true"
        />
        {LANGUAGES.find(l => l.code === current)?.label ?? 'EN'}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {LANGUAGES.map(lang => (
          <DropdownMenuItem
            key={lang.code}
            onSelect={() => i18n.changeLanguage(lang.code)}
          >
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
