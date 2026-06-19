import { useEffect, useMemo, useState } from 'react'
import { useAction, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'
import { VirtualizedCombobox } from './VirtualizedCombobox'
import { AUTO_LANGUAGE, LANGUAGE_CODES, languageLabel, resolveCommentLanguage } from '../../../convex/lib/languages'

import type { Id } from '../../../convex/_generated/dataModel'

export default function CommentBox({
  postId,
  sessionToken,
  onClose
}: {
  postId: Id<'posts'>
  sessionToken: string
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const comment = useAction(api.interactions.commentOnPost)
  const generate = useAction(api.ai.comments.generateComment)

  // The per-comment language mirrors the user's saved default until they change it here.
  const me = useQuery(api.users.getMe, { sessionToken }) as { commentLanguage?: string } | null | undefined
  const meCommentLanguage = me?.commentLanguage
  const [language, setLanguage] = useState<string>(AUTO_LANGUAGE)
  const [languageDirty, setLanguageDirty] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: mirror the saved default until the user picks a per-comment language
    if (!languageDirty) setLanguage(resolveCommentLanguage(meCommentLanguage))
  }, [meCommentLanguage, languageDirty])

  const uiLang = i18n.language?.split('-')[0] ?? 'en'
  const languageOptions = useMemo(
    () => [
      { value: AUTO_LANGUAGE, label: t('comment.languageAuto') },
      ...LANGUAGE_CODES.map(c => ({ value: c, label: languageLabel(c, uiLang) })).sort((a, b) =>
        a.label.localeCompare(b.label)
      )
    ],
    [t, uiLang]
  )

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const { comment: draft } = await generate({ postId, sessionToken, language })
      setText(draft)
      setHasDraft(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('comment.generateError'))
    } finally {
      setGenerating(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await comment({ postId, commentText: text.trim(), sessionToken })
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
      <div className="mb-2 flex items-center gap-2">
        <div className="w-56">
          <VirtualizedCombobox
            options={languageOptions}
            value={language}
            onChange={value => {
              setLanguage(value === '' ? AUTO_LANGUAGE : value)
              setLanguageDirty(true)
            }}
            ariaLabel={t('comment.language')}
            placeholder={t('comment.languageAuto')}
          />
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className={`rounded-md border border-blue-500 px-3 py-1.5 text-[13px] font-semibold text-blue-600 ${generating ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
        >
          {generating ? t('comment.generating') : hasDraft ? t('comment.regenerate') : t('comment.generate')}
        </button>
      </div>
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
