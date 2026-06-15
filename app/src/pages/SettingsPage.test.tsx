import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

const me = {
  _id: 'u1',
  linkedinId: 'li1',
  name: 'Henriko',
  industry: '41',
  country: 'BR',
  location: 'Curitiba, Paraná, Brazil',
  primaryLocale: 'en',
  linkedinPublicIdentifier: 'henriko202',
  tier: 'starter',
  subscriptionStatus: 'trialing',
  createdAt: 0
}

vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => me),
  useMutation: vi.fn(() => vi.fn())
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } })
}))

import SettingsPage from './SettingsPage'

describe('SettingsPage profile editing', () => {
  it('renders industry + country dropdowns', () => {
    render(<SettingsPage />)
    expect(screen.getByLabelText('settings.industry')).toBeInTheDocument()
    expect(screen.getByLabelText('settings.country')).toBeInTheDocument()
  })

  it('shows the scraped location when present', () => {
    render(<SettingsPage />)
    expect(screen.getByText('Curitiba, Paraná, Brazil')).toBeInTheDocument()
  })

  it('renders the Refresh from LinkedIn button', () => {
    render(<SettingsPage />)
    expect(screen.getByRole('button', { name: 'settings.refresh' })).toBeInTheDocument()
  })
})
