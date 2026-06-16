import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../convex'
import { useNavigate } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'
import PlanLimitsTab from '../components/PlanLimitsTab'
import UsersTab from '../components/UsersTab'

export default function AdminPage() {
  const navigate = useNavigate()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const isAdmin = useQuery(api.admin.checkIsAdmin, { sessionToken })
  const settings = useQuery(api.admin.getSettings, sessionToken && isAdmin ? { sessionToken } : 'skip')
  const toggleSync = useMutation(api.admin.toggleApifySync)
  const toggleMaster = useMutation(api.admin.toggleApifyEnabled)
  const toggleProfileScrape = useMutation(api.admin.toggleApifyProfileScrape)
  const [toggling, setToggling] = useState(false)
  const [togglingMaster, setTogglingMaster] = useState(false)
  const [togglingProfile, setTogglingProfile] = useState(false)
  const [tab, setTab] = useState<'settings' | 'planLimits' | 'users'>('settings')

  if (isAdmin === undefined) {
    return <LoadingSpinner />
  }

  if (!isAdmin) {
    navigate('/')
  }

  async function handleToggle() {
    if (!sessionToken || !settings) return
    setToggling(true)
    try {
      await toggleSync({ sessionToken, enabled: !settings.apifySyncEnabled })
    } finally {
      setToggling(false)
    }
  }

  async function handleToggleMaster() {
    if (!sessionToken || !settings) return
    setTogglingMaster(true)
    try {
      await toggleMaster({ sessionToken, enabled: settings.apifyEnabled === false })
    } finally {
      setTogglingMaster(false)
    }
  }

  async function handleToggleProfile() {
    if (!sessionToken || !settings) return
    setTogglingProfile(true)
    try {
      await toggleProfileScrape({ sessionToken, enabled: !settings.apifyProfileScrapeEnabled })
    } finally {
      setTogglingProfile(false)
    }
  }

  return (
    <div className="mx-auto max-w-[640px] p-8 font-sans">
      <h1 className="mb-4 text-[22px] font-bold text-slate-900">Admin Panel</h1>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setTab('settings')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'settings' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Settings
        </button>
        <button
          onClick={() => setTab('planLimits')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'planLimits' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Plan Limits
        </button>
        <button
          onClick={() => setTab('users')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'users' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Users
        </button>
      </div>

      {/* Settings tab */}
      {tab === 'settings' && (
        <>
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
            {settings?.lastApifySyncAt && (
              <div className="mt-3 text-xs text-slate-400">
                Last sync: {new Date(settings.lastApifySyncAt).toLocaleString()}
                {settings.lastApifySyncError && (
                  <span className="ml-2 text-red-500">— {settings.lastApifySyncError}</span>
                )}
              </div>
            )}
          </div>

          <div className="mb-4 rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="m-0 text-base font-semibold text-slate-900">Apify (master)</h2>
                <p className="mt-1 text-[13px] text-slate-500">
                  Global kill-switch. Turns off ALL Apify integration (post sync and profile scrape).
                </p>
              </div>
              <button
                onClick={handleToggleMaster}
                disabled={togglingMaster || !settings}
                className={`rounded-md border-none px-5 py-2 text-[13px] font-semibold text-white ${togglingMaster ? 'cursor-wait' : 'cursor-pointer'} ${settings?.apifyEnabled !== false ? 'bg-red-500' : 'bg-green-500'}`}
              >
                {togglingMaster ? '…' : settings?.apifyEnabled !== false ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="m-0 text-base font-semibold text-slate-900">Apify Profile Scrape</h2>
                <p className="mt-1 text-[13px] text-slate-500">
                  Scrapes profile country/location/locale when a user sets or refreshes their LinkedIn URL.
                </p>
              </div>
              <button
                onClick={handleToggleProfile}
                disabled={togglingProfile || !settings}
                className={`rounded-md border-none px-5 py-2 text-[13px] font-semibold text-white ${togglingProfile ? 'cursor-wait' : 'cursor-pointer'} ${settings?.apifyProfileScrapeEnabled ? 'bg-red-500' : 'bg-green-500'}`}
              >
                {togglingProfile ? '…' : settings?.apifyProfileScrapeEnabled ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Plan Limits tab */}
      {tab === 'planLimits' && (
        <PlanLimitsTab
          sessionToken={sessionToken}
          isAdmin={isAdmin}
        />
      )}

      {/* Users tab */}
      {tab === 'users' && (
        <UsersTab
          sessionToken={sessionToken}
          isAdmin={isAdmin}
        />
      )}
    </div>
  )
}
