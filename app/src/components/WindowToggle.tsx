import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export type ToggleWindow = '7d' | '30d' | 'all'

// Segmented control shared by Recap and History. Same pill styling as the Billing interval toggle;
// min-h-10 keeps every option a 40px tap target on phones.
export default function WindowToggle<T extends ToggleWindow>({
  value,
  onChange,
  options
}: {
  value: T
  onChange: (next: T) => void
  options: readonly T[]
}) {
  const { t } = useTranslation()
  return (
    <div className="inline-flex items-center gap-1 rounded-full border p-1 text-sm">
      {options.map(option => (
        <button
          key={option}
          type="button"
          aria-pressed={option === value}
          onClick={() => onChange(option)}
          className={cn(
            'min-h-10 rounded-full px-3 transition-colors',
            option === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {t(`recap.window.${option}`)}
        </button>
      ))}
    </div>
  )
}
