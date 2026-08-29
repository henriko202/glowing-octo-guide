import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import BannedScreen from './BannedScreen'
import { SUPPORT_EMAIL } from '../lib/support'

describe('BannedScreen', () => {
  it('shows the suspension heading and a support mailto link', () => {
    render(<BannedScreen />)
    expect(screen.getByText(/account has been suspended/i)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /contact support/i })
    expect(link).toHaveAttribute('href', `mailto:${SUPPORT_EMAIL}`)
  })

  it('shows the reason block when a reason is provided', () => {
    render(<BannedScreen reason="Repeated TOS violations" />)
    expect(screen.getByText('Repeated TOS violations')).toBeInTheDocument()
  })

  it('omits the reason block when no reason is given', () => {
    render(<BannedScreen />)
    expect(screen.queryByText(/^reason$/i)).not.toBeInTheDocument()
  })

  it('clears the session token on sign out', () => {
    const remove = vi.spyOn(Storage.prototype, 'removeItem')
    ;(window as any).location = { assign: vi.fn(), href: '/', origin: window.location.origin }
    render(<BannedScreen />)
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    expect(remove).toHaveBeenCalledWith('sessionToken')
    remove.mockRestore()
  })
})
