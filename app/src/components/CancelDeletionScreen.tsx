import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../convex'

type Props = {
  deletionScheduledAt?: number
}

function signOut() {
  sessionStorage.removeItem('sessionToken')
  window.location.assign('/')
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
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-amber-700">
          Account deletion pending
        </div>
        <h1 className="text-lg font-bold text-slate-900">Your account is scheduled for deletion</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          {dateLabel
            ? `Your account and personal data will be permanently deleted on ${dateLabel}. You can keep your account by cancelling the deletion.`
            : 'Your account is pending deletion. You can keep it by cancelling the deletion.'}
        </p>
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={keepAccount}
            disabled={working}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {working ? 'Cancelling…' : 'Keep my account'}
          </button>
          <button
            type="button"
            onClick={signOut}
            className="text-sm font-semibold text-slate-500 hover:text-slate-700"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
