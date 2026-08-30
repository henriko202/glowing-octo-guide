import { useMutation, useQuery } from 'convex/react'
import { api } from '../convex'
import { useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import LoadingSpinner from './LoadingSpinner'
import RowActionsMenu, { type RowAction } from './RowActionsMenu'
import RespondFeedbackModal from './RespondFeedbackModal'
import { Badge } from '@/components/ui/badge'

type Status = 'new' | 'responded' | 'archived'

type FeedbackResponse = {
  text: string
  createdAt: number
  responderName: string | null
}

type FeedbackRow = {
  _id: Id<'feedback'>
  category: string
  message: string
  status: Status
  createdAt: number
  responses: FeedbackResponse[]
  userName: string | null
  userEmail: string | null
}

type StatusFilter = Status | 'all'

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'responded', label: 'Responded' },
  { value: 'archived', label: 'Archived' }
]

const STATUS_BADGE_VARIANT: Record<Status, 'default' | 'success' | 'outline'> = {
  new: 'default',
  responded: 'success',
  archived: 'outline'
}

type Props = {
  sessionToken: string | undefined
  isAdmin: boolean | undefined
}

export default function FeedbackTab({ sessionToken, isAdmin }: Props) {
  const rows = useQuery(api.feedback.feedback.listFeedback, sessionToken && isAdmin ? { sessionToken } : 'skip') as
    | FeedbackRow[]
    | undefined

  const archiveFeedback = useMutation(api.feedback.feedback.archiveFeedback)
  const reopenFeedback = useMutation(api.feedback.feedback.reopenFeedback)

  const [filter, setFilter] = useState<StatusFilter>('all')
  const [respondTarget, setRespondTarget] = useState<FeedbackRow | null>(null)

  if (rows === undefined) {
    return <LoadingSpinner />
  }

  const filtered = filter === 'all' ? rows : rows.filter(r => r.status === filter)

  function actionsFor(row: FeedbackRow): RowAction[] {
    const items: RowAction[] = []
    if (row.status !== 'archived') {
      items.push({ label: 'Respond…', onClick: () => setRespondTarget(row) })
      items.push({
        label: 'Archive',
        onClick: () => sessionToken && void archiveFeedback({ sessionToken, feedbackId: row._id })
      })
    } else {
      items.push({
        label: 'Reopen',
        onClick: () => sessionToken && void reopenFeedback({ sessionToken, feedbackId: row._id })
      })
    }
    return items
  }

  return (
    <div>
      {/* Status filter */}
      <div className="mb-3 flex flex-wrap gap-1">
        {STATUS_FILTERS.map(({ value, label }) => (
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

      <p className="text-muted-foreground mb-2 text-xs">
        {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
      </p>

      <div className="border-border bg-card rounded-lg border">
        {filtered.length === 0 && (
          <div className="text-muted-foreground px-4 py-8 text-center text-sm">No feedback matches this filter.</div>
        )}

        {filtered.map(row => (
          <div
            key={row._id}
            className="border-border flex items-start gap-3 border-b px-4 py-3 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-foreground font-medium">{row.userName ?? '(deleted user)'}</span>
                <Badge variant="outline">{row.category}</Badge>
                <Badge variant={STATUS_BADGE_VARIANT[row.status]}>{row.status}</Badge>
              </div>
              <p className="text-foreground mt-1 line-clamp-2 text-sm">{row.message}</p>
              {row.responses.length > 0 && (
                <div className="mt-1.5 flex flex-col gap-1">
                  {row.responses.map(r => (
                    <div
                      key={r.createdAt}
                      className="border-primary border-l-2 pl-2"
                    >
                      <span className="text-[10px] font-semibold tracking-wide text-gold-text uppercase">Reply</span>
                      <p className="text-muted-foreground line-clamp-2 text-[12px]">{r.text}</p>
                      <span className="text-muted-foreground text-[11px]">
                        {r.responderName ? `${r.responderName} · ` : ''}
                        {new Date(r.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-muted-foreground mt-1 text-[11px]">{new Date(row.createdAt).toLocaleString()}</div>
            </div>
            <RowActionsMenu
              label={`Actions for feedback from ${row.userName ?? 'deleted user'}`}
              items={actionsFor(row)}
            />
          </div>
        ))}
      </div>

      {respondTarget && sessionToken && (
        <RespondFeedbackModal
          feedback={respondTarget}
          sessionToken={sessionToken}
          onClose={() => setRespondTarget(null)}
        />
      )}
    </div>
  )
}
