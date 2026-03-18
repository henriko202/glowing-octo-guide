import { render, screen } from '@testing-library/react'
import LoginPage from './LoginPage'

describe('LoginPage', () => {
  it('renders the Sign in with LinkedIn link', () => {
    render(<LoginPage />)
    const link = screen.getByRole('link', { name: /sign in with linkedin/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href')
  })
})
