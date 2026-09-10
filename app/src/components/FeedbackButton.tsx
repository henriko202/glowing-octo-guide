import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle } from 'lucide-react'
import FeedbackModal from './FeedbackModal'

export default function FeedbackButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('feedback.button')}
        className="bg-primary text-primary-foreground fixed right-5 bottom-5 z-40 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold shadow-lg hover:bg-[color-mix(in_oklch,var(--primary),black_12%)]"
      >
        <MessageCircle
          className="size-4"
          aria-hidden="true"
        />
        {t('feedback.button')}
      </button>
      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  )
}
