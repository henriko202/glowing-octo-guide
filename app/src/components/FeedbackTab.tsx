import { useMutation, useQuery } from 'convex/react'
import { api } from '../convex'
import { useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import LoadingSpinner from './LoadingSpinner'
import RowActionsMenu, { type RowAction } from './RowActionsMenu'
import RespondFeedbackModal from './RespondFeedbackModal'

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

const STATUS_COLOURS: Record<Status, string> = {
  new: 'bg-blue-100 text-blue-700',
  responded: 'bg-green-100 text-green-700',
  archived: 'bg-slate-100 text-slate-500'
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
              filter === value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="mb-2 text-xs text-slate-400">
        {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
      </p>

      <div className="rounded-lg border border-slate-200 bg-white">
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-400">No feedback matches this filter.</div>
        )}

        {filtered.map(row => (
          <div
            key={row._id}
            className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-800">{row.userName ?? '(deleted user)'}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {row.category}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLOURS[row.status]}`}
                >
                  {row.status}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">{row.message}</p>
              {row.responses.length > 0 && (
                <div className="mt-1.5 flex flex-col gap-1">
                  {row.responses.map((r, i) => (
                    <div
                      key={i}
                      className="border-l-2 border-green-300 pl-2"
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-green-600">Reply</span>
                      <p className="line-clamp-2 text-[12px] text-slate-500">{r.text}</p>
                      <span className="text-[11px] text-slate-400">
                        {r.responderName ? `${r.responderName} · ` : ''}
                        {new Date(r.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-1 text-[11px] text-slate-400">{new Date(row.createdAt).toLocaleString()}</div>
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
