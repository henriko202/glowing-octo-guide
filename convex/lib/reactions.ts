// convex/lib/reactions.ts
// PURE — single source of truth for the LinkedIn reaction enum, shared by the schema,
// the reactToPost action, the AI prediction, and the UI picker.
import { type Infer, v } from 'convex/values'

/** LinkedIn /rest/reactions reactionType values (verbatim). Single source of truth. */
export const reactionValidator = v.union(
  v.literal('LIKE'),
  v.literal('PRAISE'),
  v.literal('EMPATHY'),
  v.literal('INTEREST'),
  v.literal('APPRECIATION'),
  v.literal('ENTERTAINMENT')
)
export type Reaction = Infer<typeof reactionValidator>

/** UI metadata, co-located so labels/emoji can never reference a non-existent reaction. */
export const REACTIONS: ReadonlyArray<{ value: Reaction; emoji: string; labelKey: string }> = [
  { value: 'LIKE', emoji: '👍', labelKey: 'reactions.like' },
  { value: 'PRAISE', emoji: '👏', labelKey: 'reactions.celebrate' },
  { value: 'EMPATHY', emoji: '❤️', labelKey: 'reactions.love' },
  { value: 'INTEREST', emoji: '💡', labelKey: 'reactions.insightful' },
  { value: 'APPRECIATION', emoji: '🤝', labelKey: 'reactions.support' },
  { value: 'ENTERTAINMENT', emoji: '😄', labelKey: 'reactions.funny' }
]

/**
 * Coerce a raw model reply into a valid reaction. Exact one-word reply wins; else the
 * first keyword matched as a whole word (\b) wins; anything else defaults to LIKE.
 */
export function parseReaction(raw: string): Reaction {
  const text = (raw ?? '').trim().toUpperCase()
  for (const r of REACTIONS) if (text === r.value) return r.value
  for (const r of REACTIONS) if (new RegExp(`\\b${r.value}\\b`).test(text)) return r.value
  return 'LIKE'
}
