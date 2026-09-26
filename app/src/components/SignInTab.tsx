import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../convex'
import LoadingSpinner from './LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { LandingMetrics } from './LandingTab'

type Days = 7 | 28

type SignInEvent =
  | 'started'
  | 'linkedin_ok_new'
  | 'linkedin_ok_returning'
  | 'signed_in_new'
  | 'signed_in_returning'
  | 'denied'
  | 'linkedin_error'
  | 'lost_cookie'
  | 'rejected'
  | 'error'

// Mirrors authMetrics.getMetrics (convex/authMetrics.ts) — the tab's main data source.
export type AuthMetrics = {
  days: Days
  sinceDay: string
  totals: Record<SignInEvent, number>
  daily: { day: string; started: number; linkedinOk: number; signedIn: number; failed: number }[]
}

type Props = {
  sessionToken: string | undefined
  isAdmin: boolean | undefined
}

const FAILURE_LABEL: [SignInEvent, string][] = [
  ['denied', 'Canceled on LinkedIn'],
  ['linkedin_error', 'LinkedIn returned an error'],
  ['lost_cookie', 'Sign-in cookie missing'],
  ['rejected', 'Callback rejected (expired or invalid)'],
  ['error', 'Error after LinkedIn']
]

const ROW_HEADER = 'text-foreground px-4 py-3 text-left align-middle font-medium'

// Admin-only, English-only like the other admin tabs. The landing clicks followed through LinkedIn to a session:
// counts only, per UTC day, like the landing figures.
export default function SignInTab({ sessionToken, isAdmin }: Props) {
  const [days, setDays] = useState<Days>(28)
  const signIns = useQuery(api.authMetrics.getMetrics, sessionToken && isAdmin ? { sessionToken, days } : 'skip') as
    | AuthMetrics
    | null
    | undefined
  // Read only for the funnel's first row, the landing CTA clicks in the same window.
  const landing = useQuery(api.landingMetrics.getMetrics, sessionToken && isAdmin ? { sessionToken, days } : 'skip') as
    | LandingMetrics
    | null
    | undefined

  if (signIns === undefined || landing === undefined) {
    return <LoadingSpinner />
  }

  const windowToggle = (
    <div
      role="group"
      aria-label="Metrics window"
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

  if (!signIns || Object.values(signIns.totals).every(count => count === 0)) {
    return (
      <div>
        {windowToggle}
        <p className="text-muted-foreground text-sm">No sign-in attempts in the last {days} days.</p>
      </div>
    )
  }

  const { totals } = signIns
  const funnel: [string, number, number | null, number | null][] = [
    ['Landing CTA clicks', landing?.ctaClicks ?? 0, null, null],
    ['Sent to LinkedIn', totals.started, null, null],
    [
      'Back from LinkedIn',
      totals.linkedin_ok_new + totals.linkedin_ok_returning,
      totals.linkedin_ok_new,
      totals.linkedin_ok_returning
    ],
    ['Signed in', totals.signed_in_new + totals.signed_in_returning, totals.signed_in_new, totals.signed_in_returning]
  ]

  return (
    <div>
      {windowToggle}

      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>Step</TableHead>
            <TableHead className="w-[90px] text-right">Total</TableHead>
            <TableHead className="w-[90px] text-right">New</TableHead>
            <TableHead className="w-[90px] text-right">Returning</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {funnel.map(([label, total, isNew, returning]) => (
            <TableRow key={label}>
              <th
                scope="row"
                className={ROW_HEADER}
              >
                {label}
              </th>
              <TableCell className="text-right tabular-nums">{total}</TableCell>
              <TableCell className="text-right tabular-nums">{isNew ?? '–'}</TableCell>
              <TableCell className="text-right tabular-nums">{returning ?? '–'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Table className="mt-4 table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>Why a sign-in stopped</TableHead>
            <TableHead className="w-[90px] text-right">Count</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {FAILURE_LABEL.map(([event, label]) => (
            <TableRow key={event}>
              <th
                scope="row"
                className={ROW_HEADER}
              >
                {label}
              </th>
              <TableCell className="text-right tabular-nums">{totals[event]}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Table className="mt-4 table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Day</TableHead>
            <TableHead className="w-[90px] text-right">Sent</TableHead>
            <TableHead className="w-[90px] text-right">Back</TableHead>
            <TableHead className="w-[90px] text-right">Signed in</TableHead>
            <TableHead className="w-[90px] text-right">Failed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {signIns.daily.map(row => (
            <TableRow key={row.day}>
              <th
                scope="row"
                className={ROW_HEADER}
              >
                {row.day}
              </th>
              <TableCell className="text-right tabular-nums">{row.started}</TableCell>
              <TableCell className="text-right tabular-nums">{row.linkedinOk}</TableCell>
              <TableCell className="text-right tabular-nums">{row.signedIn}</TableCell>
              <TableCell className="text-right tabular-nums">{row.failed}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <p className="text-muted-foreground mt-3 text-xs">
        Window: since {signIns.sinceDay} UTC (last {days} days). Sent to LinkedIn also counts the sign-ins the app
        starts on its own when a session expires, so it can exceed the landing clicks. Back from LinkedIn minus Signed
        in is the sign-ins that stopped on the last step: a closed tab or a link opened in a different browser. A
        missing cookie usually means the link was opened inside another app&apos;s browser.
      </p>
    </div>
  )
}
