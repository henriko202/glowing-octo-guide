import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

let activeMotd: { _id: string; bodies: Record<string, string>; important: boolean } | null = null
let currentLang = 'en'

vi.mock('convex/react', () => ({ useQuery: () => activeMotd }))
vi.mock('../convex', () => ({ api: { motd: { motd: { getActiveMotd: 'ref' } } } }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: currentLang } })
}))

import Motd from './Motd'

describe('Motd', () => {
  beforeEach(() => {
    sessionStorage.clear()
    sessionStorage.setItem('sessionToken', 'tok1')
    activeMotd = null
    currentLang = 'en'
  })

  it('renders nothing when there is no active MOTD', () => {
    activeMotd = null
    const { container } = render(<Motd />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a banner (not a modal) for a non-important MOTD', () => {
    activeMotd = { _id: 'm1', bodies: { en: 'Hello **world**' }, important: false }
    render(<Motd />)
    expect(screen.getByText('world')).toBeInTheDocument()
    expect(screen.queryByTestId('modal-backdrop')).not.toBeInTheDocument()
  })

  it('hides after dismiss and records the dismissal in sessionStorage', () => {
    activeMotd = { _id: 'm1', bodies: { en: 'Hi there' }, important: false }
    render(<Motd />)
    fireEvent.click(screen.getByRole('button', { name: 'motd.dismiss' }))
    expect(screen.queryByText('Hi there')).not.toBeInTheDocument()
    expect(JSON.parse(sessionStorage.getItem('motdDismissed')!)).toEqual({ token: 'tok1', motdId: 'm1' })
  })

  it('re-shows after a re-login (the session token changed)', () => {
    sessionStorage.setItem('motdDismissed', JSON.stringify({ token: 'tok1', motdId: 'm1' }))
    sessionStorage.setItem('sessionToken', 'tok2') // fresh token from a new login
    activeMotd = { _id: 'm1', bodies: { en: 'Hi there' }, important: false }
    render(<Motd />)
    expect(screen.getByText('Hi there')).toBeInTheDocument()
  })

  it('re-shows when a different MOTD becomes active in the same session', () => {
    sessionStorage.setItem('motdDismissed', JSON.stringify({ token: 'tok1', motdId: 'm1' }))
    activeMotd = { _id: 'm2', bodies: { en: 'A new message' }, important: false }
    render(<Motd />)
    expect(screen.getByText('A new message')).toBeInTheDocument()
  })

  it('renders a blocking modal with an OK button for an important MOTD', () => {
    activeMotd = { _id: 'm1', bodies: { en: 'Important notice' }, important: true }
    render(<Motd />)
    expect(screen.getByTestId('modal-backdrop')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'motd.ok' })).toBeInTheDocument()
  })

  it('falls back to English when the active language has no body', () => {
    currentLang = 'pt'
    activeMotd = { _id: 'm1', bodies: { en: 'English body' }, important: false }
    render(<Motd />)
    expect(screen.getByText('English body')).toBeInTheDocument()
  })

  it('shows the active-language body when present', () => {
    currentLang = 'pt'
    activeMotd = { _id: 'm1', bodies: { en: 'English', pt: 'Portugues' }, important: false }
    render(<Motd />)
    expect(screen.getByText('Portugues')).toBeInTheDocument()
  })

  it('important MOTD modal is dismissible only via the OK button, not backdrop or Escape', () => {
    activeMotd = { _id: 'm2', bodies: { en: 'Critical notice' }, important: true }
    render(<Motd />)

    // Body text is visible
    expect(screen.getByText('Critical notice')).toBeInTheDocument()

    // Clicking the backdrop must NOT dismiss
    fireEvent.click(screen.getByTestId('modal-backdrop'))
    expect(screen.getByText('Critical notice')).toBeInTheDocument()

    // Pressing Escape must NOT dismiss
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByText('Critical notice')).toBeInTheDocument()

    // Clicking OK must dismiss and record in sessionStorage
    fireEvent.click(screen.getByRole('button', { name: 'motd.ok' }))
    expect(screen.queryByText('Critical notice')).not.toBeInTheDocument()
    expect(JSON.parse(sessionStorage.getItem('motdDismissed')!)).toEqual({ token: 'tok1', motdId: 'm2' })
  })
})
