import { useMutation } from 'convex/react'
import { api } from '../convex'
import { useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import Modal from './Modal'

type Status = 'trialing' | 'active' | 'canceled' | 'past_due' | 'none'

const STATUSES: Status[] = ['trialing', 'active', 'canceled', 'past_due', 'none']

const STATUS_LABELS: Record<Status, string> = {
  trialing: 'Trialing',
  active: 'Active',
  canceled: 'Canceled',
  past_due: 'Past due',
  none: 'None'
}

type Props = {
  user: { _id: Id<'users'>; name: string; subscriptionStatus: Status }
  sessionToken: string
  onClose: () => void
}

// Admin override for a user's subscription status. Primarily used to move a user out of
// `trialing` (which hides their posts from the shared feed). A later Stripe webhook can
// overwrite this — it is a manual override, not a substitute for billing state.
export default function ChangeStatusModal({ user, sessionToken, onClose }: Props) {
  const setUserSubscriptionStatus = useMutation(api.admin.setUserSubscriptionStatus)
  const [status, setStatus] = useState<Status>(user.subscriptionStatus)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await setUserSubscriptionStatus({ sessionToken, userId: user._id, status })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to change status')
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-base font-semibold text-slate-900">Change status — {user.name}</h2>
      <p className="mt-1 text-sm text-slate-500">
        Manual override. <span className="font-medium">Trialing</span> hides the user's posts from the shared feed.
      </p>

      <label className="mt-4 flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Subscription status</span>
        <select
          value={status}
          onChange={e => setStatus(e.target.value as Status)}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
        >
          {STATUSES.map(s => (
            <option
              key={s}
              value={s}
            >
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? '…' : 'Save'}
        </button>
      </div>
    </Modal>
  )
}
