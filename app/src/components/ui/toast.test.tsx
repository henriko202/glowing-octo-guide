import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Toaster, toast } from './toast'

describe('toast', () => {
  it('renders a message pushed via toast()', () => {
    render(<Toaster />)
    act(() => {
      toast('Draft copied')
    })
    expect(screen.getByText('Draft copied')).toBeInTheDocument()
  })

  it('renders a clickable toast and calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<Toaster />)
    act(() => {
      toast('New comment', { onClick })
    })
    fireEvent.click(screen.getByRole('button', { name: 'New comment' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
