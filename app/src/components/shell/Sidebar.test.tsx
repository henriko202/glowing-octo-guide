import { vi } from 'vitest'
vi.mock('convex/react', () => ({ useMutation: () => vi.fn(), useQuery: () => undefined }))

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Sidebar from './Sidebar'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>
  )
}

describe('Sidebar', () => {
  it('renders the grouped nav links', () => {
    renderAt('/feed')
    expect(screen.getByRole('link', { name: 'Feed' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'My Posts' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Billing' })).toBeInTheDocument()
  })
  it('marks the current route with aria-current', () => {
    renderAt('/billing')
    expect(screen.getByRole('link', { name: 'Billing' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Feed' })).not.toHaveAttribute('aria-current')
  })
  it('never renders an Admin link', () => {
    renderAt('/feed')
    expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument()
  })
})
