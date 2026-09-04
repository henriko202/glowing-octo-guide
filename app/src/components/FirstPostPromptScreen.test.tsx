import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FirstPostPromptScreen from './FirstPostPromptScreen'

vi.mock('../convex', () => ({
  api: {
    posts: { submitPost: 'posts.submitPost' },
    users: { getMe: 'users.getMe', dismissFirstPostPrompt: 'users.dismissFirstPostPrompt' }
  }
}))

const mockDismiss = vi.fn(async () => {})
// useCardGate() reads getMe via useQuery; a 'none' member is card-gated → funnel to billing.
vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => ({ subscriptionStatus: 'none' })),
  useAction: vi.fn(() => async () => {}),
  useMutation: vi.fn(() => mockDismiss)
}))

describe('FirstPostPromptScreen', () => {
  beforeEach(() => {
    mockDismiss.mockClear()
    sessionStorage.setItem('sessionToken', 'tok')
    // jsdom has no navigation; stub reload + href so the skip/submit handlers don't throw.
    Object.defineProperty(window, 'location', { configurable: true, value: { reload: vi.fn(), href: '' } })
  })

  it('shows the first-post prompt and the composer', () => {
    render(<FirstPostPromptScreen />)
    expect(screen.getByText(/share your best recent post/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/linkedin\.com\/posts/i)).toBeInTheDocument()
  })

  it('fires the dismiss mutation when the user skips', async () => {
    render(<FirstPostPromptScreen />)
    fireEvent.click(screen.getByRole('button', { name: /i'll do this later/i }))
    await waitFor(() => expect(mockDismiss).toHaveBeenCalledOnce())
  })

  it('funnels a card-gated member to billing after submitting', async () => {
    render(<FirstPostPromptScreen />)
    fireEvent.change(screen.getByPlaceholderText(/linkedin\.com\/posts/i), {
      target: { value: 'https://www.linkedin.com/posts/jane_hello-activity-123' }
    })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    await waitFor(() => expect(window.location.href).toBe('/billing'))
  })
})
