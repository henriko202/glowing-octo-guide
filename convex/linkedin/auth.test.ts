import { describe, it, expect } from 'vitest'
import { upsertUserHandler, updateTokensHandler, type UpsertUserArgs } from './auth'
import { POLICY_VERSION } from '../lib/policy'

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
  it('creates a new user with status none (trial begins only on card-add)', async () => {
    const db = createMockDb()
    const id = await upsertUserHandler(db, BASE_ARGS)
    expect(id).toBe('new-user-id')
    expect(db._inserts).toHaveLength(1)
    const inserted = db._inserts[0]
    expect(inserted.tier).toBe('starter')
    expect(inserted.subscriptionStatus).toBe('none')
    expect(inserted.trialEndsAt).toBeUndefined()
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

  it('stores email, lastLoginAt, and acknowledged policy version for a new user', async () => {
    const db = createMockDb()
    await upsertUserHandler(db, { ...BASE_ARGS, email: 'jane@example.com', emailVerified: true })
    const inserted = db._inserts[0]
    expect(inserted.email).toBe('jane@example.com')
    expect(inserted.emailVerified).toBe(true)
    expect(inserted.lastLoginAt).toBeGreaterThan(0)
    expect(inserted.acknowledgedPolicyVersion).toBe(POLICY_VERSION)
  })

  it('refreshes lastLoginAt and email on an existing-user login', async () => {
    const existing = { _id: 'existing-id', linkedinId: 'li-123', tier: 'pro', subscriptionStatus: 'active' }
    const db = createMockDb(existing)
    await upsertUserHandler(db, { ...BASE_ARGS, email: 'new@example.com' })
    expect(db._patches[0].data.lastLoginAt).toBeGreaterThan(0)
    expect(db._patches[0].data.email).toBe('new@example.com')
  })
})

describe('updateTokensHandler', () => {
  function createPatchDb() {
    const patches: Array<{ id: string; data: Record<string, unknown> }> = []
    return {
      patch: async (id: string, data: Record<string, unknown>) => {
        patches.push({ id, data })
      },
      _patches: patches
    }
  }

  it('patches accessToken, refreshToken, and tokenExpiresAt', async () => {
    const db = createPatchDb()
    await updateTokensHandler(db, {
      userId: 'user-1',
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      tokenExpiresAt: 999
    })
    expect(db._patches).toHaveLength(1)
    expect(db._patches[0]).toEqual({
      id: 'user-1',
      data: { linkedinAccessToken: 'new-access', tokenExpiresAt: 999, linkedinRefreshToken: 'new-refresh' }
    })
  })

  it('omits refreshToken from the patch when LinkedIn does not return a new one', async () => {
    const db = createPatchDb()
    await updateTokensHandler(db, { userId: 'user-1', accessToken: 'new-access', tokenExpiresAt: 999 })
    expect(db._patches[0].data).not.toHaveProperty('linkedinRefreshToken')
    expect(db._patches[0].data).toEqual({ linkedinAccessToken: 'new-access', tokenExpiresAt: 999 })
  })

  it('never includes isAdmin or other identity fields in the patch', async () => {
    const db = createPatchDb()
    await updateTokensHandler(db, { userId: 'user-1', accessToken: 'a', tokenExpiresAt: 1 })
    expect(db._patches[0].data).not.toHaveProperty('isAdmin')
    expect(db._patches[0].data).not.toHaveProperty('name')
  })
})
