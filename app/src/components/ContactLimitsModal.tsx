import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex'
import { useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import Modal from './Modal'
import LoadingSpinner from './LoadingSpinner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { friendlyError } from '@/lib/errors'

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
      setError(friendlyError(e, 'Save failed'))
    } finally {
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
      setError(friendlyError(e, 'Reset failed'))
    } finally {
      setResetting(false)
    }
  }

  const title = isNew ? `Add override for ${user.name}` : `Edit ${user.name} limits`

  return (
    <div>
      <h3 className="text-foreground mb-4 text-[15px] font-semibold">{title}</h3>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
            Interactions per post
          </span>
          <Input
            type="number"
            min="1"
            value={interactions}
            onChange={e => setInteractions(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
            Posts per week
          </span>
          <Input
            type="number"
            min="1"
            value={posts}
            onChange={e => setPosts(e.target.value)}
          />
        </label>
      </div>

      {error && <p className="text-destructive mt-2 text-xs">{error}</p>}

      <DialogFooter className="mt-4 flex-col">
        <Button
          onClick={handleSave}
          disabled={!isValid || saving}
          className="flex-1"
        >
          {saving ? '…' : 'Save'}
        </Button>
        <Button
          variant="outline"
          onClick={onClose}
          className="flex-1"
        >
          Cancel
        </Button>
      </DialogFooter>

      {!isNew && (
        <Button
          variant="ghost"
          onClick={handleReset}
          disabled={resetting}
          className="hover:text-destructive mt-3 w-full text-xs"
        >
          {resetting ? '…' : 'Reset to default'}
        </Button>
      )}
    </div>
  )
}
