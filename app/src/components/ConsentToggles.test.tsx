import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const recordConsent = vi.fn(async () => {})
let consentsVal: unknown = null

vi.mock('convex/react', () => ({
  useQuery: () => consentsVal,
  useMutation: () => recordConsent
}))
vi.mock('../convex', () => ({
  api: { privacy: { consent: { getConsents: 'getConsents', recordConsent: 'recordConsent' } } }
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

import ConsentToggles from './ConsentToggles'

describe('ConsentToggles', () => {
  beforeEach(() => {
    recordConsent.mockClear()
    consentsVal = null
    sessionStorage.setItem('sessionToken', 'tok')
  })

  it('renders marketing + analytics toggles, off by default (no records)', () => {
    render(<ConsentToggles />)
    expect((screen.getByLabelText('privacy.consent.marketing') as HTMLInputElement).checked).toBe(false)
    expect((screen.getByLabelText('privacy.consent.analytics') as HTMLInputElement).checked).toBe(false)
  })

  it('reflects stored consent', () => {
    consentsVal = { marketing: true, analytics: false }
    render(<ConsentToggles />)
    expect((screen.getByLabelText('privacy.consent.marketing') as HTMLInputElement).checked).toBe(true)
  })

  it('records consent when a toggle is flipped on', async () => {
    render(<ConsentToggles />)
    fireEvent.click(screen.getByLabelText('privacy.consent.marketing'))
    await waitFor(() =>
      expect(recordConsent).toHaveBeenCalledWith({ sessionToken: 'tok', purpose: 'marketing', granted: true })
    )
  })
})
