// app/src/components/PostComposer.tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface PostComposerProps {
  onSubmit: (url: string) => Promise<void>
  /** When true, the user has hit their weekly post limit — Submit is disabled. */
  atLimit?: boolean
  /** Helper text shown in place of the usual hint when atLimit is true. */
  limitHint?: string
}

export default function PostComposer({ onSubmit, atLimit = false, limitHint }: PostComposerProps) {
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
      setError(err instanceof Error ? err.message : 'Failed to submit post')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-border bg-card mb-6 rounded-lg border p-4 font-sans"
    >
      <div className="text-muted-foreground mb-2 text-[10px] uppercase tracking-wider">Share a post</div>
      <Input
        type="url"
        inputMode="url"
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="https://www.linkedin.com/posts/your-name_…"
        disabled={submitting}
        className="mb-2"
      />
      {error && <p className="text-destructive mb-2 text-xs">{error}</p>}
      <div className="flex items-center justify-between">
        {atLimit && limitHint ? (
          <span className="text-gold-text text-[11px]">{limitHint}</span>
        ) : (
          <span className="text-muted-foreground text-[11px]">Paste your LinkedIn post URL</span>
        )}
        <Button
          type="submit"
          disabled={submitDisabled}
        >
          {submitting ? 'Submitting…' : 'Submit →'}
        </Button>
      </div>
    </form>
  )
}
