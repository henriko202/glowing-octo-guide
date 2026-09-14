import { describe, expect, it } from 'vitest'
import { signUnsubscribeToken, verifyUnsubscribeToken } from './unsubscribeToken'

const SECRET = 'test-secret'

describe('unsubscribe tokens', () => {
  it('round-trips a user id', async () => {
    const token = await signUnsubscribeToken('user123', SECRET)
    expect(await verifyUnsubscribeToken(token, SECRET)).toBe('user123')
  })

  it('rejects a tampered token, a wrong secret and malformed input', async () => {
    const token = await signUnsubscribeToken('user123', SECRET)
    expect(await verifyUnsubscribeToken(`${token}x`, SECRET)).toBeNull()
    expect(await verifyUnsubscribeToken(token, 'other-secret')).toBeNull()
    expect(await verifyUnsubscribeToken('not-a-token', SECRET)).toBeNull()
    expect(await verifyUnsubscribeToken('', SECRET)).toBeNull()
  })

  it('is stable for the same input', async () => {
    expect(await signUnsubscribeToken('user123', SECRET)).toBe(await signUnsubscribeToken('user123', SECRET))
  })
})
