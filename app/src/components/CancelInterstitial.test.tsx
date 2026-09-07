import { vi } from 'vitest'

vi.mock('../convex', () => ({
  api: {
    interactions: { getRecap: 'interactions.getRecap' },
    posts: { getMyPosts: 'posts.getMyPosts' },
    billingNode: { createCancelFlowSession: 'billingNode.createCancelFlowSession' },
    feedback: { feedback: { submitFeedback: 'feedback.feedback.submitFeedback' } }
  }
}))

let mockQueryReturns: Record<string, unknown> = {}
const mockCancelFlow = vi.fn(async () => ({ url: '' }))
const mockSubmitFeedback = vi.fn(async () => null)
vi.mock('convex/react', () => ({
  useQuery: vi.fn((ref: string) => mockQueryReturns[ref]),
  useAction: vi.fn(() => mockCancelFlow),
  useMutation: vi.fn(() => mockSubmitFeedback)
}))
vi.mock('@/lib/observability/analytics', () => ({ captureEvent: vi.fn() }))
vi.mock('@/components/ui/toast', () => ({ toast: vi.fn() }))

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { captureEvent } from '@/lib/observability/analytics'
import { toast } from '@/components/ui/toast'
import CancelInterstitial from './CancelInterstitial'

const RECAP = { received: { current: { total: 7 } } }
const POSTS = [{ _id: 'a' }, { _id: 'b', hidden: true }, { _id: 'c' }]

function renderIt(over: Partial<Parameters<typeof CancelInterstitial>[0]> = {}) {
  return render(
    <CancelInterstitial
      open
      tier="growth"
      isTrialing={false}
      periodEndDate="10/1/2026"
      onOpenChange={vi.fn()}
      {...over}
    />
  )
}

beforeEach(() => {
  sessionStorage.setItem('sessionToken', 'tok')
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
        onOpenChange={vi.fn()}
      />
    )
    expect(captureEvent).toHaveBeenCalledTimes(1)
  })

  it('tells a trialing member there is no charge', () => {
    renderIt({ isTrialing: true })
    expect(screen.getByText(/You won't be charged\. Your trial ends on 10\/1\/2026/)).toBeInTheDocument()
  })

  it('hides Move to Starter on the Starter tier', async () => {
    renderIt({ tier: 'starter' })
    expect(screen.queryByRole('button', { name: 'Move to Starter' })).not.toBeInTheDocument()
  })

  it('downgrade: fires the alternative event and asks for the downgrade portal flow', async () => {
    renderIt()
    fireEvent.click(screen.getByRole('button', { name: 'Move to Starter' }))
    await waitFor(() => expect(mockCancelFlow).toHaveBeenCalledWith({ sessionToken: 'tok', flow: 'downgrade' }))
    expect(captureEvent).toHaveBeenCalledWith('cancel_alternative_taken', { from: 'growth' })
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
