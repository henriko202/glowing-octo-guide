import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../convex', () => ({ api: { admin: { checkIsAdmin: 'admin.checkIsAdmin' } } }))
const mockUseQuery = vi.fn()
vi.mock('convex/react', () => ({ useQuery: (...args: unknown[]) => mockUseQuery(...args) }))

import RequireAdmin from './RequireAdmin'

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <p>admin content</p>
            </RequireAdmin>
          }
        />
        <Route
          path="/"
          element={<p>home</p>}
        />
      </Routes>
    </MemoryRouter>
  )
}

describe('RequireAdmin', () => {
  beforeEach(() => mockUseQuery.mockReset())

  it('mounts the route only once the admin check resolves true', () => {
    mockUseQuery.mockReturnValue(true)
    renderGuard()
    expect(mockUseQuery).toHaveBeenCalledWith('admin.checkIsAdmin', { sessionToken: undefined })
    expect(screen.getByText('admin content')).toBeInTheDocument()
  })

  it('never mounts the route for a non-admin, redirecting to the app root', () => {
    mockUseQuery.mockReturnValue(false)
    renderGuard()
    expect(screen.getByText('home')).toBeInTheDocument()
    expect(screen.queryByText('admin content')).not.toBeInTheDocument()
  })

  it('mounts nothing but the spinner while the admin check is pending', () => {
    mockUseQuery.mockReturnValue(undefined)
    renderGuard()
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    expect(screen.queryByText('admin content')).not.toBeInTheDocument()
  })
})
