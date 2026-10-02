import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StrictMode } from 'react'
import { render, waitFor } from '@testing-library/react'
import AuthStartPage from './AuthStartPage'

const beginOAuthLogin = vi.hoisted(() => vi.fn(async () => {}))
const params = vi.hoisted(() => ({ value: new URLSearchParams() }))
const navigate = vi.hoisted(() => vi.fn())
const captureException = vi.hoisted(() => vi.fn())

vi.mock('../lib/oauthStart', () => ({ beginOAuthLogin }))
vi.mock('../lib/observability/sentry', () => ({ captureException }))
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate, useSearchParams: () => [params.value] }))

describe('AuthStartPage', () => {
  beforeEach(() => {
    beginOAuthLogin.mockReset()
    beginOAuthLogin.mockResolvedValue(undefined)
    navigate.mockClear()
    captureException.mockClear()
    params.value = new URLSearchParams()
  })

  it('reports a login the browser could not start and shows the error page instead of a spinner', async () => {
    const failure = new TypeError("Cannot read properties of undefined (reading 'digest')")
    beginOAuthLogin.mockRejectedValue(failure)

    render(<AuthStartPage />)

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/auth/error?reason=failed&cause=start_failed', { replace: true })
    )
    expect(captureException).toHaveBeenCalledWith(failure)
  })

  it('starts OAuth with no params on a bare visit', async () => {
    render(<AuthStartPage />)
    await waitFor(() => expect(beginOAuthLogin).toHaveBeenCalledTimes(1))
    expect(beginOAuthLogin).toHaveBeenCalledWith({ plan: undefined, interval: undefined, ref: undefined })
  })

  it('forwards plan/interval/ref from the query string', async () => {
    params.value = new URLSearchParams('plan=growth&interval=annual&ref=k3p9x2ab')
    render(<AuthStartPage />)
    await waitFor(() => expect(beginOAuthLogin).toHaveBeenCalledTimes(1))
    expect(beginOAuthLogin).toHaveBeenCalledWith({ plan: 'growth', interval: 'annual', ref: 'k3p9x2ab' })
  })

  it('starts OAuth once even when the effect runs twice (StrictMode)', async () => {
    render(
      <StrictMode>
        <AuthStartPage />
      </StrictMode>
    )
    await waitFor(() => expect(beginOAuthLogin).toHaveBeenCalled())
    expect(beginOAuthLogin).toHaveBeenCalledTimes(1)
  })
})
