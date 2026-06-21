import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAction, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { api } from '../convex'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { VirtualizedCombobox } from './VirtualizedCombobox'
import { AUTO_LANGUAGE, LANGUAGE_CODES, languageLabel, resolveCommentLanguage } from '../../../convex/lib/languages'

import type { Id } from '../../../convex/_generated/dataModel'

export default function CommentBox({
  postId,
  sessionToken,
  onClose,
  gated
}: {
  postId: Id<'posts'>
  sessionToken: string
  onClose: () => void
  gated?: boolean
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
        <Button
          type="button"
          variant="outline"
          onClick={handleGenerate}
          disabled={generating || gated}
          title={gated ? t('feed.cardGate') : undefined}
          className="px-3 py-1.5 text-[13px] font-semibold"
        >
          {generating ? t('comment.generating') : hasDraft ? t('comment.regenerate') : t('comment.generate')}
        </Button>
      </div>
      <Textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={t('comment.placeholder')}
        className="min-h-[72px] resize-y text-[13px]"
        disabled={submitting}
        rows={3}
      />
      {error &&
        (error.startsWith('PAYMENT_REQUIRED') ? (
          <p className="text-destructive my-1 text-xs">
            {t('feed.cardGate')}{' '}
            <Link
              to="/billing"
              className="underline"
            >
              {t('nav.billing')}
            </Link>
          </p>
        ) : (
          <p className="text-destructive my-1 text-xs">{error}</p>
        ))}
      <div className="mt-2 flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          className="text-[13px]"
        >
          {t('comment.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={submitting || !text.trim() || gated}
          title={gated ? t('feed.cardGate') : undefined}
          className="px-4 py-1.5 text-[13px] font-semibold"
        >
          {submitting ? t('comment.submitting') : t('comment.submit')}
        </Button>
      </div>
    </form>
  )
}
