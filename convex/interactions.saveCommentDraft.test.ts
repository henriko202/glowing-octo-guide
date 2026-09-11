import { describe, expect, it } from 'vitest'
import { saveCommentDraftHandler } from './interactions'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

// The draft's first save is a real interaction (log row + trial bump); every later regeneration is
// just a text refresh. These tests build the narrow fake ctx this one handler touches, so the
// transaction's write set — not a wrapper — is what gets pinned.

const USER_ID = 'u1' as Id<'users'>
const POST_ID = 'p1' as Id<'posts'>
const COUNTER_ID = 'c1' as Id<'trialCounters'>
const STATE_ID = 's1' as Id<'userPostState'>

type InsertCall = { table: string; doc: Record<string, unknown> }

function createCtx(opts: {
  user: { subscriptionStatus?: string } | null
  counter?: { made: number; received: number } | null
  state?: { aiDraftedAt?: number } | null
}) {
  const inserts: InsertCall[] = []
  const patches: Array<{ id: string; fields: Record<string, unknown> }> = []
  const gets: string[] = []
  const ctx = {
    db: {
      get: async (id: string) => {
        gets.push(id)
        return id === USER_ID ? opts.user : null
      },
      query: (table: string) => ({
        withIndex: (_index: string, range: (q: { eq: (field: string, value: unknown) => unknown }) => unknown) => {
          const q = { eq: () => q }
          range(q)
          return {
            unique: async () => {
              if (table === 'userPostState') return opts.state ? { _id: STATE_ID, ...opts.state } : null
              if (table === 'trialCounters') return opts.counter ? { _id: COUNTER_ID, ...opts.counter } : null
              return null
            }
          }
        }
      }),
      insert: async (table: string, doc: Record<string, unknown>) => {
        inserts.push({ table, doc })
        return `${table}-id`
      },
      patch: async (id: string, fields: Record<string, unknown>) => {
        patches.push({ id, fields })
      }
    },
    scheduler: { runAfter: async () => undefined }
  }
  return { ctx: ctx as unknown as MutationCtx, inserts, patches, gets }
}

describe('saveCommentDraftHandler', () => {
  it('logs the first draft as an ai_draft interaction and bumps the trial counter', async () => {
    const t = createCtx({ user: { subscriptionStatus: 'trialing' }, counter: { made: 2, received: 1 }, state: null })
    await saveCommentDraftHandler(t.ctx, USER_ID, POST_ID, 'Congrats!')

    expect(t.inserts).toHaveLength(2)
    expect(t.inserts[0]).toMatchObject({
      table: 'userPostState',
      doc: { userId: USER_ID, postId: POST_ID, commentDraft: 'Congrats!' }
    })
    expect(t.inserts[0].doc.aiDraftedAt).toBeTypeOf('number')
    expect(t.inserts[1]).toMatchObject({
      table: 'userInteractions',
      doc: { userId: USER_ID, postId: POST_ID, kind: 'ai_draft', comment: 'Congrats!' }
    })
    // No authorId: a draft is not engagement the author received.
    expect('authorId' in t.inserts[1].doc).toBe(false)
    expect(t.patches).toEqual([{ id: COUNTER_ID, fields: { made: 3 } }])
    // Never reads or patches the post — no commentCount bump, no cap check.
    expect(t.gets).toEqual([USER_ID])
  })

  it('treats a row that exists without aiDraftedAt (a prior reaction) as the first draft', async () => {
    const t = createCtx({ user: { subscriptionStatus: 'active' }, state: {} })
    await saveCommentDraftHandler(t.ctx, USER_ID, POST_ID, 'First draft')

    expect(t.patches).toEqual([
      { id: STATE_ID, fields: { commentDraft: 'First draft', aiDraftedAt: expect.any(Number) } }
    ])
    expect(t.inserts.map(i => i.table)).toEqual(['userInteractions'])
    expect(t.inserts[0].doc).not.toHaveProperty('authorId')
  })

  it('refreshes only commentDraft on a regeneration: no second log row, no second bump', async () => {
    const t = createCtx({
      user: { subscriptionStatus: 'trialing' },
      counter: { made: 3, received: 1 },
      state: { aiDraftedAt: 111 }
    })
    await saveCommentDraftHandler(t.ctx, USER_ID, POST_ID, 'Rewritten draft')

    expect(t.inserts).toHaveLength(0)
    expect(t.patches).toEqual([{ id: STATE_ID, fields: { commentDraft: 'Rewritten draft' } }])
    // The trial counter is not even read: a regeneration is not a new interaction.
    expect(t.gets).toEqual([])
  })
})
