import { useMutation } from 'convex/react'
import { api } from '../convex'
import { useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import Modal from './Modal'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { friendlyError } from '@/lib/errors'

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
      setError(friendlyError(e, 'Failed to change status'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-foreground text-base font-semibold">Change status — {user.name}</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Manual override. <span className="font-medium">Trialing</span> hides the user's posts from the shared feed.
      </p>

      <label className="mt-4 flex flex-col gap-1">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
          Subscription status
        </span>
        <select
          value={status}
          onChange={e => setStatus(e.target.value as Status)}
          className="border-border bg-card text-foreground rounded-md border px-3 py-2 text-sm focus:outline-none"
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

      {error && <p className="text-destructive mt-3 text-xs">{error}</p>}

      <DialogFooter className="mt-5">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? '…' : 'Save'}
        </Button>
      </DialogFooter>
    </Modal>
  )
}
