import { render, screen } from '@testing-library/react'
import { Button } from './button'

describe('Button variants', () => {
  it('uses gold-text for the link variant (not bright primary)', () => {
    render(<Button variant="link">View on LinkedIn</Button>)
    const btn = screen.getByRole('button', { name: 'View on LinkedIn' })
    expect(btn.className).toContain('text-gold-text')
    expect(btn.className).not.toContain('text-primary')
  })
  it('keeps the gold fill on the default variant', () => {
    render(<Button>Add post</Button>)
    expect(screen.getByRole('button', { name: 'Add post' }).className).toContain('bg-primary')
  })
})
