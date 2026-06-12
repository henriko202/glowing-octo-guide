import { useState } from 'react'
import Modal from './Modal'

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
      <h2 className="text-base font-semibold text-slate-900">Ban {userName}?</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
        They'll be signed out immediately and blocked from the app until an admin unbans them.
      </p>

      <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Reason (optional — shown to the user)
      </label>
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        rows={2}
        placeholder="Spam / repeated TOS violations…"
        className="mt-1 w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
      />

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => onConfirm(reason.trim())}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? '…' : 'Ban user'}
        </button>
      </div>
    </Modal>
  )
}
