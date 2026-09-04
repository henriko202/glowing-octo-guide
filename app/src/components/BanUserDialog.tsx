import { useState } from 'react'
import Modal from './Modal'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

type Props = {
  userName: string
  pending: boolean
  onConfirm: (reason: string) => void
  onCancel: () => void
}

export default function BanUserDialog({ userName, pending, onConfirm, onCancel }: Props) {
  const [reason, setReason] = useState('')

  return (
    <Modal onClose={onCancel}>
      <h2 className="text-foreground text-base font-semibold">Ban {userName}?</h2>
      <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
        They'll be signed out immediately and blocked from the app until an admin unbans them.
      </p>

      <label
        htmlFor="ban-reason"
        className="text-muted-foreground mt-4 block text-[11px] font-semibold tracking-wide uppercase"
      >
        Reason (optional — shown to the user)
      </label>
      <Textarea
        id="ban-reason"
        value={reason}
        onChange={e => setReason(e.target.value)}
        rows={2}
        placeholder="Spam / repeated TOS violations…"
        className="mt-1 resize-none"
      />

      <div className="mt-5 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={() => onConfirm(reason.trim())}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          {pending ? '…' : 'Ban user'}
        </Button>
      </div>
    </Modal>
  )
}
