import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useQuery } from 'convex/react'

vi.mock('convex/react', () => ({ useQuery: vi.fn(), useMutation: vi.fn(() => vi.fn()) }))
vi.mock('../convex', () => ({
  api: {
    motd: {
      motd: {
        listMotds: 'listMotds',
        createMotd: 'createMotd',
        updateMotd: 'updateMotd',
        deleteMotd: 'deleteMotd',
        toggleMotdEnabled: 'toggleMotdEnabled'
      }
    }
  }
}))

import MotdTab from './MotdTab'

beforeEach(() => {
  vi.mocked(useQuery).mockReturnValue([
    { _id: 'm1', bodies: { en: 'Hello world' }, important: false, enabled: true, createdAt: 1 }
  ] as never)
})

describe('MotdTab', () => {
  it('lists existing MOTDs with their status', () => {
    render(
      <MotdTab
        sessionToken="tok"
        isAdmin
      />
    )
    expect(screen.getByText('Hello world')).toBeInTheDocument()
    expect(screen.getByText('Enabled')).toBeInTheDocument()
  })

  it('opens the editor with a required EN field when creating', () => {
    render(
      <MotdTab
        sessionToken="tok"
        isAdmin
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /new motd/i }))
    expect(screen.getByText(/EN \(required\)/i)).toBeInTheDocument()
  })
})
