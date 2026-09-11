import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shouldShowReconnect } from './ReconnectBanner'

const DAY_MS = 24 * 60 * 60 * 1000

let currentMe: { tokenExpiresAt?: number } | null = null

vi.mock('convex/react', () => ({ useQuery: () => currentMe }))
vi.mock('../convex', () => ({ api: { users: { getMe: 'ref' } } }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: { count?: number }) => (o?.count !== undefined ? `${k}:${o.count}` : k)
  })
}))

import ReconnectBanner from './ReconnectBanner'

describe('shouldShowReconnect (pure predicate)', () => {
  const now = 1_000_000_000_000

  it('hides when signed out (no me)', () => {
    expect(shouldShowReconnect(null, now)).toBeNull()
    expect(shouldShowReconnect(undefined, now)).toBeNull()
  })

  it('shows "expired" when tokenExpiresAt is undefined', () => {
    expect(shouldShowReconnect({ tokenExpiresAt: undefined }, now)).toEqual({ variant: 'expired' })
  })

  it('shows "expired" when tokenExpiresAt is null', () => {
    expect(shouldShowReconnect({ tokenExpiresAt: null }, now)).toEqual({ variant: 'expired' })
  })

  it('shows "expiring" with a day count 3 days out', () => {
    expect(shouldShowReconnect({ tokenExpiresAt: now + 3 * DAY_MS }, now)).toEqual({
      variant: 'expiring',
      days: 3
    })
  })

  it('shows "expired" (not "expiring") when already past expiry', () => {
    expect(shouldShowReconnect({ tokenExpiresAt: now - DAY_MS }, now)).toEqual({ variant: 'expired' })
  })

  it('shows "expired" at the exact boundary (tokenExpiresAt === now)', () => {
    expect(shouldShowReconnect({ tokenExpiresAt: now }, now)).toEqual({ variant: 'expired' })
  })

  it('hides exactly at the 7-day boundary and beyond', () => {
    expect(shouldShowReconnect({ tokenExpiresAt: now + 7 * DAY_MS }, now)).toBeNull()
    expect(shouldShowReconnect({ tokenExpiresAt: now + 30 * DAY_MS }, now)).toBeNull()
  })
})

describe('ReconnectBanner (render)', () => {
  beforeEach(() => {
    currentMe = null
  })

  it('renders nothing when the token is far from expiry', () => {
    currentMe = { tokenExpiresAt: Date.now() + 30 * DAY_MS }
    const { container } = render(<ReconnectBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the expired variant when tokenExpiresAt is missing', () => {
    currentMe = {}
    render(<ReconnectBanner />)
    expect(screen.getByText('reconnectBanner.expiredMessage')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'reconnectBanner.reconnect' })).toBeInTheDocument()
  })

  it('renders the expiring variant with a day count', () => {
    currentMe = { tokenExpiresAt: Date.now() + 3 * DAY_MS }
    render(<ReconnectBanner />)
    expect(screen.getByText('reconnectBanner.expiringMessage:3')).toBeInTheDocument()
  })

  it('renders the urgent expired copy (not "0 days") for a token already past expiry', () => {
    currentMe = { tokenExpiresAt: Date.now() - DAY_MS }
    render(<ReconnectBanner />)
    expect(screen.getByText('reconnectBanner.expiredMessage')).toBeInTheDocument()
    expect(screen.queryByText(/expiringMessage/)).not.toBeInTheDocument()
  })

  it('clicking Reconnect redirects to the app login-start route', () => {
    currentMe = {}
    const originalLocation = window.location
    const assign = vi.fn()
    // jsdom's window.location isn't directly assignable; swap it for a spyable stand-in.
    Object.defineProperty(window, 'location', {
      value: { assign },
      writable: true,
      configurable: true
    })
    render(<ReconnectBanner />)
    fireEvent.click(screen.getByRole('button', { name: 'reconnectBanner.reconnect' }))
    expect(assign).toHaveBeenCalledWith('/auth/start')
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true })
  })
})
