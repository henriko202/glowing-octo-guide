import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import FeedbackModal from './FeedbackModal'

const PLACEMENTS = {
  floating: {
    button:
      'bg-primary text-primary-foreground fixed right-5 bottom-5 z-40 hidden rounded-full px-4 py-3 text-sm font-semibold shadow-lg hover:bg-[color-mix(in_oklch,var(--primary),black_12%)] lg:flex',
    icon: 'size-4'
  },
  sidebar: {
    button:
      'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 w-full rounded-lg px-2.5 py-2 text-sm font-medium lg:hidden',
    icon: 'size-[18px]'
  }
} as const

export default function FeedbackButton({ placement = 'floating' }: { placement?: keyof typeof PLACEMENTS }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const styles = PLACEMENTS[placement]
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('feedback.button')}
        className={cn('flex items-center gap-2', styles.button)}
      >
        <MessageCircle
          className={styles.icon}
          aria-hidden="true"
        />
        {t('feedback.button')}
      </button>
      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  )
}
