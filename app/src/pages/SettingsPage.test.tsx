import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  contact: { interactionsPerPost: 200, postsPerWeek: 5, featuredPerMonth: 5 }
}

vi.mock('convex/react', () => ({
  useQuery: vi.fn((ref: unknown) => {
    const name = getFunctionName(ref as Parameters<typeof getFunctionName>[0])
    if (name === 'users:getMe') return me
    if (name === 'posts:getTierLimits') return tierLimits
    if (name === 'users:getSubscriptionInfo') return { priceInterval: 'year' }
    if (name === 'users:isProfileRefreshEnabled') return true
    if (name === 'users:getInviteSummary') return { inviteCode: 'abc12345', joined: 2 }
    return undefined
  }),
  useMutation: vi.fn(() => vi.fn())
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } })
}))
vi.mock('@/lib/observability/analytics', () => ({ captureEvent: vi.fn() }))

import { captureEvent } from '@/lib/observability/analytics'
import { Toaster } from '@/components/ui/toast'
import { LANDING_URL } from '../lib/session'
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

describe('SettingsPage invite (R19)', () => {
  it('shows the invite link built from the landing URL and the joined count', () => {
    renderPage()
    expect(screen.getByLabelText('settings.inviteLinkLabel')).toHaveValue(`${LANDING_URL}/en?ref=abc12345`)
    expect(screen.getByText('settings.inviteJoined')).toBeInTheDocument()
  })

  it('copies the link and records the event', async () => {
    const writeText = vi.fn(async () => {})
    Object.assign(navigator, { clipboard: { writeText } })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'settings.inviteCopy' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${LANDING_URL}/en?ref=abc12345`))
    expect(captureEvent).toHaveBeenCalledWith('invite_copied')
  })

  it('flips the copied label back to "Copy link" after the timeout', async () => {
    const writeText = vi.fn(async () => {})
    Object.assign(navigator, { clipboard: { writeText } })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'settings.inviteCopy' }))
    expect(await screen.findByRole('button', { name: 'settings.inviteCopied' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'settings.inviteCopy' })).toBeInTheDocument(), {
      timeout: 3000
    })
  })

  it('falls back to manual copy when the Clipboard API is unavailable', async () => {
    // No navigator.clipboard at all — LinkedIn's in-app webview and any non-secure context.
    Object.assign(navigator, { clipboard: undefined })
    render(
      <MemoryRouter>
        <SettingsPage />
        <Toaster />
      </MemoryRouter>
    )
    const input = screen.getByLabelText('settings.inviteLinkLabel') as HTMLInputElement
    const selectSpy = vi.spyOn(input, 'select')
    fireEvent.click(screen.getByRole('button', { name: 'settings.inviteCopy' }))
    expect(await screen.findByText('settings.inviteCopyManual')).toBeInTheDocument()
    expect(selectSpy).toHaveBeenCalled()
  })
})
