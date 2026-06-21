import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../convex'
import { signOut } from '../lib/session'
import BrandMark from '@/components/BrandMark'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type Props = {
  deletionScheduledAt?: number
}

export default function CancelDeletionScreen({ deletionScheduledAt }: Props) {
  const cancelDeletion = useMutation(api.privacy.deletion.cancelAccountDeletion)
  const [working, setWorking] = useState(false)
  const dateLabel = deletionScheduledAt ? new Date(deletionScheduledAt).toLocaleDateString() : null

  async function keepAccount() {
    const token = sessionStorage.getItem('sessionToken') ?? undefined
    if (!token) return
    setWorking(true)
    try {
      await cancelDeletion({ sessionToken: token })
      window.location.reload()
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="bg-background flex min-h-dvh items-center justify-center p-4">
      <div className="border-border bg-card w-full max-w-sm rounded-xl border p-6 shadow-sm">
        <BrandMark className="mb-4 justify-center" />

        <div className="mb-3">
          <Badge variant="warning">Account deletion pending</Badge>
        </div>

        <h1 className="text-foreground font-display text-2xl font-semibold">Your account is scheduled for deletion</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          {dateLabel
            ? `Your account and personal data will be permanently deleted on ${dateLabel}. You can keep your account by cancelling the deletion.`
            : 'Your account is pending deletion. You can keep it by cancelling the deletion.'}
        </p>
        <div className="mt-5 flex items-center gap-3">
          <Button
            type="button"
            onClick={keepAccount}
            disabled={working}
          >
            {working ? 'Cancelling…' : 'Keep my account'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={signOut}
          >
            Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}
