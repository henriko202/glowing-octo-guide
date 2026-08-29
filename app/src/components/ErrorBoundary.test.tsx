import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import i18n from '../i18n'
import ErrorBoundary from './ErrorBoundary'

function Bomb(): never {
  throw new Error('boom')
}

describe('ErrorBoundary', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <div>fine</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('fine')).toBeInTheDocument()
  })

  it('renders the friendly fallback and logs when a child throws', () => {
    // React (and this boundary) log the caught error to console.error — silence it in the test.
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
    expect(console.error).toHaveBeenCalledWith('Unhandled render error:', expect.any(Error), expect.anything())
  })
})
