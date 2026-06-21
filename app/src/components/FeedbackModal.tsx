import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from 'convex/react'
import { api } from '../convex'
import Modal from './Modal'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

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
      panelClassName="sm:max-w-lg"
    >
      {done ? (
        <div className="py-6 text-center">
          <p className="text-foreground text-base font-semibold">{t('feedback.thanks')}</p>
          <Button
            onClick={onClose}
            className="mt-4"
          >
            {t('feedback.close')}
          </Button>
        </div>
      ) : (
        <div>
          <h2 className="text-foreground text-base font-semibold">{t('feedback.title')}</h2>

          <p className="text-muted-foreground mt-3 text-[11px] font-semibold uppercase tracking-wide">
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
                  category === c
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {t(`feedback.categories.${c}`)}
              </button>
            ))}
          </div>

          <label className="mt-4 flex flex-col gap-1">
            <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
              {t('feedback.messageLabel')}
            </span>
            <Textarea
              value={message}
              maxLength={MAX}
              onChange={e => setMessage(e.target.value)}
              placeholder={t('feedback.messagePlaceholder')}
              rows={6}
              className="resize-none"
            />
          </label>
          <div className="text-muted-foreground mt-1 text-right text-xs">
            {trimmed.length}/{MAX}
          </div>

          {error && <p className="text-destructive mt-2 text-xs">{error}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              {t('feedback.cancel')}
            </Button>
            <Button
              type="button"
              disabled={!valid || submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting ? t('feedback.submitting') : t('feedback.submit')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
