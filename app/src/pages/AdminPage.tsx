import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../convex'
import { Navigate, useSearchParams } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'
import PlanLimitsTab from '../components/PlanLimitsTab'
import UsersTab from '../components/UsersTab'
import FeedbackTab from '../components/FeedbackTab'
import MotdTab from '../components/MotdTab'
import { Flash, useFlash } from '../components/useFlash'
import { PageHeader } from '../components/PageHeader'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { Button } from '../components/ui/button'

type TabValue = 'settings' | 'planLimits' | 'users' | 'feedback' | 'motd'

export default function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') ?? 'settings') as TabValue

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

  if (isAdmin === undefined) {
    return <LoadingSpinner />
  }

  if (!isAdmin) {
    return (
      <Navigate
        to="/"
        replace
      />
    )
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

  function handleTabChange(value: string) {
    setSearchParams({ tab: value }, { replace: true })
  }

  return (
    <div className="mx-auto max-w-[640px] p-8 font-sans">
      <PageHeader title="Admin Panel" />

      <Tabs
        value={tab}
        onValueChange={handleTabChange}
      >
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="planLimits">Plan Limits</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="motd">MOTD</TabsTrigger>
        </TabsList>

        {/* Settings tab */}
        <TabsContent value="settings">
          <Flash
            flash={flash}
            onDismiss={clearFlash}
          />
          <div className="border-border bg-card mb-4 rounded-lg border p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-foreground m-0 text-base font-semibold">Apify Post Sync</h2>
                <p className="text-muted-foreground mt-1 text-[13px]">
                  Scrapes LinkedIn posts for all active users every hour via Apify.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleSyncAllPosts}
                  disabled={!postSyncOn || syncingPosts || !settings}
                  title={postSyncOn ? undefined : 'Enable post sync to run a manual sync'}
                >
                  {syncingPosts ? 'Starting…' : 'Sync all now'}
                </Button>
                {settings?.apifySyncEnabled ? (
                  <Button
                    variant="destructive"
                    onClick={handleToggle}
                    disabled={toggling || !settings}
                    className={toggling ? 'cursor-wait' : ''}
                  >
                    {toggling ? '…' : 'Disable'}
                  </Button>
                ) : (
                  <Button
                    onClick={handleToggle}
                    disabled={toggling || !settings}
                    className={toggling ? 'cursor-wait' : ''}
                  >
                    {toggling ? '…' : 'Enable'}
                  </Button>
                )}
              </div>
            </div>
            {settings?.lastApifySyncAt && (
              <div className="text-muted-foreground mt-3 text-xs">
                Last sync: {new Date(settings.lastApifySyncAt).toLocaleString()}
                {settings.lastApifySyncError && (
                  <span className="text-destructive ml-2">— {settings.lastApifySyncError}</span>
                )}
              </div>
            )}
          </div>

          <div className="border-border bg-card mb-4 rounded-lg border p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-foreground m-0 text-base font-semibold">Apify (master)</h2>
                <p className="text-muted-foreground mt-1 text-[13px]">
                  Global kill-switch. Turns off ALL Apify integration (post sync and profile scrape).
                </p>
              </div>
              {settings?.apifyEnabled !== false ? (
                <Button
                  variant="destructive"
                  onClick={handleToggleMaster}
                  disabled={togglingMaster || !settings}
                  className={togglingMaster ? 'cursor-wait' : ''}
                >
                  {togglingMaster ? '…' : 'Disable'}
                </Button>
              ) : (
                <Button
                  onClick={handleToggleMaster}
                  disabled={togglingMaster || !settings}
                  className={togglingMaster ? 'cursor-wait' : ''}
                >
                  {togglingMaster ? '…' : 'Enable'}
                </Button>
              )}
            </div>
          </div>

          <div className="border-border bg-card mb-4 rounded-lg border p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-foreground m-0 text-base font-semibold">Apify Profile Scrape</h2>
                <p className="text-muted-foreground mt-1 text-[13px]">
                  Scrapes profile country/location/locale when a user sets or refreshes their LinkedIn URL.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleSyncAllProfiles}
                  disabled={!profileScrapeOn || syncingProfiles || !settings}
                  title={profileScrapeOn ? undefined : 'Enable profile scrape to run a manual sync'}
                >
                  {syncingProfiles ? 'Starting…' : 'Sync all now'}
                </Button>
                {settings?.apifyProfileScrapeEnabled ? (
                  <Button
                    variant="destructive"
                    onClick={handleToggleProfile}
                    disabled={togglingProfile || !settings}
                    className={togglingProfile ? 'cursor-wait' : ''}
                  >
                    {togglingProfile ? '…' : 'Disable'}
                  </Button>
                ) : (
                  <Button
                    onClick={handleToggleProfile}
                    disabled={togglingProfile || !settings}
                    className={togglingProfile ? 'cursor-wait' : ''}
                  >
                    {togglingProfile ? '…' : 'Enable'}
                  </Button>
                )}
              </div>
            </div>
            {settings?.lastProfileScrapeAt && (
              <div className="text-muted-foreground mt-3 text-xs">
                Last profile sync: {new Date(settings.lastProfileScrapeAt).toLocaleString()}
                {settings.lastProfileScrapeError && (
                  <span className="text-destructive ml-2">— {settings.lastProfileScrapeError}</span>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Plan Limits tab */}
        <TabsContent value="planLimits">
          <PlanLimitsTab
            sessionToken={sessionToken}
            isAdmin={isAdmin}
          />
        </TabsContent>

        {/* Users tab */}
        <TabsContent value="users">
          <UsersTab
            sessionToken={sessionToken}
            isAdmin={isAdmin}
            postSyncOn={postSyncOn}
            profileScrapeOn={profileScrapeOn}
          />
        </TabsContent>

        {/* Feedback tab */}
        <TabsContent value="feedback">
          <FeedbackTab
            sessionToken={sessionToken}
            isAdmin={isAdmin}
          />
        </TabsContent>

        {/* MOTD tab */}
        <TabsContent value="motd">
          <MotdTab
            sessionToken={sessionToken}
            isAdmin={isAdmin}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
