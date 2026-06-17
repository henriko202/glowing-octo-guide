import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
        className="fixed bottom-5 right-5 z-40 rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-blue-700"
      >
        💬 {t('feedback.button')}
      </button>
      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  )
}
