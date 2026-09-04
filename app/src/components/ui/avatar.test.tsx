import { render, screen } from '@testing-library/react'
import { Avatar, getInitials } from './avatar'

describe('getInitials', () => {
  it('uses first and last initial for a full name', () => {
    expect(getInitials('Mariana Costa')).toBe('MC')
  })
  it('uses one initial for a single name', () => {
    expect(getInitials('Mariana')).toBe('M')
  })
  it('falls back to "?" for an empty name', () => {
    expect(getInitials('   ')).toBe('?')
  })
})

describe('Avatar', () => {
  it('renders a decorative img with dimensions when src is provided', () => {
    const { container } = render(
      <Avatar
        name="Mariana Costa"
        src="https://example.com/a.jpg"
      />
    )
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('width', '40')
    expect(img).toHaveAttribute('height', '40')
    expect(img).toHaveAttribute('loading', 'lazy')
    expect(img).toHaveAttribute('alt', '')
    // Privacy: don't leak the app URL as referer to the LinkedIn/Apify image host.
    expect(img).toHaveAttribute('referrerpolicy', 'no-referrer')
  })
  it('renders initials when there is no src', () => {
    render(<Avatar name="Mariana Costa" />)
    expect(screen.getByText('MC')).toBeInTheDocument()
  })
})
