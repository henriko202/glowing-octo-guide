// Row shape for the history page (backlog/R16). Kept pure so the mapper is unit-testable and the
// app can import the type without pulling Convex server code.
import type { Reaction } from './reactions'
import { excerpt } from './recap'
import { stripLoneSurrogates } from './safeText'

export interface HistoryRow {
  id: string
  kind: 'reaction' | 'comment' | 'ai_draft'
  reaction?: Reaction
  comment?: string
  createdAt: number
  post: null | {
    id: string
    linkedinPostUrn: string
    sourceUrl?: string
    excerpt: string
    authorName: string
    removed: boolean
  }
}

interface InteractionDoc {
  _id: string
  kind: 'reaction' | 'comment' | 'ai_draft'
  reaction?: Reaction
  comment?: string
  createdAt: number
}

interface PostDoc {
  _id: string
  linkedinPostUrn: string
  sourceUrl?: string
  content: string
  hidden: boolean
  deletedAt?: number
}

export function toHistoryRow(row: InteractionDoc, post: PostDoc | null, author: { name: string } | null): HistoryRow {
  return {
    id: row._id,
    kind: row.kind,
    reaction: row.reaction,
    comment: row.comment === undefined ? undefined : stripLoneSurrogates(row.comment),
    createdAt: row.createdAt,
    post: post
      ? {
          id: post._id,
          linkedinPostUrn: post.linkedinPostUrn,
          sourceUrl: post.sourceUrl,
          excerpt: excerpt(post.content),
          authorName: author?.name ?? '',
          removed: post.deletedAt !== undefined || post.hidden
        }
      : null
  }
}
