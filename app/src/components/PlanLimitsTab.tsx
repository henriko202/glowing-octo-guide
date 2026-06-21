import { useQuery } from 'convex/react'
import { api } from '../convex'
import LoadingSpinner from './LoadingSpinner'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>Tier / User</TableHead>
            <TableHead className="w-[90px]">Int / Post</TableHead>
            <TableHead className="w-[90px]">Posts / Wk</TableHead>
            <TableHead className="w-[90px]">
              <span className="sr-only">Override</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Tier default rows — read-only */}
          {defaults.map(row => (
            <TableRow key={row._id}>
              <TableCell>
                <Badge variant={TIER_VARIANTS[row.tier]}>{row.tier}</Badge>
              </TableCell>
              <TableCell data-testid={`row-${row._id}-interactions`}>{row.interactionsPerPost}</TableCell>
              <TableCell data-testid={`row-${row._id}-posts`}>{row.postsPerWeek}</TableCell>
              <TableCell></TableCell>
            </TableRow>
          ))}

          {/* Contact users — read-only, effective limits (override or contact default) */}
          <TableRow>
            <TableCell
              colSpan={4}
              className="bg-muted text-muted-foreground py-1.5 text-[10px] font-semibold uppercase tracking-wide"
            >
              Contact users
            </TableCell>
          </TableRow>
          {contactUsers.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-muted-foreground py-6 text-center text-sm"
              >
                No contact-tier users.
              </TableCell>
            </TableRow>
          ) : (
            contactUsers.map(u => (
              <TableRow key={u._id}>
                <TableCell className="text-foreground truncate">{u.name}</TableCell>
                <TableCell data-testid={`contact-${u._id}-interactions`}>{u.interactionsPerPost}</TableCell>
                <TableCell data-testid={`contact-${u._id}-posts`}>{u.postsPerWeek}</TableCell>
                <TableCell>{u.hasOverride && <Badge variant="warning">override</Badge>}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <p className="text-muted-foreground mt-3 text-xs">
        Read-only. Change a user's tier or edit per-user contact limits from the{' '}
        <span className="text-foreground font-medium">Users</span> tab.
      </p>
    </div>
  )
}
