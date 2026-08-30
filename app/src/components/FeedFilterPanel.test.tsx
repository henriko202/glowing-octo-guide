import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedFilterPanel } from './FeedFilterPanel'

const setFeedFilter = vi.fn(async () => {})

vi.mock('convex/react', () => ({ useMutation: () => setFeedFilter }))
vi.mock('../convex', () => ({ api: { users: { setFeedFilter: 'setFeedFilter' } } }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: { label?: string }) => (o?.label ? `${k}:${o.label}` : k),
    i18n: { language: 'en' }
  })
}))

describe('FeedFilterPanel', () => {
  beforeEach(() => setFeedFilter.mockClear())

  it('shows the combined active-filter count (industries + countries)', () => {
    render(
      <FeedFilterPanel
        sessionToken="tok"
        industries={['4']}
        countries={['US', 'GB']}
      />
    )
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('clears both lists when Clear is clicked', async () => {
    render(
      <FeedFilterPanel
        sessionToken="tok"
        industries={['4']}
        countries={['US']}
      />
    )
    fireEvent.click(screen.getByText('feed.filter.clear'))
    await waitFor(() =>
      expect(setFeedFilter).toHaveBeenCalledWith({ sessionToken: 'tok', industries: [], countries: [] })
    )
  })

  it('removing an industry chip leaves the countries list untouched (dimensions independent)', async () => {
    render(
      <FeedFilterPanel
        sessionToken="tok"
        industries={['4', '41']}
        countries={['US']}
      />
    )
    fireEvent.click(screen.getByText('feed.filter.toggle'))
    // Industry code '4' => 'Software Development'; remove buttons carry aria-label feed.filter.remove:<label>.
    fireEvent.click(screen.getByLabelText('feed.filter.remove:Software Development'))
    await waitFor(() =>
      expect(setFeedFilter).toHaveBeenCalledWith({ sessionToken: 'tok', industries: ['41'], countries: ['US'] })
    )
  })

  it('keeps the panel body collapsed until the toggle is clicked', () => {
    render(
      <FeedFilterPanel
        sessionToken="tok"
        industries={[]}
        countries={[]}
      />
    )
    expect(screen.queryByText('feed.filter.note')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('feed.filter.toggle'))
    expect(screen.getByText('feed.filter.note')).toBeInTheDocument()
  })
})
