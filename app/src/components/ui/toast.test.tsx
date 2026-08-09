import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Toaster, toast } from './toast'

describe('toast', () => {
  it('renders a message pushed via toast()', () => {
    render(<Toaster />)
    act(() => {
      toast('Draft copied')
    })
    expect(screen.getByText('Draft copied')).toBeInTheDocument()
  })
})
