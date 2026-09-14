import { describe, it, expect } from 'vitest'
import { isTokenExpired, isExportExpired, isAuditExpired, isDormant, enforceDataRetention } from './retention'
import { internal } from '../_generated/api'

const NOW = 1_000_000_000_000
const DAY = 24 * 60 * 60 * 1000

type Row = Record<string, any>

function createRetentionCtx(seed: Record<string, Row[]>) {
  const tables: Record<string, Row[]> = JSON.parse(JSON.stringify(seed))
  const deleted: string[] = []
  const scheduled: Array<{ delay: number; ref: unknown; args: unknown }> = []
  const ctx = {
    db: {
      query: (table: string) => ({
        withIndex: (_index: string, range: (q: any) => unknown) => {
          const preds: Array<(row: Row) => boolean> = []
          const q: any = {
            eq: (field: string, value: unknown) => {
              preds.push(r => r[field] === value)
              return q
            },
            gte: (field: string, value: unknown) => {
              preds.push(r => typeof r[field] === 'number' && typeof value === 'number' && r[field] >= value)
              return q
            },
            lt: (field: string, value: unknown) => {
              preds.push(r => typeof r[field] === 'number' && typeof value === 'number' && r[field] < value)
              return q
            },
            lte: (field: string, value: unknown) => {
              preds.push(r => typeof r[field] === 'number' && typeof value === 'number' && r[field] <= value)
              return q
            }
          }
          range(q)
          return {
            take: async (n: number) => (tables[table] ?? []).filter(r => preds.every(p => p(r))).slice(0, n)
          }
        }
      }),
      delete: async (id: string) => {
        for (const t of Object.keys(tables)) {
          const i = tables[t].findIndex(r => r._id === id)
          if (i >= 0) {
            tables[t].splice(i, 1)
            break
          }
        }
        deleted.push(id)
      },
      patch: async () => undefined
    },
    storage: { delete: async () => undefined },
    scheduler: {
      runAfter: async (delay: number, ref: unknown, args: unknown) => {
        scheduled.push({ delay, ref, args })
      }
    }
  }
  return { ctx, deleted, scheduled }
}

const runRetention = (enforceDataRetention as unknown as { handler: (ctx: unknown) => Promise<void> }).handler

const notification = (id: string, createdAt: number) => ({
  _id: id,
  recipientId: 'u1',
  actorId: 'u2',
  postId: 'p1',
  kind: 'reaction',
  reaction: 'LIKE',
  createdAt
})

describe('retention predicates', () => {
  it('isTokenExpired: true only when a token exists and is past expiry', () => {
    expect(isTokenExpired({ linkedinAccessToken: 't', tokenExpiresAt: NOW - 1 }, NOW)).toBe(true)
    expect(isTokenExpired({ linkedinAccessToken: 't', tokenExpiresAt: NOW + DAY }, NOW)).toBe(false)
    expect(isTokenExpired({ tokenExpiresAt: NOW - 1 }, NOW)).toBe(false)
  })

  it('isExportExpired: true only for ready exports past expiresAt', () => {
    expect(isExportExpired({ status: 'ready', expiresAt: NOW - 1 }, NOW)).toBe(true)
    expect(isExportExpired({ status: 'ready', expiresAt: NOW + DAY }, NOW)).toBe(false)
    expect(isExportExpired({ status: 'pending', expiresAt: NOW - 1 }, NOW)).toBe(false)
  })

  it('isAuditExpired: true when older than the TTL', () => {
    expect(isAuditExpired({ createdAt: NOW - 100 }, NOW, 50)).toBe(true)
    expect(isAuditExpired({ createdAt: NOW - 10 }, NOW, 50)).toBe(false)
  })

  it('isDormant: inactive past threshold, no active/trialing sub, not already scheduled', () => {
    const base = { lastLoginAt: NOW - 1000, subscriptionStatus: 'canceled' as const }
    expect(isDormant(base, NOW, 500)).toBe(true)
    expect(isDormant({ ...base, subscriptionStatus: 'active' }, NOW, 500)).toBe(false)
    expect(isDormant({ ...base, subscriptionStatus: 'trialing' }, NOW, 500)).toBe(false)
    expect(isDormant({ ...base, deletionScheduledAt: 123 }, NOW, 500)).toBe(false)
    expect(isDormant({ subscriptionStatus: 'canceled' }, NOW, 500)).toBe(false)
    expect(isDormant({ ...base }, NOW, 5_000_000)).toBe(false)
  })
})

describe('enforceDataRetention', () => {
  it('deletes notifications older than 180 days and keeps fresh ones', async () => {
    const now = Date.now()
    const t = createRetentionCtx({
      notifications: [notification('n-old', now - 181 * DAY), notification('n-fresh', now - 179 * DAY)]
    })
    await runRetention(t.ctx)
    expect(t.deleted).toContain('n-old')
    expect(t.deleted).not.toContain('n-fresh')
  })

  it('reschedules an immediate pass when the notification batch fills', async () => {
    const now = Date.now()
    const t = createRetentionCtx({
      notifications: Array.from({ length: 100 }, (_, i) => notification(`n-${i}`, now - (181 + i) * DAY))
    })
    await runRetention(t.ctx)
    expect(t.deleted).toHaveLength(100)
    expect(t.scheduled).toHaveLength(1)
    expect(t.scheduled[0].ref).toBe(internal.privacy.retention.enforceDataRetention)
  })
})
