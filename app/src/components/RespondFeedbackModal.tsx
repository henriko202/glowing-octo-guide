import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../convex'
import type { Id } from '../../../convex/_generated/dataModel'
import Modal from './Modal'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

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
      <h3 className="text-foreground text-[15px] font-semibold">Respond to {feedback.userName ?? '(deleted user)'}</h3>

      <div className="border-border bg-muted text-foreground mt-3 whitespace-pre-wrap rounded-md border p-3 text-sm">
        {feedback.message}
      </div>

      {feedback.responses.length > 0 && (
        <div className="mt-3">
          <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">Reply history</span>
          <div className="mt-1 flex flex-col gap-2">
            {feedback.responses.map((r, i) => (
              <div
                key={i}
                className="border-border bg-muted text-foreground whitespace-pre-wrap rounded-md border p-3 text-sm"
              >
                <p>{r.text}</p>
                <p className="text-muted-foreground mt-1 text-[11px]">
                  {r.responderName ? `${r.responderName} · ` : ''}
                  {new Date(r.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!canReply && (
        <p className="text-gold-text mt-3 text-xs">This user has no email on file — you can't send a reply.</p>
      )}

      <label className="mt-4 flex flex-col gap-1">
        <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">Your reply</span>
        <Textarea
          value={text}
          disabled={!canReply}
          maxLength={MAX}
          onChange={e => setText(e.target.value)}
          rows={6}
          className="resize-none"
        />
      </label>
      <div className="text-muted-foreground mt-1 text-right text-xs">
        {trimmed.length}/{MAX}
      </div>

      <label className="text-foreground mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={canReply ? sendEmail : false}
          disabled={!canReply}
          onChange={e => setSendEmail(e.target.checked)}
          className="border-border h-4 w-4 rounded"
        />
        Send email to submitter
      </label>

      {error && <p className="text-destructive mt-2 text-xs">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          type="button"
          disabled={!valid || sending}
          onClick={() => void handleSend()}
        >
          {sending ? '…' : 'Send reply'}
        </Button>
      </div>
    </Modal>
  )
}
