import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import FirstPostPromptScreen from './FirstPostPromptScreen'

vi.mock('../convex', () => ({
  api: {
    posts: { submitPost: 'posts.submitPost' },
    users: { getMe: 'users.getMe', dismissFirstPostPrompt: 'users.dismissFirstPostPrompt' }
  }
}))

let mockQueryReturns: Record<string, unknown> = {}
const mockDismiss = vi.fn(async () => {})
vi.mock('convex/react', () => ({
  useAction: vi.fn(() => async () => {}),
  useMutation: vi.fn(() => mockDismiss),
  useQuery: vi.fn((ref: string) => mockQueryReturns[ref])
}))

describe('FirstPostPromptScreen', () => {
  beforeEach(() => {
    mockDismiss.mockClear()
    sessionStorage.setItem('sessionToken', 'tok')
    mockQueryReturns = { 'users.getMe': { subscriptionStatus: 'active' } }
    // jsdom has no navigation; stub reload + href so the skip/submit handlers don't throw.
    Object.defineProperty(window, 'location', { configurable: true, value: { reload: vi.fn(), href: '' } })
  })

  it('shows the first-post prompt and the composer', () => {
    render(<FirstPostPromptScreen />)
    expect(screen.getByText(/add one of your linkedin posts/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/linkedin\.com\/posts/i)).toBeInTheDocument()
  })

  it('fires the dismiss mutation when the user skips', async () => {
    render(<FirstPostPromptScreen />)
    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }))
    await waitFor(() => expect(mockDismiss).toHaveBeenCalledOnce())
  })

  it('reloads into the feed after submitting, even for a card-gated member', async () => {
    render(<FirstPostPromptScreen />)
    fireEvent.change(screen.getByPlaceholderText(/linkedin\.com\/posts/i), {
      target: { value: 'https://www.linkedin.com/posts/jane_hello-activity-123' }
    })
    fireEvent.click(screen.getByRole('button', { name: /add post/i }))
    await waitFor(() => expect(window.location.reload).toHaveBeenCalledOnce())
    expect(window.location.href).toBe('')
  })

  // A past_due member cannot submit (assertCanSubmitPost): the prompt's composer is disabled with
  // the fix-payment link instead of surfacing the server refusal as an error.
  it('disables the composer for a past_due member with the fix-payment link', () => {
    mockQueryReturns['users.getMe'] = { subscriptionStatus: 'past_due' }
    render(
      <MemoryRouter>
        <FirstPostPromptScreen />
      </MemoryRouter>
    )
    fireEvent.change(screen.getByPlaceholderText(/linkedin\.com\/posts/i), {
      target: { value: 'https://www.linkedin.com/posts/jane_hello-activity-123' }
    })
    expect(screen.getByRole('button', { name: /add post/i })).toBeDisabled()
    expect(screen.getByRole('link', { name: /update payment method/i })).toHaveAttribute('href', '/billing')
  })
})
