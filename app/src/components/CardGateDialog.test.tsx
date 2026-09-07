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

let mockMe: { subscriptionStatus: string }

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
  it('links the CTA to the plan the visitor chose and says what the trial costs', () => {
    renderDialog('?plan=pro')
    expect(screen.getByRole('link', { name: /start 7-day trial/i })).toHaveAttribute('href', '/billing?plan=pro')
    expect(
      screen.getByText(new RegExp(`free for 7 days or ${TRIAL_INTERACTION_THRESHOLD} interactions`, 'i'))
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
})
