import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ConsentPromptScreen from './ConsentPromptScreen'

const completeFn = vi.fn(async () => {})
vi.mock('convex/react', () => ({ useMutation: () => completeFn }))
vi.mock('../convex', () => ({ api: { privacy: { consent: { completeConsentPrompt: 'ref' } } } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

describe('ConsentPromptScreen', () => {
  beforeEach(() => {
    completeFn.mockClear()
    sessionStorage.setItem('sessionToken', 'tok')
    // jsdom has no navigation; stub reload so the handler's refresh doesn't log "Not implemented".
    Object.defineProperty(window, 'location', { configurable: true, value: { reload: vi.fn() } })
  })

  it('renders the marketing + analytics toggles (off by default)', () => {
    render(<ConsentPromptScreen />)
    expect((screen.getByLabelText('privacy.consent.marketing') as HTMLInputElement).checked).toBe(false)
    expect((screen.getByLabelText('privacy.consent.analytics') as HTMLInputElement).checked).toBe(false)
  })

  it('renders the digest note pointing at Settings > Emails', () => {
    render(<ConsentPromptScreen />)
    expect(screen.getByText('privacy.consentPrompt.digestNote')).toBeInTheDocument()
  })

  it('records the chosen preferences on save', async () => {
    render(<ConsentPromptScreen />)
    fireEvent.click(screen.getByLabelText('privacy.consent.marketing'))
    fireEvent.click(screen.getByRole('button', { name: 'privacy.consentPrompt.save' }))
    await waitFor(() => expect(window.location.reload).toHaveBeenCalledOnce())
    expect(completeFn).toHaveBeenCalledWith({ sessionToken: 'tok', marketing: true, analytics: false })
  })
})
