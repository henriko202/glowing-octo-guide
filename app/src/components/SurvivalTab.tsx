import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../convex'
import LoadingSpinner from './LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Days = 7 | 28
type Tier = 'starter' | 'growth' | 'pro' | 'contact'

// Mirrors admin.survivalMetrics (convex/admin.ts) — the tab's only data source.
export type SurvivalMetrics = {
  days: Days
  since: number
  generatedAt: number
  cohort: {
    signups: number
    startedTrial: number
    onboarded: number
    activated: number
    medianMinutesToFirstInteraction: number | null
    returnedDay1: number
    returnedDays2to7: number
    trialsEnded: number
    converted: number
    canceled: number
    activatedEligible: number
    returnedDay1Eligible: number
    returnedDays2to7Eligible: number
  }
  payingByTier: Record<Tier, number>
}

type Props = {
  sessionToken: string | undefined
  isAdmin: boolean | undefined
}

const TIER_ORDER: Tier[] = ['starter', 'growth', 'pro', 'contact']

/**
 * "40%" — a whole percent, or "–" when the base is zero. A gauge, not an invoice.
 * "–" and "0%" mean opposite things here: nothing to divide by yet vs. nobody did it.
 */
export function share(part: number, base: number): string {
  return base > 0 ? `${Math.round((part / base) * 100)}%` : '–'
}

// "2026-09-07 14:03" — the window's two edges, so the footer's "UTC" has something to refer to.
function utc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 16).replace('T', ' ')
}

// Admin-only, English-only like the other admin tabs. Every number comes from one query the admin
// could re-run; nothing is read from PostHog (backlog/R18).
export default function SurvivalTab({ sessionToken, isAdmin }: Props) {
  const [days, setDays] = useState<Days>(7)
  const metrics = useQuery(api.admin.survivalMetrics, sessionToken && isAdmin ? { sessionToken, days } : 'skip') as
    | SurvivalMetrics
    | null
    | undefined

  if (metrics === undefined) {
    return <LoadingSpinner />
  }

  // The toggle stays live even with no snapshot: the two windows are separate rows, so one may
  // exist while the other does not.
  const windowToggle = (
    <div
      role="group"
      aria-label="Cohort window"
      className="mb-3 flex gap-1"
    >
      {([7, 28] as Days[]).map(d => (
        <Button
          key={d}
          size="sm"
          variant={days === d ? 'default' : 'outline'}
          aria-pressed={days === d}
          onClick={() => setDays(d)}
        >
          {d} days
        </Button>
      ))}
    </div>
  )

  // The panel reads a nightly snapshot (admin.survivalMetrics), so there is a real data-less state:
  // the cron has not written a row for this window yet.
  if (metrics === null) {
    return (
      <div>
        {windowToggle}
        <p className="text-muted-foreground text-sm">No snapshot yet — the nightly rebuild has not run.</p>
      </div>
    )
  }

  const c = metrics.cohort
  // Every share divides by the members it could possibly apply to, never by the whole cohort: a
  // window that has not closed yet (signed up two hours ago, "returned day 1" needs 48 h) would
  // otherwise drag the percentage down for a reason that is not about behaviour. The "Of" column
  // is that base, so a share of "–" reads as "not enough data yet", never as 0 %. Each definition
  // rides on its row header's `title`, so nobody has to open lib/survival.ts to learn what a row means.
  const rows: { label: string; title: string; count: string; share: string; base: string }[] = [
    {
      label: 'Signed up',
      title: 'Accounts created inside the window (UTC).',
      count: String(c.signups),
      share: '',
      base: ''
    },
    {
      label: 'Started trial',
      title:
        'Has at least one subscription row: reached Stripe checkout and started a trial. Of: everyone who signed up in the window.',
      count: String(c.startedTrial),
      share: share(c.startedTrial, c.signups),
      base: String(c.signups)
    },
    {
      label: 'Onboarded',
      title:
        'Added at least one post or recorded at least one interaction (reaction, comment or AI draft), any time after signup. Of: everyone who signed up in the window.',
      count: String(c.onboarded),
      share: share(c.onboarded, c.signups),
      base: String(c.signups)
    },
    {
      label: 'Activated within 24 h',
      title: 'First feed interaction less than 24 h after signup. Of: members whose first 24 h have already passed.',
      count: String(c.activated),
      share: share(c.activated, c.activatedEligible),
      base: String(c.activatedEligible)
    },
    {
      label: 'Median minutes to first interaction',
      title:
        'Whole minutes from signup to the first feed interaction, over the members who interacted at all. A time, not a share.',
      count: c.medianMinutesToFirstInteraction === null ? '–' : String(c.medianMinutesToFirstInteraction),
      share: '',
      base: ''
    },
    {
      label: 'Returned day 1',
      title: 'Any interaction between 24 h and 48 h after signup. Of: members whose first 48 h have already passed.',
      count: String(c.returnedDay1),
      share: share(c.returnedDay1, c.returnedDay1Eligible),
      base: String(c.returnedDay1Eligible)
    },
    {
      // [24 h, 8 d) includes day 1, so this is a superset of the row above — the label says so.
      label: 'Returned days 1–7',
      title:
        'Any interaction between 24 h and 8 days after signup, so it includes day 1. Of: members whose first 8 days have already passed.',
      count: String(c.returnedDays2to7),
      share: share(c.returnedDays2to7, c.returnedDays2to7Eligible),
      base: String(c.returnedDays2to7Eligible)
    },
    {
      label: 'Trials ended',
      title: 'Started a trial and the subscription is now active, canceled or past due.',
      count: String(c.trialsEnded),
      share: '',
      base: ''
    },
    {
      label: 'Converted',
      title: 'Started a trial and the subscription is active. Of: trials ended.',
      count: String(c.converted),
      share: share(c.converted, c.trialsEnded),
      base: String(c.trialsEnded)
    },
    {
      label: 'Canceled',
      title: 'Subscription canceled, or a cancellation scheduled for the period end. Counted over the whole cohort.',
      count: String(c.canceled),
      share: '',
      base: ''
    }
  ]

  return (
    <div>
      {windowToggle}

      {/* The panel is eventually consistent: the caption says which nightly rebuild these numbers are from. */}
      <p className="text-muted-foreground mb-3 text-xs">Snapshot as of {utc(metrics.generatedAt)} UTC</p>

      {/* R18: an empty cohort says so and nothing else — a table of zeros reads like data. The tier
          table below is not cohort-bound, so it stays. */}
      {c.signups === 0 ? (
        <p className="text-muted-foreground text-sm">No signups in the last {days} days.</p>
      ) : (
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead>
              <TableHead className="w-[90px] text-right">Count</TableHead>
              <TableHead className="w-[90px] text-right">Of</TableHead>
              <TableHead className="w-[90px] text-right">Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.label}>
                <th
                  scope="row"
                  title={r.title}
                  className="text-foreground px-4 py-3 text-left align-middle font-medium"
                >
                  {r.label}
                </th>
                <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                <TableCell className="text-muted-foreground text-right tabular-nums">{r.base}</TableCell>
                <TableCell className="text-muted-foreground text-right tabular-nums">{r.share}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <h2 className="text-foreground mt-6 mb-2 text-base font-semibold">Paying by tier (all active members)</h2>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>Tier</TableHead>
            <TableHead className="w-[90px] text-right">Members</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {TIER_ORDER.map(tier => (
            <TableRow key={tier}>
              <th
                scope="row"
                className="text-foreground px-4 py-3 text-left align-middle font-medium capitalize"
              >
                {tier}
              </th>
              <TableCell className="text-right tabular-nums">{metrics.payingByTier[tier]}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <p className="text-muted-foreground mt-3 text-xs">
        {utc(metrics.since)} – {utc(metrics.generatedAt)} UTC · cohort = members who signed up in the window · “Of”
        counts only the members whose window has already closed, so a share of “–” means not enough data yet
      </p>
    </div>
  )
}
