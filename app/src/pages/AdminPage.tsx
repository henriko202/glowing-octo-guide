import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../convex'
import { useNavigate } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'
import PlanLimitsTab from '../components/PlanLimitsTab'
import UsersTab from '../components/UsersTab'
import FeedbackTab from '../components/FeedbackTab'
import MotdTab from '../components/MotdTab'
import { Flash, useFlash } from '../components/useFlash'

export default function AdminPage() {
  const navigate = useNavigate()
  const sessionToken = sessionStorage.getItem('sessionToken') ?? undefined
  const isAdmin = useQuery(api.admin.checkIsAdmin, { sessionToken })
  const settings = useQuery(api.admin.getSettings, sessionToken && isAdmin ? { sessionToken } : 'skip')
  const toggleSync = useMutation(api.admin.toggleApifySync)
  const toggleMaster = useMutation(api.admin.toggleApifyEnabled)
  const toggleProfileScrape = useMutation(api.admin.toggleApifyProfileScrape)
  const syncAllPostsM = useMutation(api.admin.syncAllPosts)
  const syncAllProfilesM = useMutation(api.admin.syncAllProfiles)
  const [toggling, setToggling] = useState(false)
  const [togglingMaster, setTogglingMaster] = useState(false)
  const [togglingProfile, setTogglingProfile] = useState(false)
  const [syncingPosts, setSyncingPosts] = useState(false)
  const [syncingProfiles, setSyncingProfiles] = useState(false)
  const { flash, showFlash, clearFlash } = useFlash()
  const [tab, setTab] = useState<'settings' | 'planLimits' | 'users' | 'feedback' | 'motd'>('settings')

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

  async function handleSyncAllPosts() {
    if (!sessionToken) return
    setSyncingPosts(true)
    try {
      await syncAllPostsM({ sessionToken })
      showFlash('success', 'Post sync started — running in the background.')
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Could not start post sync.')
    } finally {
      setSyncingPosts(false)
    }
  }

  async function handleSyncAllProfiles() {
    if (!sessionToken) return
    setSyncingProfiles(true)
    try {
      await syncAllProfilesM({ sessionToken })
      showFlash('success', 'Profile sync started — running in the background.')
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Could not start profile sync.')
    } finally {
      setSyncingProfiles(false)
    }
  }

  // Manual-trigger gating mirrors the crons: a button is live only when its feature flag and the
  // master switch are both on. The server re-checks these — this is just the UI affordance.
  const masterOn = settings?.apifyEnabled !== false
  const postSyncOn = masterOn && !!settings?.apifySyncEnabled
  const profileScrapeOn = masterOn && !!settings?.apifyProfileScrapeEnabled

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
        <button
          onClick={() => setTab('feedback')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'feedback' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Feedback
        </button>
        <button
          onClick={() => setTab('motd')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'motd' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          MOTD
        </button>
      </div>

      {/* Settings tab */}
      {tab === 'settings' && (
        <>
          <Flash
            flash={flash}
            onDismiss={clearFlash}
          />
          <div className="mb-4 rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="m-0 text-base font-semibold text-slate-900">Apify Post Sync</h2>
                <p className="mt-1 text-[13px] text-slate-500">
                  Scrapes LinkedIn posts for all active users every hour via Apify.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={handleSyncAllPosts}
                  disabled={!postSyncOn || syncingPosts || !settings}
                  title={postSyncOn ? undefined : 'Enable post sync to run a manual sync'}
                  className="rounded-md border border-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {syncingPosts ? 'Starting…' : 'Sync all now'}
                </button>
                <button
                  onClick={handleToggle}
                  disabled={toggling || !settings}
                  className={`rounded-md border-none px-5 py-2 text-[13px] font-semibold text-white ${toggling ? 'cursor-wait' : 'cursor-pointer'} ${settings?.apifySyncEnabled ? 'bg-red-500' : 'bg-green-500'}`}
                >
                  {toggling ? '…' : settings?.apifySyncEnabled ? 'Disable' : 'Enable'}
                </button>
              </div>
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
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={handleSyncAllProfiles}
                  disabled={!profileScrapeOn || syncingProfiles || !settings}
                  title={profileScrapeOn ? undefined : 'Enable profile scrape to run a manual sync'}
                  className="rounded-md border border-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {syncingProfiles ? 'Starting…' : 'Sync all now'}
                </button>
                <button
                  onClick={handleToggleProfile}
                  disabled={togglingProfile || !settings}
                  className={`rounded-md border-none px-5 py-2 text-[13px] font-semibold text-white ${togglingProfile ? 'cursor-wait' : 'cursor-pointer'} ${settings?.apifyProfileScrapeEnabled ? 'bg-red-500' : 'bg-green-500'}`}
                >
                  {togglingProfile ? '…' : settings?.apifyProfileScrapeEnabled ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
            {settings?.lastProfileScrapeAt && (
              <div className="mt-3 text-xs text-slate-400">
                Last profile sync: {new Date(settings.lastProfileScrapeAt).toLocaleString()}
                {settings.lastProfileScrapeError && (
                  <span className="ml-2 text-red-500">— {settings.lastProfileScrapeError}</span>
                )}
              </div>
            )}
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
          postSyncOn={postSyncOn}
          profileScrapeOn={profileScrapeOn}
        />
      )}

      {/* Feedback tab */}
      {tab === 'feedback' && (
        <FeedbackTab
          sessionToken={sessionToken}
          isAdmin={isAdmin}
        />
      )}

      {/* MOTD tab */}
      {tab === 'motd' && (
        <MotdTab
          sessionToken={sessionToken}
          isAdmin={isAdmin}
        />
      )}
    </div>
  )
}
