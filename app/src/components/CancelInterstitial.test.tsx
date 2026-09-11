import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { captureEvent } from '@/lib/observability/analytics'
import { toast } from '@/components/ui/toast'
import CancelInterstitial from './CancelInterstitial'

vi.mock('../convex', () => ({
  api: {
    interactions: { getRecap: 'interactions.getRecap' },
    posts: { getMyPosts: 'posts.getMyPosts' },
    billingNode: { createCancelFlowSession: 'billingNode.createCancelFlowSession' },
    feedback: { feedback: { submitFeedback: 'feedback.feedback.submitFeedback' } }
  }
}))

let mockQueryReturns: Record<string, unknown> = {}
let mockRecapError: Error | null = null
const mockCancelFlow = vi.fn(async () => ({ url: '' }) as { url: string | null })
const mockSubmitFeedback = vi.fn(async () => null)
vi.mock('convex/react', () => ({
  useQuery: vi.fn((ref: string) => mockQueryReturns[ref]),
  useAction: vi.fn(() => mockCancelFlow),
  useMutation: vi.fn(() => mockSubmitFeedback)
}))
vi.mock('@/lib/useQueryOnce', () => ({
  useQueryOnce: vi.fn((ref: string) => ({ data: mockQueryReturns[ref], error: mockRecapError }))
}))
vi.mock('@/lib/observability/analytics', () => ({ captureEvent: vi.fn() }))
vi.mock('@/components/ui/toast', () => ({ toast: vi.fn() }))

const RECAP = { received: { current: { total: 7 } } }
const POSTS = [{ _id: 'a' }, { _id: 'b', hidden: true }, { _id: 'c' }]

function renderIt(over: Partial<Parameters<typeof CancelInterstitial>[0]> = {}) {
  return render(
    <CancelInterstitial
      open
      tier="growth"
      isTrialing={false}
      periodEndDate="10/1/2026"
      starterPrice="US$10/mo"
      starterInteractions={25}
      starterPosts={1}
      onOpenChange={vi.fn()}
      {...over}
    />
  )
}

beforeEach(() => {
  sessionStorage.setItem('sessionToken', 'tok')
  mockRecapError = null
  vi.mocked(captureEvent).mockClear()
  vi.mocked(toast).mockClear()
  mockCancelFlow.mockClear()
  mockSubmitFeedback.mockClear()
  mockQueryReturns = { 'interactions.getRecap': RECAP, 'posts.getMyPosts': POSTS }
})

describe('CancelInterstitial', () => {
  it('states what a paying member loses, with the live post count and 30-day received total', () => {
    renderIt()
    expect(
      screen.getByText(
        'Your 2 posts leave the feed on 10/1/2026. In the last 30 days they received 7 reactions and comments.'
      )
    ).toBeInTheDocument()
    expect(captureEvent).toHaveBeenCalledTimes(1)
    expect(captureEvent).toHaveBeenCalledWith('cancel_started', { plan: 'growth', trial: false })
  })

  it('does not re-fire cancel_started when a live prop changes while the dialog stays open', () => {
    const { rerender } = renderIt()
    expect(captureEvent).toHaveBeenCalledTimes(1)
    rerender(
      <CancelInterstitial
        open
        tier="pro"
        isTrialing={false}
        periodEndDate="10/1/2026"
        starterPrice="US$10/mo"
        starterInteractions={25}
        starterPosts={1}
        onOpenChange={vi.fn()}
      />
    )
    expect(captureEvent).toHaveBeenCalledTimes(1)
  })

  it('tells a trialing member there is no charge', () => {
    renderIt({ isTrialing: true })
    expect(screen.getByText(/You won't be charged\. Your trial ends on 10\/1\/2026/)).toBeInTheDocument()
  })

  it('shows a minimal error state instead of an endless ellipsis when the recap read fails (F16)', () => {
    mockRecapError = new Error('boom')
    mockQueryReturns['interactions.getRecap'] = undefined
    renderIt()
    expect(screen.getByText('An unexpected error occurred. Reloading the page usually fixes it.')).toBeInTheDocument()
    expect(screen.queryByText('…')).not.toBeInTheDocument()
  })

  it('hides Schedule Starter on the Starter tier', async () => {
    renderIt({ tier: 'starter' })
    expect(screen.queryByRole('button', { name: 'Schedule Starter' })).not.toBeInTheDocument()
  })

  // A trial runs on the plan it started on (product rule, 2026-09-09), so the only saves offered here
  // are "keep my plan" and the note. billingNode refuses the downgrade for a trialing member too.
  it('hides Schedule Starter during a trial', async () => {
    renderIt({ isTrialing: true })
    expect(screen.queryByRole('button', { name: 'Schedule Starter' })).not.toBeInTheDocument()
    expect(mockCancelFlow).not.toHaveBeenCalled()
  })

  it('downgrade: fires the alternative event and asks for the downgrade portal flow', async () => {
    renderIt()
    expect(screen.getByText(/Starter on 10\/1\/2026 for US\$10\/mo/)).toHaveTextContent(
      /Weekly post limit: 1.*25 reactions and comments.*Industry filters are removed/
    )
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Starter' }))
    await waitFor(() => expect(mockCancelFlow).toHaveBeenCalledWith({ sessionToken: 'tok', flow: 'downgrade' }))
    expect(captureEvent).toHaveBeenCalledWith('cancel_alternative_taken', { from: 'growth' })
  })

  it('uses the current-period fallback when the effective date is unavailable', () => {
    renderIt({ periodEndDate: null })
    expect(screen.getByText(/Starter at the end of your current period for US\$10\/mo/)).toBeInTheDocument()
  })

  it('continue: saves a non-blank note as cancellation feedback, then opens the cancel flow', async () => {
    renderIt()
    fireEvent.change(screen.getByLabelText('What would have made you stay?'), { target: { value: '  Too pricey ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue to cancel' }))
    await waitFor(() => expect(mockCancelFlow).toHaveBeenCalledWith({ sessionToken: 'tok', flow: 'cancel' }))
    expect(mockSubmitFeedback).toHaveBeenCalledWith({
      sessionToken: 'tok',
      category: 'cancellation',
      message: 'Too pricey'
    })
  })

  it('continue with a blank note never writes feedback', async () => {
    renderIt()
    fireEvent.click(screen.getByRole('button', { name: 'Continue to cancel' }))
    await waitFor(() => expect(mockCancelFlow).toHaveBeenCalled())
    expect(mockSubmitFeedback).not.toHaveBeenCalled()
  })

  it('surfaces a portal failure as a toast', async () => {
    mockCancelFlow.mockRejectedValueOnce(new Error('boom'))
    renderIt()
    fireEvent.click(screen.getByRole('button', { name: 'Continue to cancel' }))
    await waitFor(() => expect(toast).toHaveBeenCalled())
  })

  it('Keep my plan closes without touching Stripe', () => {
    const onOpenChange = vi.fn()
    renderIt({ onOpenChange })
    fireEvent.click(screen.getByRole('button', { name: 'Keep my plan' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(mockCancelFlow).not.toHaveBeenCalled()
  })
})

// backlog/B07 — the downgrade is written as a Stripe subscription schedule, so it returns no url and
// completes here instead of on a portal return leg.
describe('scheduled downgrade (B07)', () => {
  it('hides the Starter alternative when a downgrade is already scheduled', () => {
    renderIt({ pendingTier: 'starter' })
    expect(screen.queryByRole('button', { name: 'Schedule Starter' })).not.toBeInTheDocument()
  })

  it('closes, toasts and completes the save funnel when the downgrade returns no url', async () => {
    const onOpenChange = vi.fn()
    mockCancelFlow.mockResolvedValueOnce({ url: null })
    renderIt({ onOpenChange })
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Starter' }))
    await waitFor(() => expect(captureEvent).toHaveBeenCalledWith('cancel_alternative_completed', { from: 'growth' }))
    expect(captureEvent).toHaveBeenCalledWith('cancel_alternative_taken', { from: 'growth' })
    expect(toast).toHaveBeenCalledWith('You move to Starter at the end of your period.')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('never completes the funnel on the cancel flow, which returns no url only on an error', async () => {
    mockCancelFlow.mockResolvedValueOnce({ url: null })
    renderIt()
    fireEvent.click(screen.getByRole('button', { name: 'Continue to cancel' }))
    await waitFor(() => expect(mockCancelFlow).toHaveBeenCalled())
    expect(captureEvent).not.toHaveBeenCalledWith('cancel_alternative_completed', { from: 'growth' })
  })
})
