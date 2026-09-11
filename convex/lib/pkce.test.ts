import { describe, expect, it } from 'vitest'
import { isPkceChallenge, isPkceVerifier, pkceChallengeFromVerifier } from './pkce'

// RFC 7636 Appendix B.
const RFC_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
const RFC_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'

// The app's generator: 32 random bytes, base64url without padding → 43 chars.
function randomVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

describe('pkce shape guards', () => {
  it('accepts a 43-char base64url value', () => {
    expect(isPkceVerifier(RFC_VERIFIER)).toBe(true)
    expect(isPkceChallenge(RFC_CHALLENGE)).toBe(true)
    expect(isPkceVerifier('A'.repeat(43))).toBe(true)
    expect(isPkceVerifier('-_'.repeat(21) + '-')).toBe(true)
  })

  it('rejects the wrong length', () => {
    expect(isPkceVerifier(RFC_VERIFIER.slice(1))).toBe(false) // 42
    expect(isPkceVerifier(`${RFC_VERIFIER}A`)).toBe(false) // 44
    expect(isPkceVerifier('')).toBe(false)
  })

  it('rejects characters outside the base64url alphabet', () => {
    expect(isPkceVerifier(`+${RFC_VERIFIER.slice(1)}`)).toBe(false)
    expect(isPkceVerifier(`/${RFC_VERIFIER.slice(1)}`)).toBe(false)
    expect(isPkceVerifier(`=${RFC_VERIFIER.slice(1)}`)).toBe(false)
    expect(isPkceChallenge(`${RFC_CHALLENGE.slice(0, 42)} `)).toBe(false)
  })
})

describe('pkceChallengeFromVerifier', () => {
  it('matches the RFC 7636 Appendix B vector', async () => {
    await expect(pkceChallengeFromVerifier(RFC_VERIFIER)).resolves.toBe(RFC_CHALLENGE)
  })

  it('round-trips a verifier generated like the app’s and is deterministic', async () => {
    const verifier = randomVerifier()
    expect(isPkceVerifier(verifier)).toBe(true)

    const challenge = await pkceChallengeFromVerifier(verifier)
    expect(isPkceChallenge(challenge)).toBe(true)
    await expect(pkceChallengeFromVerifier(verifier)).resolves.toBe(challenge)

    const otherChallenge = await pkceChallengeFromVerifier(randomVerifier())
    expect(otherChallenge).not.toBe(challenge)
  })
})
