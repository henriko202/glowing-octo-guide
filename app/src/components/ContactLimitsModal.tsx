import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex'
import { useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import Modal from './Modal'
import LoadingSpinner from './LoadingSpinner'

type PlanLimitRow = {
  _id: Id<'planLimits'>
  tier: 'starter' | 'growth' | 'pro' | 'contact'
  userId?: Id<'users'>
  interactionsPerPost: number
  postsPerWeek: number
}

type Props = {
  user: { _id: Id<'users'>; name: string }
  sessionToken: string
  onClose: () => void
}

// Per-user contact plan-limit editor, shown from the Users tab for contact-tier users.
// Self-contained: looks up the user's existing override (if any) and the contact default
// from listPlanLimits to prefill, then saves via setContactUserLimit / clears via
// removeContactUserLimit. Editing contact limits lives ONLY here (not in the Plan Limits tab).
export default function ContactLimitsModal({ user, sessionToken, onClose }: Props) {
  const rows = useQuery(api.admin.listPlanLimits, { sessionToken }) as PlanLimitRow[] | undefined

  return (
    <Modal onClose={onClose}>
      {rows === undefined ? (
        <div className="py-6">
          <LoadingSpinner />
        </div>
      ) : (
        <ContactLimitsForm
          user={user}
          sessionToken={sessionToken}
          rows={rows}
          onClose={onClose}
        />
      )}
    </Modal>
  )
}

// Inner form. Mounted only once rows are loaded so useState can initialise from the
// resolved prefill values.
function ContactLimitsForm({ user, sessionToken, rows, onClose }: Props & { rows: PlanLimitRow[] }) {
  const setContactUserLimit = useMutation(api.admin.setContactUserLimit)
  const removeContactUserLimit = useMutation(api.admin.removeContactUserLimit)

  const existing = rows.find(r => r.userId === user._id)
  const contactDefault = rows.find(r => r.tier === 'contact' && !r.userId)
  const isNew = !existing

  const [interactions, setInteractions] = useState(
    String(existing?.interactionsPerPost ?? contactDefault?.interactionsPerPost ?? 200)
  )
  const [posts, setPosts] = useState(String(existing?.postsPerWeek ?? contactDefault?.postsPerWeek ?? 5))
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const iValid = Number.isInteger(Number(interactions)) && Number(interactions) >= 1
  const pValid = Number.isInteger(Number(posts)) && Number(posts) >= 1
  const isValid = iValid && pValid

  async function handleSave() {
    if (!isValid) return
    setSaving(true)
    setError(null)
    try {
      await setContactUserLimit({
        sessionToken,
        userId: user._id,
        interactionsPerPost: Number(interactions),
        postsPerWeek: Number(posts)
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
      setSaving(false)
    }
  }

  async function handleReset() {
    setResetting(true)
    setError(null)
    try {
      await removeContactUserLimit({ sessionToken, userId: user._id })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed')
      setResetting(false)
    }
  }

  const title = isNew ? `Add override for ${user.name}` : `Edit ${user.name} limits`

  return (
    <div>
      <h3 className="mb-4 text-[15px] font-semibold text-slate-900">{title}</h3>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Interactions per post
          </span>
          <input
            type="number"
            min="1"
            value={interactions}
            onChange={e => setInteractions(e.target.value)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Posts per week</span>
          <input
            type="number"
            min="1"
            value={posts}
            onChange={e => setPosts(e.target.value)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
          />
        </label>
      </div>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button
          onClick={handleSave}
          disabled={!isValid || saving}
          className="flex-1 rounded-md bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? '…' : 'Save'}
        </button>
        <button
          onClick={onClose}
          className="flex-1 rounded-md bg-slate-100 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200"
        >
          Cancel
        </button>
      </div>

      {!isNew && (
        <button
          onClick={handleReset}
          disabled={resetting}
          className="mt-3 w-full text-center text-xs text-slate-400 hover:text-red-500 disabled:opacity-50"
        >
          {resetting ? '…' : 'Reset to default'}
        </button>
      )}
    </div>
  )
}
