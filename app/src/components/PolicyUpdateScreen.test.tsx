import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PolicyUpdateScreen from './PolicyUpdateScreen'

const ackFn = vi.fn(async () => {})
vi.mock('convex/react', () => ({ useMutation: () => ackFn }))
vi.mock('../convex', () => ({ api: { privacy: { consent: { acknowledgePolicy: 'ref' } } } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

describe('PolicyUpdateScreen', () => {
  beforeEach(() => {
    ackFn.mockClear()
    sessionStorage.setItem('sessionToken', 'tok')
    // jsdom has no navigation; stub reload so the handler's refresh doesn't log "Not implemented".
    Object.defineProperty(window, 'location', { configurable: true, value: { reload: vi.fn() } })
  })

  it('renders the policy-update heading', () => {
    render(<PolicyUpdateScreen />)
    expect(screen.getByText('privacy.policyUpdate.title')).toBeInTheDocument()
  })

  it('calls acknowledgePolicy when acknowledged', async () => {
    render(<PolicyUpdateScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'privacy.policyUpdate.acknowledge' }))
    await waitFor(() => expect(window.location.reload).toHaveBeenCalledOnce())
    expect(ackFn).toHaveBeenCalledWith({ sessionToken: 'tok' })
  })
})
