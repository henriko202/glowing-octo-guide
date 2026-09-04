import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
  useQuery: () => ({
    people: [{ _id: 'u1', name: 'Mariana Costa', headline: 'Designer', linkedinPublicIdentifier: 'mariana' }],
    posts: [{ _id: 'p1', content: 'Lifted our SSI by 18 points', sourceUrl: 'https://x', author: null }]
  })
}))

import { ThemeProvider } from '../ThemeProvider'
import CommandPalette from './CommandPalette'

describe('CommandPalette', () => {
  it('shows quick actions (nav + sign out) when opened with no query', () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <CommandPalette
            open
            onOpenChange={() => {}}
          />
        </MemoryRouter>
      </ThemeProvider>
    )
    expect(screen.getByText(/quick actions/i)).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /sign out/i })).toBeInTheDocument()
    // Results only render once a query is typed (>=2 chars) — quick actions own the idle state.
    expect(screen.queryByText('Mariana Costa')).not.toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <CommandPalette
            open={false}
            onOpenChange={() => {}}
          />
        </MemoryRouter>
      </ThemeProvider>
    )
    expect(screen.queryByText(/quick actions/i)).not.toBeInTheDocument()
  })
})
