import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => `${key}${opts ? JSON.stringify(opts) : ''}`
  })
}))

import RankingList from './RankingList'

describe('RankingList', () => {
  it('renders rank numbers, names and counts on card surfaces, ringing the member row', () => {
    render(
      <RankingList
        titleKey="rankings.topInteractors"
        variant="personal"
        rows={[
          { userId: 'u1', name: 'Ana', count: 9, lastAt: 1 },
          { userId: 'me', name: 'Me', count: 4, lastAt: 2 }
        ]}
        meId="me"
      />
    )
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText(/rankings\.count\{"count":9\}/)).toBeInTheDocument()
    expect(screen.getByText('Ana').closest('li')).toHaveClass(
      'rounded-lg',
      'border',
      'border-amber-500',
      'bg-card',
      'px-3',
      'py-2'
    )
    expect(screen.getByText('Me').closest('li')).toHaveClass('ring-1', 'ring-primary/40')
  })

  it('composes the personal variant as interactions · authored posts', () => {
    render(
      <RankingList
        titleKey="rankings.toYou"
        variant="personal"
        rows={[{ userId: 'u1', name: 'Ana', count: 9, lastAt: 1, postsCount: 3 }]}
      />
    )
    expect(screen.getByText('rankings.count{"count":9} · rankings.postsCount{"count":3}')).toBeInTheDocument()
  })

  it('defaults a missing authored post count to zero on personal rows', () => {
    render(
      <RankingList
        titleKey="rankings.toYou"
        variant="personal"
        rows={[{ userId: 'u1', name: 'Ana', count: 9, lastAt: 1 }]}
      />
    )
    expect(screen.getByText('rankings.count{"count":9} · rankings.postsCount{"count":0}')).toBeInTheDocument()
  })

  it('composes the posts variant as posts · reactions received', () => {
    render(
      <RankingList
        titleKey="rankings.topPosters"
        variant="posts"
        rows={[{ userId: 'u1', name: 'Diego', count: 1, lastAt: 1, reactionsReceived: 2 }]}
      />
    )
    expect(screen.getByText('rankings.postsCount{"count":1} · rankings.reactionsCount{"count":2}')).toBeInTheDocument()
  })

  it('composes the interactors variant as interactions · distinct posts touched', () => {
    render(
      <RankingList
        titleKey="rankings.topInteractors"
        variant="interactors"
        rows={[{ userId: 'u1', name: 'Carla', count: 5, lastAt: 1, postsTouched: 3 }]}
      />
    )
    expect(
      screen.getByText('rankings.interactionsCount{"count":5} · rankings.postsTouched{"count":3}')
    ).toBeInTheDocument()
  })

  it('defaults a missing enriched count to zero', () => {
    render(
      <RankingList
        titleKey="rankings.topPosters"
        variant="posts"
        rows={[{ userId: 'u1', name: 'Diego', count: 1, lastAt: 1 }]}
      />
    )
    expect(screen.getByText('rankings.postsCount{"count":1} · rankings.reactionsCount{"count":0}')).toBeInTheDocument()
  })

  it('gives ranks 1-3 distinct gold, silver and bronze chips and leaves the rest plain', () => {
    render(
      <RankingList
        titleKey="rankings.topInteractors"
        variant="personal"
        rows={[
          { userId: 'u1', name: 'Gold', count: 9, lastAt: 1 },
          { userId: 'u2', name: 'Silver', count: 8, lastAt: 2 },
          { userId: 'u3', name: 'Bronze', count: 7, lastAt: 3 },
          { userId: 'u4', name: 'Plain', count: 6, lastAt: 4 }
        ]}
      />
    )
    const chip = (rank: number) => screen.getByLabelText(`rankings.rankLabel{"rank":${rank}}`)
    expect(chip(1)).toHaveClass('bg-amber-400', 'text-amber-950', 'ring-1', 'ring-black/5')
    expect(chip(2)).toHaveClass('bg-zinc-300', 'text-zinc-900', 'ring-1', 'ring-black/5')
    expect(chip(3)).toHaveClass('bg-amber-700', 'text-amber-50', 'ring-1', 'ring-black/5')
    expect(chip(4)).not.toHaveClass('bg-amber-400', 'bg-zinc-300', 'bg-amber-700', 'ring-1')
  })

  it('tints ranks 1-3 card borders with the medal colors and leaves rank 4 neutral', () => {
    render(
      <RankingList
        titleKey="rankings.topInteractors"
        variant="interactors"
        rows={[
          { userId: 'u1', name: 'Gold', count: 9, lastAt: 1 },
          { userId: 'u2', name: 'Silver', count: 8, lastAt: 2 },
          { userId: 'u3', name: 'Bronze', count: 7, lastAt: 3 },
          { userId: 'u4', name: 'Plain', count: 6, lastAt: 4 }
        ]}
      />
    )
    expect(screen.getByText('Gold').closest('li')).toHaveClass('border-amber-500')
    expect(screen.getByText('Silver').closest('li')).toHaveClass('border-zinc-400')
    expect(screen.getByText('Bronze').closest('li')).toHaveClass('border-amber-700')
    expect(screen.getByText('Plain').closest('li')).toHaveClass('border-border')
    expect(screen.getByText('Plain').closest('li')).not.toHaveClass(
      'border-amber-500',
      'border-zinc-400',
      'border-amber-700'
    )
  })

  function rankedRows(count: number, mePosition: number) {
    return Array.from({ length: count }, (_, i) => ({
      userId: i + 1 === mePosition ? 'me' : `u${i + 1}`,
      name: `Person ${i + 1}`,
      count: count - i,
      lastAt: 1,
      position: i + 1
    }))
  }

  it('renders the full list without a separator when the member is inside the top 10', () => {
    const { container } = render(
      <RankingList
        titleKey="rankings.topInteractors"
        variant="interactors"
        rows={rankedRows(20, 5)}
        meId="me"
      />
    )
    expect(container.querySelectorAll('li')).toHaveLength(20)
    expect(screen.queryByText('…')).not.toBeInTheDocument()
  })

  it('renders the first 10 rows, a separator and the server neighbor slice', () => {
    const rows = rankedRows(20, 15)
    const { container } = render(
      <RankingList
        titleKey="rankings.topInteractors"
        variant="interactors"
        rows={rows}
        neighbors={rows.slice(12, 17)}
        mePosition={15}
        meId="me"
      />
    )
    // 10 top rows + the separator + the five neighbor rows; the separator is not a rank row.
    expect(container.querySelectorAll('li')).toHaveLength(16)
    expect(screen.getByText('Person 15').closest('li')).toHaveClass('ring-primary/40', 'ring-1')
    expect(screen.getByText('Person 10')).toBeInTheDocument()
    expect(screen.queryByText('Person 11')).not.toBeInTheDocument()
    expect(screen.queryByText('Person 12')).not.toBeInTheDocument()
    expect(screen.getByText('Person 13')).toBeInTheDocument()
    expect(screen.getByText('Person 17')).toBeInTheDocument()
    expect(screen.queryByText('Person 18')).not.toBeInTheDocument()
    expect(screen.getByText('…')).toHaveAttribute('aria-hidden', 'true')
    // Neighbor rows keep their server positions, so the rank numbers jump across the gap.
    expect(screen.getByLabelText('rankings.rankLabel{"rank":13}')).toHaveTextContent('13')
    expect(screen.getByLabelText('rankings.rankLabel{"rank":17}')).toHaveTextContent('17')
  })

  it('shows the top rows without a separator when the server sends no neighbors', () => {
    const { container } = render(
      <RankingList
        titleKey="rankings.topInteractors"
        variant="interactors"
        rows={rankedRows(20, 99)}
        mePosition={99}
        meId="me"
      />
    )
    expect(container.querySelectorAll('li')).toHaveLength(20)
    expect(screen.queryByText('…')).not.toBeInTheDocument()
  })

  it('renders the server position for ties so tied rows share the same number', () => {
    render(
      <RankingList
        titleKey="rankings.topInteractors"
        variant="interactors"
        rows={[
          { userId: 'u1', name: 'First', count: 9, lastAt: 1, position: 1 },
          { userId: 'u2', name: 'Tie A', count: 7, lastAt: 2, position: 2 },
          { userId: 'u3', name: 'Tie B', count: 7, lastAt: 3, position: 2 },
          { userId: 'u4', name: 'Fourth', count: 5, lastAt: 4, position: 4 }
        ]}
      />
    )
    expect(screen.getAllByLabelText('rankings.rankLabel{"rank":2}')).toHaveLength(2)
    expect(screen.getByLabelText('rankings.rankLabel{"rank":4}')).toHaveTextContent('4')
    expect(screen.queryByLabelText('rankings.rankLabel{"rank":3}')).not.toBeInTheDocument()
  })
})
