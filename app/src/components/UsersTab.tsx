import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex'
import LoadingSpinner from './LoadingSpinner'
import { useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'

type Tier = 'starter' | 'growth' | 'pro' | 'contact'

type UserRow = {
  _id: Id<'users'>
  name: string
  headline?: string
  tier?: Tier
  subscriptionStatus: 'trialing' | 'active' | 'canceled' | 'past_due' | 'none'
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

  const [filter, setFilter] = useState<TierFilter>('all')
  const [settingTier, setSettingTier] = useState<Id<'users'> | null>(null)
  const [nameSearch, setNameSearch] = useState('')

  if (users === undefined) {
    return <LoadingSpinner />
  }

  // Client-side filter — the full list is already live-subscribed, so filtering
  // locally is instant and avoids extra round-trips to Convex.
  const filtered = users.filter(u => {
    const matchesTier =
      filter === 'all' ||
      (filter === 'none' ? !u.tier : u.tier === filter)
    const matchesName = !nameSearch || u.name.toLowerCase().includes(nameSearch.toLowerCase())
    return matchesTier && matchesName
  })

  async function handleSetContact(userId: Id<'users'>) {
    if (!sessionToken) return
    setSettingTier(userId)
    try {
      await setUserTier({ sessionToken, userId, tier: 'contact' })
    } finally {
      setSettingTier(null)
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {/* Tier filter pills */}
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

        {/* Name search */}
        <input
          type="text"
          placeholder="Search by name..."
          value={nameSearch}
          onChange={e => setNameSearch(e.target.value)}
          className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none sm:w-48"
        />
      </div>

      {/* Count */}
      <p className="mb-2 text-xs text-slate-400">
        {filtered.length} {filtered.length === 1 ? 'user' : 'users'}
        {filter !== 'all' && ` · filtered to ${filter === 'none' ? 'no tier' : filter}`}
      </p>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {/* Header */}
        <div className="grid grid-cols-[1fr_100px_90px_80px] border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          <div>Name</div>
          <div>Tier</div>
          <div>Status</div>
          <div>Action</div>
        </div>

        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            No users match this filter.
          </div>
        )}

        {filtered.map(user => (
          <div
            key={user._id}
            className="grid grid-cols-[1fr_100px_90px_80px] items-center border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
          >
            {/* Name + headline */}
            <div className="min-w-0">
              <div className="truncate font-medium text-slate-800">{user.name}</div>
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

            {/* Action */}
            <div>
              {user.tier !== 'contact' ? (
                <button
                  onClick={() => handleSetContact(user._id)}
                  disabled={settingTier === user._id}
                  className="rounded-md bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-200 disabled:opacity-50"
                >
                  {settingTier === user._id ? '…' : '→ Contact'}
                </button>
              ) : (
                <span className="text-xs text-slate-300">contact</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
