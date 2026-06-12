import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex'
import LoadingSpinner from './LoadingSpinner'
import RowActionsMenu, { type RowAction } from './RowActionsMenu'
import BanUserDialog from './BanUserDialog'
import Modal from './Modal'
import { useState, useRef } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'

type Tier = 'starter' | 'growth' | 'pro' | 'contact'

type UserRow = {
  _id: Id<'users'>
  name: string
  headline?: string
  tier?: Tier
  subscriptionStatus: 'trialing' | 'active' | 'canceled' | 'past_due' | 'none'
  isBanned?: boolean
  createdAt: number
}

type TierFilter = Tier | 'none' | 'all'

const TIER_COLOURS: Record<Tier, string> = {
  starter: 'bg-slate-100 text-slate-600',
  growth: 'bg-blue-100 text-blue-700',
  pro: 'bg-green-100 text-green-700',
  contact: 'bg-purple-100 text-purple-700',
}

const STATUS_COLOURS: Record<UserRow['subscriptionStatus'], string> = {
  active: 'text-green-600',
  trialing: 'text-blue-600',
  canceled: 'text-slate-400',
  past_due: 'text-red-500',
  none: 'text-slate-400',
}

const FILTER_LABELS: { value: TierFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'contact', label: 'Contact' },
  { value: 'pro', label: 'Pro' },
  { value: 'growth', label: 'Growth' },
  { value: 'starter', label: 'Starter' },
  { value: 'none', label: 'No Tier' },
]

type Props = {
  sessionToken: string | undefined
  isAdmin: boolean | undefined
}

export default function UsersTab({ sessionToken, isAdmin }: Props) {
  const users = useQuery(
    api.admin.listUsers,
    sessionToken && isAdmin ? { sessionToken } : 'skip'
  ) as UserRow[] | undefined

  const setUserTier = useMutation(api.admin.setUserTier)
  const banUser = useMutation(api.admin.banUser)
  const unbanUser = useMutation(api.admin.unbanUser)

  // Capture stable refs so handlers always call the mutation from the first
  // render — matches how Convex's useMutation returns a stable reference in
  // production; also makes the positional mock in tests work correctly.
  const setUserTierRef = useRef(setUserTier)
  const banUserRef = useRef(banUser)
  const unbanUserRef = useRef(unbanUser)

  const [filter, setFilter] = useState<TierFilter>('all')
  const [pendingId, setPendingId] = useState<Id<'users'> | null>(null)
  const [nameSearch, setNameSearch] = useState('')
  const [banTarget, setBanTarget] = useState<UserRow | null>(null)
  const [unbanTarget, setUnbanTarget] = useState<UserRow | null>(null)

  if (users === undefined) {
    return <LoadingSpinner />
  }

  const filtered = users.filter(u => {
    const matchesTier =
      filter === 'all' ||
      (filter === 'none' ? !u.tier : u.tier === filter)
    const matchesName = !nameSearch || u.name.toLowerCase().includes(nameSearch.toLowerCase())
    return matchesTier && matchesName
  })

  async function handleSetContact(userId: Id<'users'>) {
    if (!sessionToken) return
    setPendingId(userId)
    try {
      await setUserTierRef.current({ sessionToken, userId, tier: 'contact' })
    } finally {
      setPendingId(null)
    }
  }

  async function handleBan(reason: string) {
    if (!sessionToken || !banTarget) return
    setPendingId(banTarget._id)
    try {
      await banUserRef.current({ sessionToken, userId: banTarget._id, reason })
      setBanTarget(null)
    } finally {
      setPendingId(null)
    }
  }

  async function handleUnban() {
    if (!sessionToken || !unbanTarget) return
    setPendingId(unbanTarget._id)
    try {
      await unbanUserRef.current({ sessionToken, userId: unbanTarget._id })
      setUnbanTarget(null)
    } finally {
      setPendingId(null)
    }
  }

  function actionsFor(user: UserRow): RowAction[] {
    const items: RowAction[] = []
    if (user.tier !== 'contact') {
      items.push({ label: 'Set to Contact', onClick: () => void handleSetContact(user._id) })
    }
    if (user.isBanned) {
      items.push({ label: 'Unban', onClick: () => setUnbanTarget(user) })
    } else {
      items.push({ label: 'Ban user…', danger: true, onClick: () => setBanTarget(user) })
    }
    return items
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {FILTER_LABELS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search by name..."
          value={nameSearch}
          onChange={e => setNameSearch(e.target.value)}
          className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none sm:w-48"
        />
      </div>

      <p className="mb-2 text-xs text-slate-400">
        {filtered.length} {filtered.length === 1 ? 'user' : 'users'}
        {filter !== 'all' && ` · filtered to ${filter === 'none' ? 'no tier' : filter}`}
      </p>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid grid-cols-[1fr_100px_90px_56px] border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          <div>Name</div>
          <div>Tier</div>
          <div>Status</div>
          <div></div>
        </div>

        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            No users match this filter.
          </div>
        )}

        {filtered.map(user => (
          <div
            key={user._id}
            className="grid grid-cols-[1fr_100px_90px_56px] items-center border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
          >
            {/* Name + headline */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-slate-800">{user.name}</span>
                {user.isBanned && (
                  <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
                    Banned
                  </span>
                )}
              </div>
              {user.headline && (
                <div className="truncate text-xs text-slate-400">{user.headline}</div>
              )}
            </div>

            {/* Tier badge */}
            <div>
              {user.tier ? (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TIER_COLOURS[user.tier]}`}>
                  {user.tier}
                </span>
              ) : (
                <span className="text-xs text-slate-300">—</span>
              )}
            </div>

            {/* Subscription status */}
            <div className={`text-xs font-medium capitalize ${STATUS_COLOURS[user.subscriptionStatus]}`}>
              {user.subscriptionStatus}
            </div>

            {/* Row actions */}
            <div className="flex justify-end">
              <RowActionsMenu label={`Actions for ${user.name}`} items={actionsFor(user)} />
            </div>
          </div>
        ))}
      </div>

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
          <h2 className="text-base font-semibold text-slate-900">Unban {unbanTarget.name}?</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            They'll regain access to the app immediately.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setUnbanTarget(null)}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pendingId === unbanTarget._id}
              onClick={() => void handleUnban()}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {pendingId === unbanTarget._id ? '…' : 'Unban'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
