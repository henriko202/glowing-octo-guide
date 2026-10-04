import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuery } from 'convex/react'
import { captureEvent } from '@/lib/observability/analytics'
import { TRIAL_INTERACTION_THRESHOLD } from '../../../convex/lib/trialMilestone'
import CardGateDialog from './CardGateDialog'

// useCardGate() reads getMe through useQuery — no <ConvexProvider> here, so route it to a plain object.
vi.mock('convex/react', () => ({ useQuery: vi.fn() }))
vi.mock('../convex', () => ({ api: { users: { getMe: 'users.getMe' } } }))
vi.mock('@/lib/observability/analytics', () => ({ captureEvent: vi.fn() }))

let mockMe: { subscriptionStatus: string; trialDays?: number; trialEligible?: boolean }

function renderDialog(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/feed${search}`]}>
      <CardGateDialog
        open
        onOpenChange={() => {}}
        source="react"
      />
    </MemoryRouter>
  )
}

beforeEach(() => {
  sessionStorage.setItem('sessionToken', 'tok')
  mockMe = { subscriptionStatus: 'none' }
  vi.mocked(useQuery).mockImplementation(() => mockMe as never)
  vi.mocked(captureEvent).mockClear()
})

describe('CardGateDialog', () => {
  it('fires card_gate_opened once, tagged with the tap that opened it', () => {
    renderDialog()
    expect(captureEvent).toHaveBeenCalledTimes(1)
    expect(captureEvent).toHaveBeenCalledWith('card_gate_opened', { source: 'react' })
  })

  // R04: the line under the CTA says what it costs — a trial ask with no price line reads as a
  // hidden charge. The threshold comes from the same constant the backend milestone uses, never a
  // number typed into the copy.
  // 2026-10-03 — only Pro has a trial, so the trial ask always lands on Pro, whatever plan was chosen.
  it('links the CTA to the Pro trial and says what the trial costs', () => {
    renderDialog('?plan=growth')
    expect(screen.getByRole('link', { name: /try pro free/i })).toHaveAttribute('href', '/billing?plan=pro')
    expect(
      screen.getByText(new RegExp(`free for 7 days or your first ${TRIAL_INTERACTION_THRESHOLD} interactions`, 'i'))
    ).toBeInTheDocument()
  })

  // F5: a past_due member already had a trial and already has a card — they fix a payment, they
  // don't start anything, so neither the trial CTA nor its cost line applies.
  it('asks a past_due member to update payment, with no trial cost line', () => {
    mockMe = { subscriptionStatus: 'past_due' }
    renderDialog()
    expect(screen.getByRole('link', { name: /update payment method/i })).toBeInTheDocument()
    expect(screen.queryByText(/cancel anytime/i)).not.toBeInTheDocument()
  })

  // backlog/R19 — an invited member's gate names the trial they actually get (14 days), not the default.
  it('names the invited 14-day trial when the member joined through an invite', () => {
    mockMe = { subscriptionStatus: 'none', trialDays: 14 }
    renderDialog('?plan=pro')
    expect(screen.getByRole('link', { name: /try pro free/i })).toBeInTheDocument()
    expect(
      screen.getByText(new RegExp(`free for 14 days or your first ${TRIAL_INTERACTION_THRESHOLD} interactions`, 'i'))
    ).toBeInTheDocument()
  })

  // A member on 'none' who already holds subscription rows (Stripe incomplete/paused, or an admin
  // status reset) is gated but gets NO trial at checkout: `getMe.trialEligible` is the row-count
  // truth, `subscriptionStatus` is not. All three promises have to go — the cost line included,
  // because that one is the disclosure they are billed against the moment they click.
  it('drops every trial promise when the member has no trial left', () => {
    mockMe = { subscriptionStatus: 'none', trialEligible: false }
    renderDialog('?plan=pro')
    expect(screen.getByRole('link', { name: /subscribe to pro/i })).toHaveAttribute('href', '/billing?plan=pro')
    expect(screen.getByText(/already used your free trial/i)).toBeInTheDocument()
    // M6: the gate names the amount itself, both intervals, so the member never learns the price
    // one page after being asked to subscribe.
    expect(screen.getByText(/the pro plan is US\$30\/mo or US\$300\/yr/i)).toBeInTheDocument()
    expect(screen.queryByText(/free for/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/starting your trial/i)).not.toBeInTheDocument()
  })
})
