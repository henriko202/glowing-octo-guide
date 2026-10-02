import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import AuthErrorPage from './AuthErrorPage'

let mockSearchParams = new URLSearchParams()
const captureMessage = vi.hoisted(() => vi.fn())

vi.mock('@/lib/observability/sentry', () => ({ captureMessage }))

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useSearchParams: () => [mockSearchParams]
}))
vi.mock('../lib/session', () => ({ LANDING_URL: 'http://landing.test' }))

function renderAt(search: string) {
  mockSearchParams = new URLSearchParams(search)
  return render(<AuthErrorPage />)
}

describe('AuthErrorPage', () => {
  beforeEach(() => {
    captureMessage.mockClear()
  })

  it('tells a member who canceled on LinkedIn that nothing was shared, and reports nothing', () => {
    renderAt('?reason=denied')

    expect(screen.getByRole('heading', { name: 'auth.error.deniedTitle' })).toBeInTheDocument()
    expect(screen.getByText('auth.error.deniedBody')).toBeInTheDocument()
    expect(captureMessage).not.toHaveBeenCalled()
  })

  it('reports a failed sign-in once, named by its cause', () => {
    const { rerender } = renderAt('?reason=failed&cause=lost_cookie')
    rerender(<AuthErrorPage />)

    expect(captureMessage).toHaveBeenCalledTimes(1)
    expect(captureMessage).toHaveBeenCalledWith('Sign-in failed: lost_cookie', { 'signin.cause': 'lost_cookie' })
  })

  it('adds the code LinkedIn returned, and drops one that is not a plain token', () => {
    renderAt('?reason=failed&cause=linkedin_error&linkedin_error=unauthorized_scope_error')
    expect(captureMessage).toHaveBeenLastCalledWith('Sign-in failed: linkedin_error (unauthorized_scope_error)', {
      'signin.cause': 'linkedin_error',
      'signin.linkedin_error': 'unauthorized_scope_error'
    })

    renderAt('?reason=failed&cause=linkedin_error&linkedin_error=jane@example.com')
    expect(captureMessage).toHaveBeenLastCalledWith('Sign-in failed: linkedin_error', {
      'signin.cause': 'linkedin_error'
    })
  })

  // The cause is a URL parameter anyone can write: free text must not reach Sentry.
  it.each(['?reason=failed', '?reason=failed&cause=jane@example.com', '?cause=' + 'a'.repeat(33)])(
    'reports %j as an unknown cause',
    search => {
      renderAt(search)

      expect(captureMessage).toHaveBeenCalledWith('Sign-in failed: unknown', { 'signin.cause': 'unknown' })
    }
  )

  it.each(['?reason=failed', '?reason=something-else', ''])('shows the failed sign-in copy for %j', search => {
    renderAt(search)

    expect(screen.getByRole('heading', { name: 'auth.error.failedTitle' })).toBeInTheDocument()
    expect(screen.getByText('auth.error.failedBody')).toBeInTheDocument()
  })

  it('offers a fresh sign-in and a way back to the site', () => {
    renderAt('?reason=denied')

    expect(screen.getByRole('link', { name: 'auth.error.tryAgain' })).toHaveAttribute('href', '/auth/start')
    expect(screen.getByRole('link', { name: 'auth.error.backToSite' })).toHaveAttribute('href', 'http://landing.test')
  })
})
