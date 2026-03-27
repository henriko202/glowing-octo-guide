import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import type { Id } from '../../../convex/_generated/dataModel'
import { api } from '../convex'
import { useNavigate } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'

export default function AdminPage() {
  const navigate = useNavigate()
  const userId = (sessionStorage.getItem('convexUserId') ?? undefined) as Id<'users'> | undefined
  const isAdmin = useQuery(api.admin.checkIsAdmin, userId ? { userId } : 'skip')
  const settings = useQuery(api.admin.getSettings, userId && isAdmin ? { userId } : 'skip')
  const toggleSync = useMutation(api.admin.toggleApifySync)
  const [toggling, setToggling] = useState(false)

  if (isAdmin === undefined) {
    return <LoadingSpinner />
  }

  if (!isAdmin) {
    navigate('/')
  }

  async function handleToggle() {
    if (!userId || !settings) return
    setToggling(true)
    try {
      await toggleSync({ userId, enabled: !settings.apifySyncEnabled })
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="mx-auto max-w-[640px] p-8 font-sans">
      <h1 className="mb-6 text-[22px] font-bold text-slate-900">Admin Panel</h1>

      {/* Apify Sync Toggle */}
      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="m-0 text-base font-semibold text-slate-900">Apify Post Sync</h2>
            <p className="mt-1 text-[13px] text-slate-500">
              Scrapes LinkedIn posts for all active users every hour via Apify.
            </p>
          </div>
          <button
            onClick={handleToggle}
            disabled={toggling || !settings}
            className={`rounded-md border-none px-5 py-2 text-[13px] font-semibold text-white ${toggling ? 'cursor-wait' : 'cursor-pointer'} ${settings?.apifySyncEnabled ? 'bg-red-500' : 'bg-green-500'}`}
          >
            {toggling ? '…' : settings?.apifySyncEnabled ? 'Disable' : 'Enable'}
          </button>
        </div>

        {/* Last sync info */}
        {settings?.lastApifySyncAt && (
          <div className="mt-3 text-xs text-slate-400">
            Last sync: {new Date(settings.lastApifySyncAt).toLocaleString()}
            {settings.lastApifySyncError && <span className="ml-2 text-red-500">— {settings.lastApifySyncError}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
