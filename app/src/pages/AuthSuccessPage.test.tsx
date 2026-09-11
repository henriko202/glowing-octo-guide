// app/src/pages/AuthSuccessPage.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StrictMode } from 'react'
import { render, waitFor } from '@testing-library/react'
import { clearSignedOut } from '../lib/session'
import AuthSuccessPage from './AuthSuccessPage'

const navigate = vi.hoisted(() => vi.fn())
const redeem = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate
}))

vi.mock('../convex', () => ({ api: { sessions: { redeemAuthCode: 'redeem-ref' } } }))

vi.mock('convex/react', () => ({
  useMutation: () => redeem
}))

vi.mock('../lib/session', () => ({
  clearSignedOut: vi.fn(),
  LANDING_URL: 'http://landing.test'
}))

vi.mock('../lib/oauthStart', () => ({ OAUTH_VERIFIER_KEY: 'oauthVerifier' }))

const originalLocation = window.location

function stubLocation() {
  const replace = vi.fn()
  Object.defineProperty(window, 'location', { value: { replace }, writable: true, configurable: true })
  return replace
}

describe('AuthSuccessPage', () => {
  beforeEach(() => {
    sessionStorage.clear()
    navigate.mockClear()
    redeem.mockReset()
    vi.mocked(clearSignedOut).mockClear()
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true })
  })

  it('navigates to the feed and clears signedOut when a session token already exists', () => {
    sessionStorage.setItem('sessionToken', 'tok-1')
    render(<AuthSuccessPage />)
    expect(clearSignedOut).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('/feed', { replace: true })
    expect(redeem).not.toHaveBeenCalled()
  })

  it('redeems the code with the stored verifier and stores the returned token', async () => {
    sessionStorage.setItem('oauthCode', 'code-1')
    sessionStorage.setItem('oauthVerifier', 'verifier-1')
    redeem.mockResolvedValue({ sessionToken: 'tok-new' })

    render(<AuthSuccessPage />)

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/feed', { replace: true }))
    expect(redeem).toHaveBeenCalledWith({ code: 'code-1', verifier: 'verifier-1' })
    expect(sessionStorage.getItem('sessionToken')).toBe('tok-new')
    expect(sessionStorage.getItem('oauthCode')).toBeNull()
    expect(sessionStorage.getItem('oauthVerifier')).toBeNull()
    expect(clearSignedOut).toHaveBeenCalledTimes(1)
  })

  it('fails closed to the landing site without redeeming when the verifier is missing', async () => {
    sessionStorage.setItem('oauthCode', 'handed-over-code')
    const replace = stubLocation()

    render(<AuthSuccessPage />)

    await waitFor(() => expect(replace).toHaveBeenCalledWith('http://landing.test'))
    expect(redeem).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('oauthCode')).toBeNull()
    expect(clearSignedOut).not.toHaveBeenCalled()
  })

  it('fails closed to the landing site without redeeming when the code is missing', async () => {
    sessionStorage.setItem('oauthVerifier', 'verifier-1')
    const replace = stubLocation()

    render(<AuthSuccessPage />)

    await waitFor(() => expect(replace).toHaveBeenCalledWith('http://landing.test'))
    expect(redeem).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('oauthVerifier')).toBeNull()
  })

  it('drops the code/verifier and returns to the landing site when redeem fails', async () => {
    sessionStorage.setItem('oauthCode', 'code-1')
    sessionStorage.setItem('oauthVerifier', 'verifier-1')
    redeem.mockRejectedValue(new Error('mismatch'))
    const replace = stubLocation()

    render(<AuthSuccessPage />)

    await waitFor(() => expect(replace).toHaveBeenCalledWith('http://landing.test'))
    expect(sessionStorage.getItem('oauthCode')).toBeNull()
    expect(sessionStorage.getItem('oauthVerifier')).toBeNull()
    expect(sessionStorage.getItem('sessionToken')).toBeNull()
    expect(clearSignedOut).not.toHaveBeenCalled()
  })

  it('redeems once even when the effect runs twice (StrictMode)', async () => {
    sessionStorage.setItem('oauthCode', 'code-1')
    sessionStorage.setItem('oauthVerifier', 'verifier-1')
    redeem.mockResolvedValue({ sessionToken: 'tok-new' })

    render(
      <StrictMode>
        <AuthSuccessPage />
      </StrictMode>
    )

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/feed', { replace: true }))
    expect(redeem).toHaveBeenCalledTimes(1)
  })
})
