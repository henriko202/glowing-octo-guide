import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => `${key}${opts ? JSON.stringify(opts) : ''}`
  })
}))

import RankingList from './RankingList'

describe('RankingList', () => {
  it('renders rank numbers, names and counts, highlighting the member row', () => {
    render(
      <RankingList
        titleKey="rankings.topInteractors"
        rows={[
          { userId: 'u1', name: 'Ana', count: 9, lastAt: 1 },
          { userId: 'me', name: 'Me', count: 4, lastAt: 2 }
        ]}
        meId="me"
      />
    )
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText(/rankings\.count\{"count":9\}/)).toBeInTheDocument()
    expect(screen.getByText('Me').closest('li')).toHaveClass('bg-muted')
  })
})
