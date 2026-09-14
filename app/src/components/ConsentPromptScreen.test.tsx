import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const completeFn = vi.fn(async () => {})
vi.mock('convex/react', () => ({ useMutation: () => completeFn }))
vi.mock('../convex', () => ({ api: { privacy: { consent: { completeConsentPrompt: 'ref' } } } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

import ConsentPromptScreen from './ConsentPromptScreen'

describe('ConsentPromptScreen', () => {
  beforeEach(() => {
    completeFn.mockClear()
    sessionStorage.setItem('sessionToken', 'tok')
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
    await waitFor(() =>
      expect(completeFn).toHaveBeenCalledWith({ sessionToken: 'tok', marketing: true, analytics: false })
    )
  })
})
