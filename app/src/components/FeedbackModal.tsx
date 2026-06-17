import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from 'convex/react'
import { api } from '../convex'
import Modal from './Modal'

const CATEGORIES = [
  'feature_request',
  'bug',
  'comment',
  'criticism',
  'praise',
  'question',
  'suggestion',
  'other'
] as const
type Category = (typeof CATEGORIES)[number]
const MAX = 4000

export default function FeedbackModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const submit = useMutation(api.feedback.feedback.submitFeedback)
  const [category, setCategory] = useState<Category | null>(null)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = message.trim()
  const valid = category !== null && trimmed.length > 0 && trimmed.length <= MAX

  async function handleSubmit() {
    const token = sessionStorage.getItem('sessionToken') ?? undefined
    if (!valid || !category || !token) return
    setSubmitting(true)
    setError(null)
    try {
      await submit({ sessionToken: token, category, message: trimmed })
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('feedback.error'))
      setSubmitting(false)
    }
  }

  return (
    <Modal
      onClose={onClose}
      panelClassName="max-w-lg"
    >
      {done ? (
        <div className="py-6 text-center">
          <p className="text-base font-semibold text-slate-900">{t('feedback.thanks')}</p>
          <button
            onClick={onClose}
            className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {t('feedback.close')}
          </button>
        </div>
      ) : (
        <div>
          <h2 className="text-base font-semibold text-slate-900">{t('feedback.title')}</h2>

          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {t('feedback.categoryLabel')}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORIES.map(c => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  category === c ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t(`feedback.categories.${c}`)}
              </button>
            ))}
          </div>

          <label className="mt-4 flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {t('feedback.messageLabel')}
            </span>
            <textarea
              value={message}
              maxLength={MAX}
              onChange={e => setMessage(e.target.value)}
              placeholder={t('feedback.messagePlaceholder')}
              rows={6}
              className="resize-none rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            />
          </label>
          <div className="mt-1 text-right text-xs text-slate-400">
            {trimmed.length}/{MAX}
          </div>

          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              {t('feedback.cancel')}
            </button>
            <button
              type="button"
              disabled={!valid || submitting}
              onClick={() => void handleSubmit()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? t('feedback.submitting') : t('feedback.submit')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
