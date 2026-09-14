import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { SUPPORT_EMAIL } from '../lib/support'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

import UnsubscribedPage from './UnsubscribedPage'

function renderAt(search: string) {
  window.history.pushState({}, '', `/unsubscribed${search}`)
  return render(
    <MemoryRouter initialEntries={[`/unsubscribed${search}`]}>
      <UnsubscribedPage />
    </MemoryRouter>
  )
}

describe('UnsubscribedPage', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/unsubscribed')
  })

  it('confirms the unsubscribe and offers to start receiving again', () => {
    renderAt('?status=ok')
    expect(screen.getByText('unsubscribed.ok')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'unsubscribed.reEnable' })).toHaveAttribute('href', '/settings')
  })

  it('renders the invalid state with the email preferences and support links', () => {
    renderAt('?status=invalid')
    expect(screen.getByText('unsubscribed.invalid')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'unsubscribed.privacyLink' })).toHaveAttribute('href', '/settings')
    expect(screen.getByRole('link', { name: SUPPORT_EMAIL })).toHaveAttribute('href', `mailto:${SUPPORT_EMAIL}`)
  })

  it('renders the unavailable state', () => {
    renderAt('?status=unavailable')
    expect(screen.getByText('unsubscribed.unavailable')).toBeInTheDocument()
  })

  it('treats a missing status as invalid', () => {
    renderAt('')
    expect(screen.getByText('unsubscribed.invalid')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'unsubscribed.privacyLink' })).toBeInTheDocument()
  })

  it('never echoes an unknown status', () => {
    renderAt('?status=<script>alert(1)</script>')
    expect(screen.getByText('unsubscribed.invalid')).toBeInTheDocument()
  })
})
