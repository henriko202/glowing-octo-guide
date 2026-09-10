import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAction, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { api } from '../convex'
import { delay, HANDOFF_DELAY_MS, openLinkedIn } from '../lib/handoff'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { VirtualizedCombobox } from './VirtualizedCombobox'
import { AUTO_LANGUAGE, LANGUAGE_CODES, languageLabel, resolveCommentLanguage } from '../../../convex/lib/languages'

import type { Id } from '../../../convex/_generated/dataModel'
import { friendlyError } from '@/lib/errors'

export default function CommentBox({
  postId,
  postUrl,
  sessionToken,
  onClose,
  gated,
  commented = false
}: {
  postId: Id<'posts'>
  postUrl: string
  sessionToken: string
  onClose: () => void
  gated?: boolean
  commented?: boolean
}) {
  const { t, i18n } = useTranslation()
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const [draftHydrated, setDraftHydrated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const comment = useAction(api.interactions.commentOnPost)
  const generate = useAction(api.ai.comments.generateComment)

  // Load the user's saved draft for this post and hydrate the textarea once, so they can reuse it or
  // regenerate. Applied only on first load; later generations set the text directly.
  const savedDraft = useQuery(api.interactions.getCommentDraft, { sessionToken, postId })
  // Hydrate the saved draft once, when the query first resolves — a guarded render-phase update that
  // converges (draftHydrated flips true and never re-enters). Later generations set the text directly.
  if (!draftHydrated && savedDraft !== undefined) {
    setDraftHydrated(true)
    if (savedDraft) {
      setText(savedDraft)
      setHasDraft(true)
    }
  }

  // The per-comment language mirrors the user's saved default until they pick one here (the override wins).
  const me = useQuery(api.users.getMe, { sessionToken }) as { commentLanguage?: string } | null | undefined
  const meCommentLanguage = me?.commentLanguage
  const [languageOverride, setLanguageOverride] = useState<string | null>(null)
  const language = languageOverride ?? resolveCommentLanguage(meCommentLanguage)

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
      setError(friendlyError(err, t('comment.generateError')))
    } finally {
      setGenerating(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const draft = text.trim()
    if ((!draft && !commented) || (commented && savedDraft === undefined)) return
    setSubmitting(true)
    setError(null)
    // Ask for clipboard permission and wait; only confirm with a toast once the copy succeeds
    // (LinkedIn has no member API to comment on another member's post — the user pastes it there).
    let copied = false
    try {
      if (draft) {
        await navigator.clipboard.writeText(draft)
        copied = true
        toast(t('comment.copiedHint'))
      }
    } catch {
      // Copy blocked/denied — no toast; the draft stays in the box so it can be copied manually.
    }
    let submitted = false
    try {
      // Optimistic: record + count the engagement now; the API can't confirm the LinkedIn post.
      if (!commented) await comment({ postId, commentText: draft, sessionToken })
      // Keep the toast + spinner on screen for a beat, THEN open LinkedIn.
      await delay(HANDOFF_DELAY_MS)
      openLinkedIn(postUrl)
      submitted = true
    } catch (err: unknown) {
      setError(friendlyError(err, t('comment.generateError')))
    } finally {
      setSubmitting(false)
    }
    if (submitted && copied) onClose()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-border bg-card mt-2 rounded-xl border p-4 font-sans"
    >
      {commented ? (
        <p className="mb-2 text-sm font-semibold">{t('comment.generatedComment')}</p>
      ) : (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="w-56 max-w-full">
            <VirtualizedCombobox
              options={languageOptions}
              value={language}
              onChange={value => setLanguageOverride(value === '' ? AUTO_LANGUAGE : value)}
              ariaLabel={t('comment.language')}
              placeholder={t('comment.languageAuto')}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleGenerate}
            disabled={generating || gated || submitting}
            title={gated ? t('feed.cardGate') : undefined}
            className="cursor-pointer px-3 py-1.5 text-[13px] font-semibold"
          >
            {generating ? t('comment.generating') : hasDraft ? t('comment.regenerate') : t('comment.generate')}
          </Button>
        </div>
      )}
      {commented && savedDraft === undefined ? (
        <p
          role="status"
          className="text-muted-foreground text-sm"
        >
          {t('comment.loadingSaved')}
        </p>
      ) : commented && !text ? (
        <p className="text-muted-foreground text-sm">{t('comment.noSavedComment')}</p>
      ) : (
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={t('comment.placeholder')}
          aria-label={t(commented ? 'comment.generatedComment' : 'feed.comment')}
          readOnly={commented}
          className="min-h-[72px] resize-y text-[13px]"
          disabled={submitting}
          rows={3}
        />
      )}
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
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        {commented && (
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="min-h-11 cursor-pointer"
          >
            {t('comment.closeSaved')}
          </Button>
        )}
        <Button
          type="submit"
          disabled={submitting || (commented ? savedDraft === undefined : !text.trim()) || gated}
          title={gated ? t('feed.cardGate') : undefined}
          className="min-h-11 cursor-pointer px-4 py-1.5 text-[13px] font-semibold whitespace-normal"
        >
          {submitting && (
            <Loader2
              className="h-3.5 w-3.5 animate-spin"
              aria-hidden="true"
            />
          )}
          {submitting ? t('comment.submitting') : t(commented ? 'comment.reopenLinkedIn' : 'comment.submit')}
        </Button>
      </div>
    </form>
  )
}
