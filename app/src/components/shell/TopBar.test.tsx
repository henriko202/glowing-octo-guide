import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { ThemeProvider } from '../ThemeProvider'
import TopBar from './TopBar'

function renderTopBar(onOpen = vi.fn()) {
  return render(
    <ThemeProvider>
      <TopBar onOpenSidebar={onOpen} />
    </ThemeProvider>
  )
}

describe('TopBar', () => {
  it('renders the search placeholder and theme/language controls', () => {
    renderTopBar()
    expect(screen.getByRole('button', { name: /search posts, people/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /language/i })).toBeInTheDocument()
  })
  it('calls onOpenSidebar when the hamburger is clicked', () => {
    const onOpen = vi.fn()
    renderTopBar(onOpen)
    fireEvent.click(screen.getByRole('button', { name: /open navigation/i }))
    expect(onOpen).toHaveBeenCalled()
  })
})
