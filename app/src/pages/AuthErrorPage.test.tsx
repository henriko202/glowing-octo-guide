import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import AuthErrorPage from './AuthErrorPage'

let mockSearchParams = new URLSearchParams()

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
  it('tells a member who canceled on LinkedIn that nothing was shared', () => {
    renderAt('?reason=denied')

    expect(screen.getByRole('heading', { name: 'auth.error.deniedTitle' })).toBeInTheDocument()
    expect(screen.getByText('auth.error.deniedBody')).toBeInTheDocument()
  })

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
