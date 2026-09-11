import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StrictMode } from 'react'
import { render, waitFor } from '@testing-library/react'
import AuthStartPage from './AuthStartPage'

const beginOAuthLogin = vi.hoisted(() => vi.fn(async () => {}))
const params = vi.hoisted(() => ({ value: new URLSearchParams() }))

vi.mock('../lib/oauthStart', () => ({ beginOAuthLogin }))
vi.mock('react-router-dom', () => ({ useSearchParams: () => [params.value] }))

describe('AuthStartPage', () => {
  beforeEach(() => {
    beginOAuthLogin.mockClear()
    params.value = new URLSearchParams()
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
