// app/src/components/PostComposer.tsx
import { useState } from 'react'

interface PostComposerProps {
  onSubmit: (url: string) => Promise<void>
  /** Visual theme. 'dark' (default) matches the Feed page; 'light' matches My Posts. */
  theme?: 'dark' | 'light'
  /** When true, the user has hit their weekly post limit — Submit is disabled. */
  atLimit?: boolean
  /** Helper text shown in place of the usual hint when atLimit is true. */
  limitHint?: string
}

export default function PostComposer({ onSubmit, theme = 'dark', atLimit = false, limitHint }: PostComposerProps) {
  const [url, setUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isLight = theme === 'light'
  // Submit is blocked while empty, in-flight, or at the weekly limit.
  const submitDisabled = !url.trim() || submitting || atLimit

  // Theme-specific surfaces. The blue Submit button is shared across themes;
  // its disabled state uses opacity so it reads correctly on white or slate.
  const s = isLight
    ? {
        form: 'border-slate-200 bg-white',
        label: 'text-slate-500',
        input: 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400',
        hint: 'text-slate-500',
        limit: 'text-amber-600'
      }
    : {
        form: 'border-slate-700 bg-slate-800',
        label: 'text-slate-500',
        input: 'border-slate-700 bg-slate-900 text-slate-200',
        hint: 'text-slate-500',
        limit: 'text-amber-400'
      }

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
      className={`mb-6 rounded-lg border p-4 font-sans ${s.form}`}
    >
      <div className={`mb-2 text-[10px] uppercase tracking-wider ${s.label}`}>Share a post</div>
      <input
        type="url"
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="https://www.linkedin.com/posts/your-name_…"
        disabled={submitting}
        className={`mb-2 box-border w-full rounded-md border px-2.5 py-2 text-[13px] outline-none ${s.input}`}
      />
      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
      <div className="flex items-center justify-between">
        {atLimit && limitHint ? (
          <span className={`text-[11px] ${s.limit}`}>{limitHint}</span>
        ) : (
          <span className={`text-[11px] ${s.hint}`}>Paste your LinkedIn post URL</span>
        )}
        <button
          type="submit"
          disabled={submitDisabled}
          className={`rounded-md border-none px-3.5 py-1.5 text-xs font-semibold text-white ${submitDisabled ? 'cursor-not-allowed bg-blue-500 opacity-40' : 'cursor-pointer bg-blue-500 opacity-100'}`}
        >
          {submitting ? 'Submitting…' : 'Submit →'}
        </button>
      </div>
    </form>
  )
}
