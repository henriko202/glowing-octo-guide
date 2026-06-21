import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }))

import { ThemeProvider } from '../ThemeProvider'
import AppShell from './AppShell'

describe('AppShell', () => {
  it('renders children inside the main landmark with a skip link', () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/feed']}>
          <AppShell>
            <p>Hello feed</p>
          </AppShell>
        </MemoryRouter>
      </ThemeProvider>
    )
    expect(screen.getByText('Hello feed')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /skip to content/i })).toHaveAttribute('href', '#main-content')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
  })
})
