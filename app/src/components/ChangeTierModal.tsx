import { useMutation } from 'convex/react'
import { api } from '../convex'
import { useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import Modal from './Modal'
import { Button } from '@/components/ui/button'
import { friendlyError } from '@/lib/errors'

type Tier = 'starter' | 'growth' | 'pro' | 'contact'

const TIERS: Tier[] = ['starter', 'growth', 'pro', 'contact']

type Props = {
  user: { _id: Id<'users'>; name: string; tier?: Tier }
  sessionToken: string
  onClose: () => void
}

// Sets a user's tier to any of the four tiers via setUserTier. Promoting to `contact`
// auto-seeds a plan-limit override on the backend; demoting leaves any old override dormant
// (it is only consulted while the user is on the contact tier).
export default function ChangeTierModal({ user, sessionToken, onClose }: Props) {
  const setUserTier = useMutation(api.admin.setUserTier)
  const [tier, setTier] = useState<Tier>(user.tier ?? 'starter')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await setUserTier({ sessionToken, userId: user._id, tier })
      onClose()
    } catch (e) {
      setError(friendlyError(e, 'Failed to change tier'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-foreground text-base font-semibold">Change tier — {user.name}</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Promoting to <span className="font-medium">contact</span> also seeds a per-user plan-limit override.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {TIERS.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTier(t)}
            className={`rounded-md border px-3 py-2 text-sm font-medium capitalize transition-colors ${
              tier === t
                ? 'border-primary bg-accent text-accent-foreground'
                : 'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <p className="text-destructive mt-3 text-xs">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
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
      </div>
    </Modal>
  )
}
