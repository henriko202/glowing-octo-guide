import { useState } from 'react'
import { useAction } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'

import type { Id } from '../../../convex/_generated/dataModel'

export default function CommentBox({ postId, onClose }: { postId: Id<'posts'>; onClose: () => void }) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const comment = useAction(api.interactions.commentOnPost)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await comment({ postId, commentText: text.trim() })
      setText('')
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to post comment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="py-3 font-sans"
    >
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={t('comment.placeholder')}
        className="font-inherit box-border min-h-[72px] w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none"
        disabled={submitting}
        rows={3}
      />
      {error && <p className="my-1 text-xs text-red-500">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer border-none bg-none text-[13px] text-slate-500 outline-none"
        >
          {t('comment.cancel')}
        </button>
        <button
          type="submit"
          disabled={submitting || !text.trim()}
          className={`rounded-md border-none px-4 py-1.5 text-[13px] font-semibold text-white ${submitting || !text.trim() ? 'cursor-not-allowed bg-blue-300' : 'cursor-pointer bg-blue-600'}`}
        >
          {submitting ? t('comment.submitting') : t('comment.submit')}
        </button>
      </div>
    </form>
  )
}
