import { describe, it, expect } from 'vitest'
import { buildExportBundle } from './export'

const USER = {
  _id: 'u1',
  _creationTime: 1,
  linkedinId: 'li-1',
  name: 'Jane',
  email: 'jane@example.com',
  linkedinAccessToken: 'SECRET',
  linkedinRefreshToken: 'SECRET2',
  tokenExpiresAt: 999,
  createdAt: 1
}

describe('buildExportBundle', () => {
  it('includes profile but strips secret token fields', () => {
    const bundle = buildExportBundle({ user: USER, posts: [], subscriptions: [], consents: [], audits: [] })
    expect(bundle.profile.name).toBe('Jane')
    expect(bundle.profile.email).toBe('jane@example.com')
    expect('linkedinAccessToken' in bundle.profile).toBe(false)
    expect('linkedinRefreshToken' in bundle.profile).toBe(false)
    expect('tokenExpiresAt' in bundle.profile).toBe(false)
  })

  it('includes the user posts, subscriptions and consents verbatim', () => {
    const bundle = buildExportBundle({
      user: USER,
      posts: [{ _id: 'p1', content: 'hi' }],
      subscriptions: [{ _id: 's1', tier: 'pro' }],
      consents: [{ _id: 'c1', purpose: 'marketing', granted: true }],
      audits: []
    })
    expect(bundle.posts).toHaveLength(1)
    expect(bundle.subscriptions[0].tier).toBe('pro')
    expect(bundle.consents[0].purpose).toBe('marketing')
  })

  it('redacts other actors from audit entries (keeps action + own target)', () => {
    const bundle = buildExportBundle({
      user: USER,
      posts: [],
      subscriptions: [],
      consents: [],
      audits: [
        { _id: 'a1', action: 'consent.granted', actor: 'admin', actorId: 'admin99', targetUserId: 'u1', metadata: 'x' }
      ]
    })
    expect(bundle.auditLog[0].action).toBe('consent.granted')
    expect('actorId' in bundle.auditLog[0]).toBe(false)
    expect('actor' in bundle.auditLog[0]).toBe(false)
  })

  it('stamps an exportedAt and a format version', () => {
    const bundle = buildExportBundle({
      user: USER,
      posts: [],
      subscriptions: [],
      consents: [],
      audits: [],
      exportedAt: 42
    })
    expect(bundle.exportedAt).toBe(42)
    expect(bundle.formatVersion).toBe(1)
  })
})
