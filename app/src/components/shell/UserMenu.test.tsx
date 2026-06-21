import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }))

import UserMenu from './UserMenu'

describe('UserMenu', () => {
  it('renders the menu trigger with an accessible label', () => {
    render(
      <MemoryRouter>
        <UserMenu name="Mariana Costa" />
      </MemoryRouter>
    )
    expect(screen.getByRole('button', { name: /open user menu/i })).toBeInTheDocument()
    expect(screen.getByText('Mariana Costa')).toBeInTheDocument()
  })
})
