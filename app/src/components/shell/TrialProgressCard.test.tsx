import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import TrialProgressCard from './TrialProgressCard'
import type { TrialProgress } from '@/components/TrialMeter'

const baseProgress: TrialProgress = {
  made: 8,
  received: 4,
  combined: 12,
  threshold: 50,
  nearThreshold: false,
  trialEndsAt: Date.now() + 86400000
}

function renderCard(progress: TrialProgress) {
  return render(
    <MemoryRouter>
      <TrialProgressCard
        progress={progress}
        tier="growth"
      />
    </MemoryRouter>
  )
}

describe('TrialProgressCard goal sentence (fix round 1, finding 1)', () => {
  it('names the trialEndsAt date when present', () => {
    renderCard(baseProgress)
    expect(screen.getByText(/or on/i)).toBeInTheDocument()
  })

  it('falls back to a grammatical, threshold-only sentence when trialEndsAt is undefined', () => {
    renderCard({ ...baseProgress, trialEndsAt: undefined })
    // Must NOT render the broken "...or on ." — no dangling "or on" / empty interpolation.
    expect(screen.queryByText(/or on\s*\./i)).not.toBeInTheDocument()
    expect(screen.queryByText(/or on\s*$/i)).not.toBeInTheDocument()
    expect(screen.getByText(/starts at 50\./)).toBeInTheDocument()
  })
})

describe('TrialProgressCard near-threshold line', () => {
  it('names the plan that is about to start, with the exact count left', () => {
    renderCard({ ...baseProgress, combined: 45, nearThreshold: true })
    expect(screen.getByText(/5 more and your Growth plan starts/i)).toBeInTheDocument()
  })
})

describe('TrialProgressCard goal sentence threshold (Item A)', () => {
  it('interpolates a non-50 threshold instead of hardcoding 50', () => {
    renderCard({ ...baseProgress, threshold: 25 })
    expect(screen.getByText(/starts at 25/)).toBeInTheDocument()
    expect(screen.queryByText(/starts at 50/)).not.toBeInTheDocument()
  })

  it('interpolates a non-50 threshold in the no-date fallback sentence too', () => {
    renderCard({ ...baseProgress, threshold: 25, trialEndsAt: undefined })
    expect(screen.getByText(/starts at 25\./)).toBeInTheDocument()
  })
})
