import { useQuery } from 'convex/react'
import { api } from '../convex'
import LoadingSpinner from './LoadingSpinner'
import { Badge } from '@/components/ui/badge'
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

// Tier badge variant mapping
const TIER_VARIANTS: Record<Tier, 'outline' | 'default' | 'success' | 'warning'> = {
  starter: 'outline',
  growth: 'default',
  pro: 'success',
  contact: 'warning'
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
      <div
        className="border-border bg-card overflow-hidden rounded-lg border"
        role="table"
      >
        {/* Table header */}
        <div
          className="border-border bg-muted text-muted-foreground grid grid-cols-[1fr_90px_90px_90px] border-b px-4 py-2 text-[11px] font-semibold uppercase tracking-wide"
          role="row"
        >
          <div role="columnheader">Tier / User</div>
          <div role="columnheader">Int / Post</div>
          <div role="columnheader">Posts / Wk</div>
          <div role="columnheader"></div>
        </div>

        {/* Tier default rows — read-only */}
        {defaults.map(row => (
          <div
            key={row._id}
            className="border-border grid grid-cols-[1fr_90px_90px_90px] items-center border-b px-4 py-3 text-sm"
            role="row"
          >
            <div role="cell">
              <Badge variant={TIER_VARIANTS[row.tier]}>{row.tier}</Badge>
            </div>
            <div
              role="cell"
              data-testid={`row-${row._id}-interactions`}
            >
              {row.interactionsPerPost}
            </div>
            <div
              role="cell"
              data-testid={`row-${row._id}-posts`}
            >
              {row.postsPerWeek}
            </div>
            <div role="cell"></div>
          </div>
        ))}

        {/* Contact users — read-only, effective limits (override or contact default) */}
        <div
          className="border-border bg-muted text-muted-foreground border-b px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide"
          role="row"
        >
          <div role="cell">Contact users</div>
        </div>
        {contactUsers.length === 0 ? (
          <div
            className="text-muted-foreground px-4 py-6 text-center text-sm"
            role="row"
          >
            <div role="cell">No contact-tier users.</div>
          </div>
        ) : (
          contactUsers.map(u => (
            <div
              key={u._id}
              className="border-border grid grid-cols-[1fr_90px_90px_90px] items-center border-b px-4 py-3 text-sm last:border-b-0"
              role="row"
            >
              <div
                role="cell"
                className="text-foreground truncate"
              >
                {u.name}
              </div>
              <div
                role="cell"
                data-testid={`contact-${u._id}-interactions`}
              >
                {u.interactionsPerPost}
              </div>
              <div
                role="cell"
                data-testid={`contact-${u._id}-posts`}
              >
                {u.postsPerWeek}
              </div>
              <div role="cell">{u.hasOverride && <Badge variant="warning">override</Badge>}</div>
            </div>
          ))
        )}
      </div>

      <p className="text-muted-foreground mt-3 text-xs">
        Read-only. Change a user's tier or edit per-user contact limits from the{' '}
        <span className="text-foreground font-medium">Users</span> tab.
      </p>
    </div>
  )
}
