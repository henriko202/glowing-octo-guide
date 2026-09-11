// app/src/pages/AuthSuccessPage.test.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { clearSignedOut } from '../lib/session'
import AuthSuccessPage from './AuthSuccessPage'

const navigate = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate
}))

vi.mock('../lib/session', () => ({
  clearSignedOut: vi.fn()
}))

describe('AuthSuccessPage', () => {
  beforeEach(() => {
    sessionStorage.clear()
    navigate.mockClear()
    vi.mocked(clearSignedOut).mockClear()
  })

  it('navigates to the feed', () => {
    render(<AuthSuccessPage />)
    expect(navigate).toHaveBeenCalledWith('/feed', { replace: true })
  })

  it('clears the signed-out marker when the inline script captured a session token', () => {
    sessionStorage.setItem('sessionToken', 'tok-1')
    render(<AuthSuccessPage />)
    expect(clearSignedOut).toHaveBeenCalledTimes(1)
  })

  it('leaves the signed-out marker intact when opened directly without a token', () => {
    render(<AuthSuccessPage />)
    expect(clearSignedOut).not.toHaveBeenCalled()
  })
})
