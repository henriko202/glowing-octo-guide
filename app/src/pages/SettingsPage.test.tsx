import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { getFunctionName } from 'convex/server'
import { MemoryRouter } from 'react-router-dom'

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

// getTierLimits/getSubscriptionInfo back UpgradeAtLimit, rendered in the non-Pro visibility
// section below (backlog/R08) — starter's tier here means that section always renders.
const tierLimits = {
  starter: { interactionsPerPost: 25, postsPerWeek: 1, featuredPerMonth: 0 },
  growth: { interactionsPerPost: 50, postsPerWeek: 2, featuredPerMonth: 1 },
  pro: { interactionsPerPost: 200, postsPerWeek: 5, featuredPerMonth: 3 },
  contact: { interactionsPerPost: 200, postsPerWeek: 5, featuredPerMonth: 9999 }
}

vi.mock('convex/react', () => ({
  useQuery: vi.fn((ref: unknown) => {
    const name = getFunctionName(ref as Parameters<typeof getFunctionName>[0])
    if (name === 'users:getMe') return me
    if (name === 'posts:getTierLimits') return tierLimits
    if (name === 'users:getSubscriptionInfo') return { priceInterval: 'year' }
    if (name === 'users:isProfileRefreshEnabled') return true
    return undefined
  }),
  useMutation: vi.fn(() => vi.fn())
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } })
}))

import SettingsPage from './SettingsPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>
  )
}

describe('SettingsPage profile editing', () => {
  it('renders industry + country dropdowns', () => {
    renderPage()
    expect(screen.getByLabelText('settings.industry')).toBeInTheDocument()
    expect(screen.getByLabelText('settings.country')).toBeInTheDocument()
  })

  it('shows the scraped location when present', () => {
    renderPage()
    expect(screen.getByText('Curitiba, Paraná, Brazil')).toBeInTheDocument()
  })

  it('renders the Refresh from LinkedIn button', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'settings.refresh' })).toBeInTheDocument()
  })
})
