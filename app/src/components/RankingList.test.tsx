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
      'border-border',
      'bg-card',
      'px-3',
      'py-2'
    )
    expect(screen.getByText('Me').closest('li')).toHaveClass('ring-1', 'ring-primary/40')
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
})
