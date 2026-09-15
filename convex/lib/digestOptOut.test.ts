import { describe, expect, it } from 'vitest'
import { disableDigest } from './digestOptOut'

function createDb(user: { digestEmailsEnabled?: boolean } | null) {
  const patches: Array<{ id: string; fields: Record<string, unknown> }> = []
  const inserts: Array<{ table: string; doc: Record<string, unknown> }> = []
  return {
    get: async () => user,
    patch: async (id: string, fields: Record<string, unknown>) => {
      patches.push({ id, fields })
    },
    insert: async (table: string, doc: Record<string, unknown>) => {
      inserts.push({ table, doc })
      return 'audit-id'
    },
    _patches: patches,
    _inserts: inserts
  }
}

describe('disableDigest', () => {
  it('patches the flag off and appends one audit row when the digest is on', async () => {
    const db = createDb({ digestEmailsEnabled: true })
    const changed = await disableDigest(db, 'u1', 'digest_unsubscribed_app')

    expect(changed).toBe(true)
    expect(db._patches).toEqual([{ id: 'u1', fields: { digestEmailsEnabled: false } }])
    expect(db._inserts).toHaveLength(1)
    expect(db._inserts[0]).toMatchObject({
      table: 'auditLogs',
      doc: { actor: 'user', actorId: 'u1', action: 'digest_unsubscribed_app', targetUserId: 'u1' }
    })
    expect(db._inserts[0].doc.createdAt).toBeGreaterThan(0)
  })

  it('treats an absent flag as on (opt-out default)', async () => {
    const db = createDb({})
    expect(await disableDigest(db, 'u1', 'digest_unsubscribed_app')).toBe(true)
    expect(db._patches).toHaveLength(1)
  })

  it('is a no-op when the digest is already off', async () => {
    const db = createDb({ digestEmailsEnabled: false })
    expect(await disableDigest(db, 'u1', 'digest_unsubscribed_app')).toBe(false)
    expect(db._patches).toHaveLength(0)
    expect(db._inserts).toHaveLength(0)
  })

  it('is a no-op for a missing user', async () => {
    const db = createDb(null)
    expect(await disableDigest(db, 'ghost', 'digest_unsubscribed_app')).toBe(false)
    expect(db._patches).toHaveLength(0)
    expect(db._inserts).toHaveLength(0)
  })
})
