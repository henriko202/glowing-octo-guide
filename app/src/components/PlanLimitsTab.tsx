import { useQuery } from 'convex/react'
import { api } from '../convex'
import LoadingSpinner from './LoadingSpinner'
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

type ContactUser = {
  _id: Id<'users'>
  name: string
  interactionsPerPost: number
  postsPerWeek: number
  hasOverride: boolean
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

type Props = {
  sessionToken: string | undefined
  isAdmin: boolean | undefined
}

// Read-only view: tier default limits + every contact-tier user with their effective limits.
// All editing (tier changes, per-user contact overrides) happens in the Users tab.
export default function PlanLimitsTab({ sessionToken, isAdmin }: Props) {
  const rows = useQuery(api.admin.listPlanLimits, sessionToken && isAdmin ? { sessionToken } : 'skip') as
    | PlanLimitRow[]
    | undefined
  const contactUsers = useQuery(
    api.admin.listContactUsersWithLimits,
    sessionToken && isAdmin ? { sessionToken } : 'skip'
  ) as ContactUser[] | undefined

  if (rows === undefined || contactUsers === undefined) {
    return <LoadingSpinner />
  }

  const defaults = TIER_ORDER.map(tier => rows.find(r => r.tier === tier && !r.userId)).filter(
    Boolean
  ) as PlanLimitRow[]

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_90px_90px_90px] border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          <div>Tier / User</div>
          <div>Int / Post</div>
          <div>Posts / Wk</div>
          <div></div>
        </div>

        {/* Tier default rows — read-only */}
        {defaults.map(row => (
          <div
            key={row._id}
            className="grid grid-cols-[1fr_90px_90px_90px] items-center border-b border-slate-100 px-4 py-3 text-sm"
          >
            <div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TIER_COLOURS[row.tier]}`}>
                {row.tier}
              </span>
            </div>
            <div data-testid={`row-${row._id}-interactions`}>{row.interactionsPerPost}</div>
            <div data-testid={`row-${row._id}-posts`}>{row.postsPerWeek}</div>
            <div></div>
          </div>
        ))}

        {/* Contact users — read-only, effective limits (override or contact default) */}
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Contact users
        </div>
        {contactUsers.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-400">No contact-tier users.</div>
        ) : (
          contactUsers.map(u => (
            <div
              key={u._id}
              className="grid grid-cols-[1fr_90px_90px_90px] items-center border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
            >
              <div className="truncate text-slate-700">{u.name}</div>
              <div data-testid={`contact-${u._id}-interactions`}>{u.interactionsPerPost}</div>
              <div data-testid={`contact-${u._id}-posts`}>{u.postsPerWeek}</div>
              <div>
                {u.hasOverride && (
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                    override
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Read-only. Change a user's tier or edit per-user contact limits from the{' '}
        <span className="font-medium text-slate-500">Users</span> tab.
      </p>
    </div>
  )
}
