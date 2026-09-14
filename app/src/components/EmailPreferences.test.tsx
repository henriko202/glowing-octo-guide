import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const setDigestEmailsEnabled = vi.fn(async () => {})
const setLeaderboardOptOut = vi.fn(async () => {})
let prefsVal: unknown = null

vi.mock('convex/react', () => ({
  useQuery: () => prefsVal,
  useMutation: (ref: string) => (ref === 'setDigestEmailsEnabled' ? setDigestEmailsEnabled : setLeaderboardOptOut)
}))
vi.mock('../convex', () => ({
  api: {
    users: {
      getEmailPreferences: 'getEmailPreferences',
      setDigestEmailsEnabled: 'setDigestEmailsEnabled',
      setLeaderboardOptOut: 'setLeaderboardOptOut'
    }
  }
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

import EmailPreferences from './EmailPreferences'

function renderComponent() {
  return render(
    <MemoryRouter>
      <EmailPreferences />
    </MemoryRouter>
  )
}

describe('EmailPreferences', () => {
  beforeEach(() => {
    setDigestEmailsEnabled.mockClear()
    setLeaderboardOptOut.mockClear()
    prefsVal = { digestEmailsEnabled: true, leaderboardOptOut: false }
    sessionStorage.setItem('sessionToken', 'tok')
  })

  it('reflects the server values in both checkboxes', () => {
    renderComponent()
    expect((screen.getByLabelText('settings.emails.digest') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('settings.emails.rankings') as HTMLInputElement).checked).toBe(true)
  })

  it('reflects stored opt-outs', () => {
    prefsVal = { digestEmailsEnabled: false, leaderboardOptOut: true }
    renderComponent()
    expect((screen.getByLabelText('settings.emails.digest') as HTMLInputElement).checked).toBe(false)
    expect((screen.getByLabelText('settings.emails.rankings') as HTMLInputElement).checked).toBe(false)
  })

  it('saves the digest toggle immediately with the inverted value', async () => {
    renderComponent()
    fireEvent.click(screen.getByLabelText('settings.emails.digest'))
    await waitFor(() => expect(setDigestEmailsEnabled).toHaveBeenCalledWith({ sessionToken: 'tok', enabled: false }))
  })

  it('saves the rankings toggle with the inverted opt-out', async () => {
    renderComponent()
    fireEvent.click(screen.getByLabelText('settings.emails.rankings'))
    await waitFor(() => expect(setLeaderboardOptOut).toHaveBeenCalledWith({ sessionToken: 'tok', optOut: true }))
  })

  it('links to the communication consents', () => {
    renderComponent()
    expect(screen.getByRole('link', { name: 'settings.emails.consentsLink' })).toHaveAttribute('href', '/privacy-data')
  })

  it('shows an inline error when a save fails', async () => {
    setDigestEmailsEnabled.mockRejectedValueOnce(new Error('nope'))
    renderComponent()
    fireEvent.click(screen.getByLabelText('settings.emails.digest'))
    expect(await screen.findByText('settings.emails.saveFailed')).toBeInTheDocument()
  })

  it('keeps the other toggle enabled and unerrored when one save fails, reverting the failed box', async () => {
    setDigestEmailsEnabled.mockRejectedValueOnce(new Error('nope'))
    renderComponent()
    const digest = screen.getByLabelText('settings.emails.digest') as HTMLInputElement
    const rankings = screen.getByLabelText('settings.emails.rankings') as HTMLInputElement
    fireEvent.click(digest)
    expect(await screen.findByText('settings.emails.saveFailed')).toBeInTheDocument()
    expect(screen.getAllByText('settings.emails.saveFailed')).toHaveLength(1)
    expect(digest.checked).toBe(true)
    expect(digest).not.toBeDisabled()
    expect(rankings).not.toBeDisabled()
  })

  it('keeps the optimistic checked state while a slow save is in flight', async () => {
    let resolveSave: () => void = () => {}
    setDigestEmailsEnabled.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          resolveSave = resolve
        })
    )
    renderComponent()
    const digest = screen.getByLabelText('settings.emails.digest') as HTMLInputElement
    expect(digest.checked).toBe(true)
    fireEvent.click(digest)
    expect(digest.checked).toBe(false)
    expect(digest).toBeDisabled()
    resolveSave()
    await waitFor(() => expect(digest).not.toBeDisabled())
  })
})
