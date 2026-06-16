import { useMutation } from 'convex/react'
import { api } from '../convex'
import { useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import Modal from './Modal'

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
      setError(e instanceof Error ? e.message : 'Failed to change tier')
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-base font-semibold text-slate-900">Change tier — {user.name}</h2>
      <p className="mt-1 text-sm text-slate-500">
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
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

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
