import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const ackFn = vi.fn(async () => {})
vi.mock('convex/react', () => ({ useMutation: () => ackFn }))
vi.mock('../convex', () => ({ api: { privacy: { consent: { acknowledgePolicy: 'ref' } } } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

import PolicyUpdateScreen from './PolicyUpdateScreen'

describe('PolicyUpdateScreen', () => {
  beforeEach(() => {
    ackFn.mockClear()
    sessionStorage.setItem('sessionToken', 'tok')
  })

  it('renders the policy-update heading', () => {
    render(<PolicyUpdateScreen />)
    expect(screen.getByText('privacy.policyUpdate.title')).toBeInTheDocument()
  })

  it('calls acknowledgePolicy when acknowledged', async () => {
    render(<PolicyUpdateScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'privacy.policyUpdate.acknowledge' }))
    await waitFor(() => expect(ackFn).toHaveBeenCalledWith({ sessionToken: 'tok' }))
  })
})
