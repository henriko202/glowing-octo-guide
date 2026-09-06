import { useMutation, useQuery } from 'convex/react'
import { api } from '../convex'
import LoadingSpinner from './LoadingSpinner'
import RowActionsMenu, { type RowAction } from './RowActionsMenu'
import BanUserDialog from './BanUserDialog'
import Modal from './Modal'
import ChangeTierModal from './ChangeTierModal'
import ChangeStatusModal from './ChangeStatusModal'
import ContactLimitsModal from './ContactLimitsModal'
import { useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import { Flash, useFlash } from './useFlash'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { friendlyError } from '@/lib/errors'

type Tier = 'starter' | 'growth' | 'pro' | 'contact'

type UserRow = {
  _id: Id<'users'>
  name: string
  headline?: string
  tier?: Tier
  subscriptionStatus: 'trialing' | 'active' | 'canceled' | 'past_due' | 'none'
  isBanned?: boolean
  createdAt: number
  linkedinPublicIdentifier?: string
}

type TierFilter = Tier | 'none' | 'all'

const TIER_VARIANT: Record<Tier, 'outline' | 'default' | 'success' | 'warning'> = {
  starter: 'outline',
  growth: 'default',
  pro: 'success',
  contact: 'warning'
}

const STATUS_VARIANT: Record<UserRow['subscriptionStatus'], 'success' | 'default' | 'outline' | 'destructive'> = {
  active: 'success',
  trialing: 'default',
  canceled: 'outline',
  past_due: 'destructive',
  none: 'outline'
}

const FILTER_LABELS: { value: TierFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'contact', label: 'Contact' },
  { value: 'pro', label: 'Pro' },
  { value: 'growth', label: 'Growth' },
  { value: 'starter', label: 'Starter' },
  { value: 'none', label: 'No Tier' }
]

type Props = {
  sessionToken: string | undefined
  isAdmin: boolean | undefined
  // Whether the matching Apify feature (+ master) is on; gates the per-row sync actions.
  postSyncOn: boolean
  profileScrapeOn: boolean
}

export default function UsersTab({ sessionToken, isAdmin, postSyncOn, profileScrapeOn }: Props) {
  const users = useQuery(api.admin.listUsers, sessionToken && isAdmin ? { sessionToken } : 'skip') as
    | UserRow[]
    | undefined

  const banUser = useMutation(api.admin.banUser)
  const unbanUser = useMutation(api.admin.unbanUser)
  const syncUserPosts = useMutation(api.admin.syncUserPosts)
  const syncUserProfile = useMutation(api.admin.syncUserProfile)
  const { flash, showFlash, clearFlash } = useFlash()

  const [filter, setFilter] = useState<TierFilter>('all')
  const [pendingId, setPendingId] = useState<Id<'users'> | null>(null)
  const [nameSearch, setNameSearch] = useState('')
  const [tierTarget, setTierTarget] = useState<UserRow | null>(null)
  const [statusTarget, setStatusTarget] = useState<UserRow | null>(null)
  const [limitsTarget, setLimitsTarget] = useState<UserRow | null>(null)
  const [banTarget, setBanTarget] = useState<UserRow | null>(null)
  const [unbanTarget, setUnbanTarget] = useState<UserRow | null>(null)

  if (users === undefined) {
    return <LoadingSpinner />
  }

  const filtered = users.filter(u => {
    const matchesTier = filter === 'all' || (filter === 'none' ? !u.tier : u.tier === filter)
    const matchesName = !nameSearch || u.name.toLowerCase().includes(nameSearch.toLowerCase())
    return matchesTier && matchesName
  })

  async function handleBan(reason: string) {
    if (!sessionToken || !banTarget) return
    setPendingId(banTarget._id)
    try {
      await banUser({ sessionToken, userId: banTarget._id, reason })
      setBanTarget(null)
    } finally {
      setPendingId(null)
    }
  }

  async function handleUnban() {
    if (!sessionToken || !unbanTarget) return
    setPendingId(unbanTarget._id)
    try {
      await unbanUser({ sessionToken, userId: unbanTarget._id })
      setUnbanTarget(null)
    } finally {
      setPendingId(null)
    }
  }

  async function handleSyncPosts(user: UserRow) {
    if (!sessionToken) return
    try {
      await syncUserPosts({ sessionToken, userId: user._id })
      showFlash('success', `Post sync started for ${user.name}.`)
    } catch (err) {
      showFlash('error', friendlyError(err, 'Could not start post sync.'))
    }
  }

  async function handleSyncProfile(user: UserRow) {
    if (!sessionToken) return
    try {
      await syncUserProfile({ sessionToken, userId: user._id })
      showFlash('success', `Profile sync started for ${user.name}.`)
    } catch (err) {
      showFlash('error', friendlyError(err, 'Could not start profile sync.'))
    }
  }

  function actionsFor(user: UserRow): RowAction[] {
    const items: RowAction[] = [
      { label: 'Change tier…', onClick: () => setTierTarget(user) },
      { label: 'Change status…', onClick: () => setStatusTarget(user) }
    ]
    // Per-user plan-limit overrides only apply on the contact tier — see lib/planLimits.ts.
    if (user.tier === 'contact') {
      items.push({ label: 'Edit limits…', onClick: () => setLimitsTarget(user) })
    }

    // Manual Apify triggers — disabled (with a reason) when the feature is off or the user has no
    // LinkedIn URL on file. The server wrappers enforce the same two conditions.
    const hasLinkedin = !!user.linkedinPublicIdentifier
    items.push({
      label: 'Sync posts',
      disabled: !postSyncOn || !hasLinkedin,
      title: !postSyncOn ? 'Enable post sync in Settings' : !hasLinkedin ? 'No LinkedIn URL on file' : undefined,
      onClick: () => void handleSyncPosts(user)
    })
    items.push({
      label: 'Sync profile',
      disabled: !profileScrapeOn || !hasLinkedin,
      title: !profileScrapeOn
        ? 'Enable profile scrape in Settings'
        : !hasLinkedin
          ? 'No LinkedIn URL on file'
          : undefined,
      onClick: () => void handleSyncProfile(user)
    })

    if (user.isBanned) {
      items.push({ label: 'Unban', onClick: () => setUnbanTarget(user) })
    } else {
      items.push({ label: 'Ban user…', danger: true, onClick: () => setBanTarget(user) })
    }
    return items
  }

  return (
    <div>
      <Flash
        flash={flash}
        onDismiss={clearFlash}
      />

      {/* Toolbar */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {FILTER_LABELS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <Input
          type="text"
          placeholder="Search by name..."
          value={nameSearch}
          onChange={e => setNameSearch(e.target.value)}
          className="w-full sm:w-48"
        />
      </div>

      <p className="text-muted-foreground mb-2 text-xs">
        {filtered.length} {filtered.length === 1 ? 'user' : 'users'}
        {filter !== 'all' && ` · filtered to ${filter === 'none' ? 'no tier' : filter}`}
      </p>

      {/* Table */}
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-[100px]">Tier</TableHead>
            <TableHead className="w-[90px]">Status</TableHead>
            <TableHead className="w-[56px]">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-muted-foreground py-8 text-center text-sm"
              >
                No users match this filter.
              </TableCell>
            </TableRow>
          )}

          {filtered.map(user => (
            <TableRow key={user._id}>
              {/* Name + headline */}
              <TableCell className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-foreground truncate font-medium">{user.name}</span>
                  {user.isBanned && (
                    <Badge
                      variant="destructive"
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase"
                    >
                      Banned
                    </Badge>
                  )}
                </div>
                {user.headline && <div className="text-muted-foreground truncate text-xs">{user.headline}</div>}
              </TableCell>

              {/* Tier badge */}
              <TableCell>
                {user.tier ? (
                  <Badge variant={TIER_VARIANT[user.tier]}>{user.tier}</Badge>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </TableCell>

              {/* Subscription status */}
              <TableCell>
                <Badge
                  variant={STATUS_VARIANT[user.subscriptionStatus]}
                  className="capitalize"
                >
                  {user.subscriptionStatus}
                </Badge>
              </TableCell>

              {/* Row actions */}
              <TableCell>
                <div className="flex justify-end">
                  <RowActionsMenu
                    label={`Actions for ${user.name}`}
                    items={actionsFor(user)}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Change tier */}
      {tierTarget && sessionToken && (
        <ChangeTierModal
          user={tierTarget}
          sessionToken={sessionToken}
          onClose={() => setTierTarget(null)}
        />
      )}

      {/* Change subscription status */}
      {statusTarget && sessionToken && (
        <ChangeStatusModal
          user={statusTarget}
          sessionToken={sessionToken}
          onClose={() => setStatusTarget(null)}
        />
      )}

      {/* Edit contact plan limits */}
      {limitsTarget && sessionToken && (
        <ContactLimitsModal
          user={limitsTarget}
          sessionToken={sessionToken}
          onClose={() => setLimitsTarget(null)}
        />
      )}

      {/* Ban dialog */}
      {banTarget && (
        <BanUserDialog
          userName={banTarget.name}
          pending={pendingId === banTarget._id}
          onConfirm={reason => void handleBan(reason)}
          onCancel={() => setBanTarget(null)}
        />
      )}

      {/* Unban confirm */}
      {unbanTarget && (
        <Modal onClose={() => setUnbanTarget(null)}>
          <h2 className="text-foreground text-base font-semibold">Unban {unbanTarget.name}?</h2>
          <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
            They'll regain access to the app immediately.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setUnbanTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pendingId === unbanTarget._id}
              onClick={() => void handleUnban()}
            >
              {pendingId === unbanTarget._id ? '…' : 'Unban'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
