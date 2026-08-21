import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { ThemeProvider } from '../ThemeProvider'
import TopBar from './TopBar'

function renderTopBar(onOpen = vi.fn(), onSearch = vi.fn()) {
  return render(
    <ThemeProvider>
      <TopBar
        onOpenSidebar={onOpen}
        onOpenSearch={onSearch}
      />
    </ThemeProvider>
  )
}

describe('TopBar', () => {
  it('renders the search button and theme/language controls', () => {
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
  it('calls onOpenSearch when the search button is clicked', () => {
    const onSearch = vi.fn()
    renderTopBar(vi.fn(), onSearch)
    fireEvent.click(screen.getByRole('button', { name: /search posts, people/i }))
    expect(onSearch).toHaveBeenCalled()
  })
})
