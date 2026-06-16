import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex'
import LoadingSpinner from './LoadingSpinner'
import { useState, useEffect } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'

type Tier = 'starter' | 'growth' | 'pro' | 'contact'

type PlanLimitRow = {
  _id: Id<'planLimits'>
  tier: Tier
  userId?: Id<'users'>
  userName?: string
  interactionsPerPost: number
  postsPerWeek: number
}

// EditTarget covers both existing contact override rows and new overrides (no _id yet)
type EditTarget = {
  _id?: Id<'planLimits'>
  tier: 'contact'
  userId: Id<'users'>
  userName: string
  interactionsPerPost: number
  postsPerWeek: number
  isNew?: boolean
}

// Fixed display order for tier default rows
const TIER_ORDER: Tier[] = ['starter', 'growth', 'pro', 'contact']

// Tier badge colour classes
const TIER_COLOURS: Record<Tier, string> = {
  starter: 'bg-slate-100 text-slate-600',
  growth: 'bg-blue-100 text-blue-700',
  pro: 'bg-green-100 text-green-700',
  contact: 'bg-purple-100 text-purple-700'
}

function sortRows(rows: PlanLimitRow[]): { defaults: PlanLimitRow[]; overrides: PlanLimitRow[] } {
  const defaults = TIER_ORDER.map(tier => rows.find(r => r.tier === tier && !r.userId)).filter(
    Boolean
  ) as PlanLimitRow[]
  const overrides = rows.filter(r => r.userId).sort((a, b) => (a.userName ?? '').localeCompare(b.userName ?? ''))
  return { defaults, overrides }
}

type Props = {
  sessionToken: string | undefined
  isAdmin: boolean | undefined
}

export default function PlanLimitsTab({ sessionToken, isAdmin }: Props) {
  const rows = useQuery(api.admin.listPlanLimits, sessionToken && isAdmin ? { sessionToken } : 'skip') as
    | PlanLimitRow[]
    | undefined

  const setContactUserLimit = useMutation(api.admin.setContactUserLimit)
  const removeContactUserLimit = useMutation(api.admin.removeContactUserLimit)

  const [editingRow, setEditingRow] = useState<EditTarget | null>(null)
  const [resetting, setResetting] = useState<Id<'planLimits'> | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 250)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const searchResults = useQuery(
    api.admin.searchContactUsers,
    sessionToken && isAdmin && debouncedQuery ? { sessionToken, nameQuery: debouncedQuery } : 'skip'
  ) as { _id: Id<'users'>; name: string }[] | undefined

  if (rows === undefined) {
    return <LoadingSpinner />
  }

  const { defaults, overrides } = sortRows(rows)

  function handleSelectUser(user: { _id: Id<'users'>; name: string }) {
    const existing = overrides.find(r => r.userId === user._id)
    const contactDefault = rows?.find(r => r.tier === 'contact' && !r.userId)
    setEditingRow({
      _id: existing?._id,
      tier: 'contact',
      userId: user._id,
      userName: user.name,
      interactionsPerPost: existing?.interactionsPerPost ?? contactDefault?.interactionsPerPost ?? 200,
      postsPerWeek: existing?.postsPerWeek ?? contactDefault?.postsPerWeek ?? 5,
      isNew: !existing
    })
    setSearchQuery('')
  }

  async function handleReset(row: PlanLimitRow) {
    if (!row.userId || !sessionToken) return
    setResetting(row._id)
    try {
      await removeContactUserLimit({ sessionToken, userId: row.userId })
    } finally {
      setResetting(null)
    }
  }

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_100px_100px_130px] border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          <div>Tier / User</div>
          <div>Int / Post</div>
          <div>Posts / Wk</div>
          <div>Actions</div>
        </div>

        {/* Tier default rows — read-only */}
        {defaults.map(row => (
          <div
            key={row._id}
            className="grid grid-cols-[1fr_100px_100px_130px] items-center border-b border-slate-100 px-4 py-3 text-sm"
          >
            <div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TIER_COLOURS[row.tier]}`}>
                {row.tier}
              </span>
            </div>
            <div data-testid={`row-${row._id}-interactions`}>{row.interactionsPerPost}</div>
            <div data-testid={`row-${row._id}-posts`}>{row.postsPerWeek}</div>
            <div className="text-xs text-slate-300">—</div>
          </div>
        ))}

        {/* Contact override rows */}
        {overrides.length > 0 && (
          <>
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Contact overrides
            </div>
            {overrides.map(row => (
              <div
                key={row._id}
                className="grid grid-cols-[1fr_100px_100px_130px] items-center border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
              >
                <div className="text-slate-700">{row.userName ?? row.userId}</div>
                <div data-testid={`row-${row._id}-interactions`}>{row.interactionsPerPost}</div>
                <div data-testid={`row-${row._id}-posts`}>{row.postsPerWeek}</div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      setEditingRow({
                        _id: row._id,
                        tier: 'contact',
                        userId: row.userId!,
                        userName: row.userName ?? '',
                        interactionsPerPost: row.interactionsPerPost,
                        postsPerWeek: row.postsPerWeek
                      })
                    }
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleReset(row)}
                    disabled={resetting === row._id}
                    className="text-xs font-medium text-slate-400 hover:text-red-500 disabled:opacity-50"
                  >
                    {resetting === row._id ? '…' : 'Reset'}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Add contact override — live search */}
      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Add contact override</p>
        <input
          type="text"
          placeholder="Search contact users..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
        />
        {searchQuery && searchResults && searchResults.length > 0 && (
          <div className="mt-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
            {searchResults.map(user => (
              <button
                key={user._id}
                onClick={() => handleSelectUser(user)}
                className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                {user.name}
              </button>
            ))}
          </div>
        )}
        {searchQuery && searchResults?.length === 0 && (
          <p className="mt-2 text-xs text-slate-400">No contact users found matching "{searchQuery}"</p>
        )}
      </div>

      {/* Edit modal */}
      {editingRow && sessionToken && (
        <EditModal
          row={editingRow}
          sessionToken={sessionToken}
          onClose={() => setEditingRow(null)}
          setContactUserLimit={setContactUserLimit}
          removeContactUserLimit={removeContactUserLimit}
        />
      )}
    </div>
  )
}

// ─── Edit Modal ──────────────────────────────────────────────────────────────

type EditModalProps = {
  row: EditTarget
  sessionToken: string
  onClose: () => void
  setContactUserLimit: ReturnType<typeof useMutation<typeof api.admin.setContactUserLimit>>
  removeContactUserLimit: ReturnType<typeof useMutation<typeof api.admin.removeContactUserLimit>>
}

function EditModal({ row, sessionToken, onClose, setContactUserLimit, removeContactUserLimit }: EditModalProps) {
  const [interactions, setInteractions] = useState(String(row.interactionsPerPost))
  const [posts, setPosts] = useState(String(row.postsPerWeek))
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isNew = Boolean(row.isNew)

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
        userId: row.userId,
        interactionsPerPost: Number(interactions),
        postsPerWeek: Number(posts)
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    setResetting(true)
    setError(null)
    try {
      await removeContactUserLimit({ sessionToken, userId: row.userId })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed')
    } finally {
      setResetting(false)
    }
  }

  const title = isNew ? `Add override for ${row.userName}` : `Edit ${row.userName} limits`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div className="w-72 rounded-xl bg-white p-5 shadow-xl">
        <h3 className="mb-4 text-[15px] font-semibold text-slate-900">{title}</h3>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Interactions per post
            </span>
            <input
              type="number"
              min="1"
              value={interactions}
              onChange={e => setInteractions(e.target.value)}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Posts per week</span>
            <input
              type="number"
              min="1"
              value={posts}
              onChange={e => setPosts(e.target.value)}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
            />
          </label>
        </div>

        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="flex-1 rounded-md bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '…' : 'Save'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-md bg-slate-100 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200"
          >
            Cancel
          </button>
        </div>

        {!isNew && (
          <button
            onClick={handleReset}
            disabled={resetting}
            className="mt-3 w-full text-center text-xs text-slate-400 hover:text-red-500 disabled:opacity-50"
          >
            {resetting ? '…' : 'Reset to default'}
          </button>
        )}
      </div>
    </div>
  )
}
