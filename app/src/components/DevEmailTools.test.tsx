import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const meVal = { _id: 'u1', name: 'Dev Tester', email: 'member@example.com' }
const sendTestEmail = vi.fn(async () => ({ status: 'sent' }))
const getUnsubscribeLink = vi.fn(async () => ({ url: 'https://app.example/unsubscribe?token=abc' }))
const writeText = vi.fn(async () => {})

vi.mock('convex/react', () => ({
  useQuery: () => meVal,
  useAction: (ref: string) => (ref === 'sendTestEmail' ? sendTestEmail : getUnsubscribeLink)
}))
vi.mock('../convex', () => ({
  api: {
    users: { getMe: 'getMe' },
    dev: { sendTestEmail: 'sendTestEmail', getUnsubscribeLink: 'getUnsubscribeLink' }
  }
}))

import DevEmailTools from './DevEmailTools'

function openPanel() {
  render(<DevEmailTools />)
  fireEvent.click(screen.getByRole('button', { name: 'DEV · Emails' }))
}

describe('DevEmailTools', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', true)
    sendTestEmail.mockClear()
    getUnsubscribeLink.mockClear()
    writeText.mockClear()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    sessionStorage.setItem('sessionToken', 'tok')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    sessionStorage.clear()
  })

  it('opens the panel with the member email as the To placeholder', () => {
    openPanel()
    expect(screen.getByRole('button', { name: 'Digest (real)' })).toBeInTheDocument()
    expect(screen.getByLabelText('To')).toHaveAttribute('placeholder', 'member@example.com')
    expect(screen.getByRole('button', { name: 'Copy unsubscribe link' })).toBeInTheDocument()
  })

  it('truncates a long member email so it cannot push the close button out of the clipping panel', () => {
    const original = meVal.email
    meVal.email = 'a-very-long-member-address-that-would-overflow-the-panel@example.com'
    try {
      openPanel()
      const emailLine = screen.getByText(/^To: /)
      expect(emailLine).toHaveClass('truncate')
      expect(emailLine.parentElement).toHaveClass('min-w-0')
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    } finally {
      meVal.email = original
    }
  })

  it('sends the clicked kind with the session token and the optional recipient override', async () => {
    openPanel()
    fireEvent.change(screen.getByLabelText('To'), { target: { value: 'override@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Digest (sample)' }))
    await waitFor(() =>
      expect(sendTestEmail).toHaveBeenCalledWith({
        sessionToken: 'tok',
        kind: 'digest_sample',
        to: 'override@example.com'
      })
    )
    expect(await screen.findByText('[digest_sample] sent')).toBeInTheDocument()
  })

  it('copies the unsubscribe link and shows the copied state', async () => {
    openPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Copy unsubscribe link' }))
    await waitFor(() => expect(getUnsubscribeLink).toHaveBeenCalledWith({ sessionToken: 'tok' }))
    expect(writeText).toHaveBeenCalledWith('https://app.example/unsubscribe?token=abc')
    expect(await screen.findByText('Copied')).toBeInTheDocument()
  })
})
