// app/src/pages/AuthSuccessPage.test.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  clearSignedOut: vi.fn()
}))

vi.mock('../lib/oauthStart', () => ({ OAUTH_VERIFIER_KEY: 'oauthVerifier' }))

const ERROR_PAGE = '/auth/error?reason=failed'

describe('AuthSuccessPage', () => {
  beforeEach(() => {
    sessionStorage.clear()
    navigate.mockClear()
    redeem.mockReset()
    vi.mocked(clearSignedOut).mockClear()
  })

  it('keeps the session and clears signedOut when a signed-in tab has nothing to redeem', async () => {
    sessionStorage.setItem('sessionToken', 'tok-1')
    render(<AuthSuccessPage />)
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/feed', { replace: true }))
    expect(clearSignedOut).toHaveBeenCalledTimes(1)
    expect(redeem).not.toHaveBeenCalled()
  })

  // A member who clicks sign-in on the landing while signed in: the fresh code is redeemed, so the funnel counts it.
  it('redeems a fresh code even when the tab already holds a session', async () => {
    sessionStorage.setItem('sessionToken', 'tok-old')
    sessionStorage.setItem('oauthCode', 'code-1')
    sessionStorage.setItem('oauthVerifier', 'verifier-1')
    redeem.mockResolvedValue({ sessionToken: 'tok-new' })

    render(<AuthSuccessPage />)

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/feed', { replace: true }))
    expect(redeem).toHaveBeenCalledWith({ code: 'code-1', verifier: 'verifier-1' })
    expect(sessionStorage.getItem('sessionToken')).toBe('tok-new')
  })

  it('keeps the session it already had instead of the error page when the redeem fails', async () => {
    sessionStorage.setItem('sessionToken', 'tok-old')
    sessionStorage.setItem('oauthCode', 'code-1')
    sessionStorage.setItem('oauthVerifier', 'verifier-1')
    redeem.mockRejectedValue(new Error('mismatch'))

    render(<AuthSuccessPage />)

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/feed', { replace: true }))
    expect(redeem).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem('sessionToken')).toBe('tok-old')
    expect(sessionStorage.getItem('oauthCode')).toBeNull()
    expect(sessionStorage.getItem('oauthVerifier')).toBeNull()
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

  it('fails closed to the sign-in error page without redeeming when the verifier is missing', async () => {
    sessionStorage.setItem('oauthCode', 'handed-over-code')

    render(<AuthSuccessPage />)

    await waitFor(() => expect(navigate).toHaveBeenCalledWith(ERROR_PAGE, { replace: true }))
    expect(redeem).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('oauthCode')).toBeNull()
    expect(clearSignedOut).not.toHaveBeenCalled()
  })

  it('fails closed to the sign-in error page without redeeming when the code is missing', async () => {
    sessionStorage.setItem('oauthVerifier', 'verifier-1')

    render(<AuthSuccessPage />)

    await waitFor(() => expect(navigate).toHaveBeenCalledWith(ERROR_PAGE, { replace: true }))
    expect(redeem).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('oauthVerifier')).toBeNull()
  })

  it('drops the code/verifier and shows the sign-in error page when redeem fails', async () => {
    sessionStorage.setItem('oauthCode', 'code-1')
    sessionStorage.setItem('oauthVerifier', 'verifier-1')
    redeem.mockRejectedValue(new Error('mismatch'))

    render(<AuthSuccessPage />)

    await waitFor(() => expect(navigate).toHaveBeenCalledWith(ERROR_PAGE, { replace: true }))
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
