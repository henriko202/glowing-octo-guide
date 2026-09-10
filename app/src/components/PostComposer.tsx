// app/src/components/PostComposer.tsx
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { friendlyError, mapLimitError } from '@/lib/errors'

interface PostComposerProps {
  onSubmit: (url: string) => Promise<void>
  /** When true, the user has hit their weekly post limit — Submit is disabled. */
  atLimit?: boolean
  /** Helper content shown in place of the usual hint when atLimit is true (e.g. UpgradeAtLimit). */
  limitHint?: ReactNode
}

export default function PostComposer({ onSubmit, atLimit = false, limitHint }: PostComposerProps) {
  const { t } = useTranslation()
  const [url, setUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Submit is blocked while empty, in-flight, or at the weekly limit.
  const submitDisabled = !url.trim() || submitting || atLimit

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(url.trim())
      setUrl('')
    } catch (err: unknown) {
      setError(mapLimitError(friendlyError(err, t('composer.submitError')), t))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-border bg-card mb-6 rounded-lg border p-4 font-sans"
    >
      <div className="text-muted-foreground mb-2 text-[10px] tracking-wider uppercase">{t('composer.shareLabel')}</div>
      <Input
        id="post-url-input"
        type="url"
        inputMode="url"
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder={t('composer.placeholder')}
        disabled={submitting}
        className="mb-2"
      />
      {error && <p className="text-destructive mb-2 text-xs">{error}</p>}
      <div className="flex items-center justify-between">
        {atLimit && limitHint ? (
          <span className="text-[11px] text-gold-text">{limitHint}</span>
        ) : (
          <span className="text-muted-foreground text-[11px]">{t('composer.hint')}</span>
        )}
        <Button
          type="submit"
          disabled={submitDisabled}
        >
          {submitting ? t('composer.submitting') : t('composer.submit')}
        </Button>
      </div>
    </form>
  )
}
