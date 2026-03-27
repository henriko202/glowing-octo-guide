// app/src/components/PostComposer.tsx
import { useState } from 'react'

interface PostComposerProps {
  onSubmit: (url: string) => Promise<void>
}

export default function PostComposer({ onSubmit }: PostComposerProps) {
  const [url, setUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      className="mb-6 rounded-lg border border-slate-700 bg-slate-800 p-4 font-sans"
    >
      <div className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">Share a post</div>
      <input
        type="url"
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="https://www.linkedin.com/posts/your-name_…"
        disabled={submitting}
        className="mb-2 box-border w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-2 text-[13px] text-slate-200 outline-none"
      />
      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-500">Paste your LinkedIn post URL</span>
        <button
          type="submit"
          disabled={!url.trim() || submitting}
          className={`rounded-md border-none px-3.5 py-1.5 text-xs font-semibold text-white ${url.trim() && !submitting ? 'cursor-pointer bg-blue-500 opacity-100' : 'cursor-not-allowed bg-blue-900 opacity-50'}`}
        >
          {submitting ? 'Submitting\u2026' : 'Submit \u2192'}
        </button>
      </div>
    </form>
  )
}
