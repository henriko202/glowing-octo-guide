import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../convex'
import type { Id } from '../../../convex/_generated/dataModel'
import Modal from './Modal'

type FeedbackResponse = {
  text: string
  createdAt: number
  responderName: string | null
}

type Props = {
  feedback: {
    _id: Id<'feedback'>
    message: string
    userName: string | null
    userEmail: string | null
    responses: FeedbackResponse[]
  }
  sessionToken: string
  onClose: () => void
}

const MAX = 4000

export default function RespondFeedbackModal({ feedback, sessionToken, onClose }: Props) {
  const respond = useMutation(api.feedback.feedback.respondToFeedback)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sendEmail, setSendEmail] = useState(true)

  const canReply = !!feedback.userEmail
  const trimmed = text.trim()
  const valid = canReply && trimmed.length > 0 && trimmed.length <= MAX

  async function handleSend() {
    if (!valid) return
    setSending(true)
    setError(null)
    try {
      await respond({ sessionToken, feedbackId: feedback._id, responseText: trimmed, sendEmail })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send reply')
      setSending(false)
    }
  }

  return (
    <Modal
      onClose={onClose}
      panelClassName="max-w-lg"
    >
      <h3 className="text-[15px] font-semibold text-slate-900">Respond to {feedback.userName ?? '(deleted user)'}</h3>

      <div className="mt-3 whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        {feedback.message}
      </div>

      {feedback.responses.length > 0 && (
        <div className="mt-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Reply history</span>
          <div className="mt-1 flex flex-col gap-2">
            {feedback.responses.map((r, i) => (
              <div
                key={i}
                className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600"
              >
                <p>{r.text}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {r.responderName ? `${r.responderName} · ` : ''}
                  {new Date(r.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!canReply && (
        <p className="mt-3 text-xs text-amber-600">This user has no email on file — you can't send a reply.</p>
      )}

      <label className="mt-4 flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Your reply</span>
        <textarea
          value={text}
          disabled={!canReply}
          maxLength={MAX}
          onChange={e => setText(e.target.value)}
          rows={6}
          className="resize-none rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none disabled:bg-slate-50"
        />
      </label>
      <div className="mt-1 text-right text-xs text-slate-400">
        {trimmed.length}/{MAX}
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={canReply ? sendEmail : false}
          disabled={!canReply}
          onChange={e => setSendEmail(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        Send email to submitter
      </label>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!valid || sending}
          onClick={() => void handleSend()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {sending ? '…' : 'Send reply'}
        </button>
      </div>
    </Modal>
  )
}
