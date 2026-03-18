import { describe, it, expect } from 'vitest'
import { upsertUserHandler, type UpsertUserArgs } from './auth'

// Minimal in-memory mock for Convex db context
function createMockDb(existingUser?: any) {
  const records: any[] = existingUser ? [existingUser] : []
  const patches: any[] = []
  const inserts: any[] = []

  return {
    query: (_table: string) => ({
      withIndex: (_name: string, _fn: any) => ({
        first: async () => records[0] ?? null
      })
    }),
    get: async (_id: string) => records.find(r => r._id === _id) ?? null,
    patch: async (id: string, data: any) => {
      patches.push({ id, data })
    },
    insert: async (_table: string, data: any) => {
      inserts.push(data)
      return 'new-user-id'
    },
    _patches: patches,
    _inserts: inserts
  }
}

const BASE_ARGS: UpsertUserArgs = {
  linkedinId: 'li-123',
  name: 'Jane Doe',
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  tokenExpiresAt: Date.now() + 3600000
}

describe('upsertUserHandler', () => {
  it('creates a new user on Starter trial when no existing user', async () => {
    const db = createMockDb()
    const id = await upsertUserHandler(db, BASE_ARGS)
    expect(id).toBe('new-user-id')
    expect(db._inserts).toHaveLength(1)
    const inserted = db._inserts[0]
    expect(inserted.tier).toBe('starter')
    expect(inserted.subscriptionStatus).toBe('trialing')
    expect(inserted.trialEndsAt).toBeGreaterThan(Date.now())
    expect(inserted.linkedinId).toBe('li-123')
  })

  it('updates existing user tokens without changing tier', async () => {
    const existing = { _id: 'existing-id', linkedinId: 'li-123', tier: 'pro', subscriptionStatus: 'active' }
    const db = createMockDb(existing)
    const id = await upsertUserHandler(db, { ...BASE_ARGS, accessToken: 'new-token' })
    expect(id).toBe('existing-id')
    expect(db._patches).toHaveLength(1)
    expect(db._patches[0].data.linkedinAccessToken).toBe('new-token')
    expect(db._inserts).toHaveLength(0)
  })
})
