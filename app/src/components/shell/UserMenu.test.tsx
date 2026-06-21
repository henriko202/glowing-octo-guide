import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
  useQuery: () => ({ name: 'Mariana Costa', headline: 'Senior Engineer' })
}))

import UserMenu from './UserMenu'

describe('UserMenu', () => {
  it('renders the signed-in user name + headline from getMe', () => {
    render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>
    )
    expect(screen.getByRole('button', { name: /open user menu/i })).toBeInTheDocument()
    expect(screen.getByText('Mariana Costa')).toBeInTheDocument()
    expect(screen.getByText('Senior Engineer')).toBeInTheDocument()
  })
})
