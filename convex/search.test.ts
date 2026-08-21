import { describe, it, expect } from 'vitest'
import { toSearchPerson } from './search'

describe('toSearchPerson', () => {
  it('returns only safe display fields and strips secrets/internal fields', () => {
    const user = {
      _id: 'u1',
      _creationTime: 0,
      name: 'Mariana',
      headline: 'Designer',
      profilePictureUrl: 'https://x/y.jpg',
      linkedinPublicIdentifier: 'mariana',
      linkedinId: 'li1',
      linkedinAccessToken: 'secret',
      linkedinRefreshToken: 'secret2',
      email: 'mariana@example.com',
      isAdmin: true,
      isBanned: true,
      subscriptionStatus: 'active'
    } as never
    const safe = toSearchPerson(user) as Record<string, unknown>
    expect(safe).toEqual({
      _id: 'u1',
      name: 'Mariana',
      headline: 'Designer',
      profilePictureUrl: 'https://x/y.jpg',
      linkedinPublicIdentifier: 'mariana'
    })
    for (const k of [
      'linkedinAccessToken',
      'linkedinRefreshToken',
      'email',
      'isAdmin',
      'isBanned',
      'subscriptionStatus',
      'linkedinId'
    ]) {
      expect(k in safe).toBe(false)
    }
  })
})
