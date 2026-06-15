import { describe, it, expect } from 'vitest'
import { writeAuditLog } from './audit'

function createMockDb() {
  const inserts: any[] = []
  return {
    insert: async (table: string, doc: any) => {
      inserts.push({ table, doc })
      return 'audit-id'
    },
    _inserts: inserts
  }
}

describe('writeAuditLog', () => {
  it('inserts an auditLogs row with a timestamp and the given fields', async () => {
    const db = createMockDb()
    await writeAuditLog(db, {
      actor: 'user',
      actorId: 'u1',
      action: 'export.requested',
      targetUserId: 'u1'
    })
    expect(db._inserts).toHaveLength(1)
    expect(db._inserts[0].table).toBe('auditLogs')
    expect(db._inserts[0].doc.actor).toBe('user')
    expect(db._inserts[0].doc.action).toBe('export.requested')
    expect(db._inserts[0].doc.targetUserId).toBe('u1')
    expect(db._inserts[0].doc.createdAt).toBeGreaterThan(0)
  })

  it('works with only the required fields', async () => {
    const db = createMockDb()
    await writeAuditLog(db, { actor: 'system', action: 'retention.tokenNulled' })
    expect(db._inserts[0].doc.actor).toBe('system')
    expect(db._inserts[0].doc.actorId).toBeUndefined()
  })
})
