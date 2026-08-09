import { describe, it, expect } from 'vitest'
import { cascadeDeleteUser } from './deletion'
import schema from '../schema'

function createMockDb(seed: Record<string, any[]>) {
  const tables: Record<string, any[]> = JSON.parse(JSON.stringify(seed))
  const deleted: { table: string; id: string }[] = []
  const patched: { id: string; data: any }[] = []
  const inserted: { table: string; doc: any }[] = []
  return {
    query: (table: string) => ({
      withIndex: (_name: string, _fn: any) => ({
        // Return a fresh array (like real Convex .take()), not the live table reference — the
        // cascade iterates this result while deleting rows, which would otherwise splice mid-loop.
        take: async (_n: number) => [...(tables[table] ?? [])]
      })
    }),
    get: async (id: string) =>
      Object.values(tables)
        .flat()
        .find((r: any) => r._id === id) ?? null,
    patch: async (id: string, data: any) => {
      patched.push({ id, data })
    },
    insert: async (table: string, doc: any) => {
      inserted.push({ table, doc })
      return `${table}-new`
    },
    delete: async (id: string) => {
      for (const t of Object.keys(tables)) {
        const i = tables[t].findIndex((r: any) => r._id === id)
        if (i >= 0) {
          deleted.push({ table: t, id })
          tables[t].splice(i, 1)
          return
        }
      }
      deleted.push({ table: '?', id })
    },
    _deleted: deleted,
    _patched: patched,
    _inserted: inserted
  }
}

const SEED = {
  users: [{ _id: 'u1', email: 'j@x.com' }],
  posts: [
    { _id: 'p1', authorId: 'u1' },
    { _id: 'p2', authorId: 'u1' }
  ],
  postQueue: [{ _id: 'pq1', authorId: 'u1' }],
  subscriptions: [{ _id: 's1', userId: 'u1' }],
  sessions: [{ _id: 'se1', userId: 'u1' }],
  rateLimits: [{ _id: 'r1', userId: 'u1' }],
  featuredPostUsage: [{ _id: 'f1', userId: 'u1' }],
  planLimits: [{ _id: 'pl1', userId: 'u1' }],
  consentRecords: [{ _id: 'c1', userId: 'u1' }],
  dataExportRequests: [{ _id: 'de1', userId: 'u1', fileStorageId: 'stor1' }],
  feedback: [{ _id: 'fb1', userId: 'u1', message: 'test', category: 'comment', status: 'new', createdAt: 1000 }],
  auditLogs: [{ _id: 'al1', targetUserId: 'u1', actorId: 'u1', action: 'x' }],
  userInteractions: [{ _id: 'ui1', userId: 'u1', postId: 'p1', kind: 'reaction', reaction: 'LIKE', createdAt: 1000 }],
  userPostState: [{ _id: 'ups1', userId: 'u1', postId: 'p1', reactedAt: 1000 }]
}

describe('cascadeDeleteUser', () => {
  it('deletes the user and every owned row across all tables', async () => {
    const db = createMockDb(SEED)
    const storage = { delete: async (_id: string) => {} }
    await cascadeDeleteUser(db, storage, 'u1')
    const deletedTables = db._deleted.map(d => d.table)
    for (const t of [
      'users',
      'posts',
      'postQueue',
      'subscriptions',
      'sessions',
      'rateLimits',
      'featuredPostUsage',
      'planLimits',
      'consentRecords',
      'dataExportRequests',
      'userInteractions'
    ]) {
      expect(deletedTables).toContain(t)
    }
    expect(db._deleted.filter(d => d.table === 'posts')).toHaveLength(2)
  })

  it('anonymizes feedback rows instead of deleting them', async () => {
    const db = createMockDb(SEED)
    await cascadeDeleteUser(db, { delete: async () => {} }, 'u1')
    expect(db._patched).toContainEqual({ id: 'fb1', data: { userId: undefined } })
    expect(db._deleted.map(d => d.id)).not.toContain('fb1')
  })

  it('deletes the user document LAST', async () => {
    const db = createMockDb(SEED)
    await cascadeDeleteUser(db, { delete: async () => {} }, 'u1')
    expect(db._deleted[db._deleted.length - 1]).toEqual({ table: 'users', id: 'u1' })
  })

  it('deletes stored export files', async () => {
    const db = createMockDb(SEED)
    const storageDeletes: string[] = []
    await cascadeDeleteUser(
      db,
      {
        delete: async (id: string) => {
          storageDeletes.push(id)
        }
      },
      'u1'
    )
    expect(storageDeletes).toContain('stor1')
  })

  it('pseudonymizes audit rows (nulls targetUserId) instead of deleting them', async () => {
    const db = createMockDb(SEED)
    await cascadeDeleteUser(db, { delete: async () => {} }, 'u1')
    expect(db._patched).toContainEqual({ id: 'al1', data: { targetUserId: undefined, actorId: undefined } })
    expect(db._deleted.map(d => d.id)).not.toContain('al1')
  })

  it('writes a system audit entry recording the deletion', async () => {
    const db = createMockDb(SEED)
    await cascadeDeleteUser(db, { delete: async () => {} }, 'u1')
    const evt = db._inserted.find(i => i.table === 'auditLogs')
    expect(evt?.doc.actor).toBe('system')
    expect(evt?.doc.action).toBe('account.deleted')
  })
})

describe('deletion cascade completeness', () => {
  it('covers every table that references a user (userId/authorId), except users/auditLogs/feedback', async () => {
    const FULLY_EXEMPT = new Set(['users', 'auditLogs'])
    const ANONYMIZED_TABLES = new Set(['feedback'])
    const userRefTables = Object.keys(schema.tables).filter(name => {
      if (FULLY_EXEMPT.has(name) || ANONYMIZED_TABLES.has(name)) return false
      const fields = (schema.tables as any)[name]?._fields
      return fields && ('userId' in fields || 'authorId' in fields)
    })

    const db = createMockDb({ ...SEED })
    await cascadeDeleteUser(db, { delete: async () => {} }, 'u1')
    const deletedTables = new Set(db._deleted.map(d => d.table))
    for (const t of userRefTables) {
      expect(deletedTables.has(t), `cascade must delete rows from "${t}"`).toBe(true)
    }

    // Verify anonymized tables are actually anonymized, not just skipped
    for (const table of ANONYMIZED_TABLES) {
      if (table === 'feedback') {
        expect(db._patched).toContainEqual({ id: 'fb1', data: { userId: undefined } })
        expect(db._deleted.map(d => d.id)).not.toContain('fb1')
      }
    }
  })
})
