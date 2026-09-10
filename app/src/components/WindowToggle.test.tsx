import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import WindowToggle from './WindowToggle'

describe('WindowToggle', () => {
  it('renders one pressed button per option and reports clicks', () => {
    const onChange = vi.fn()
    render(
      <WindowToggle
        value="7d"
        onChange={onChange}
        options={['7d', '30d'] as const}
      />
    )
    expect(screen.getByRole('button', { name: 'Last 7 days' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Last 30 days' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Last 30 days' }))
    expect(onChange).toHaveBeenCalledWith('30d')
  })
})
