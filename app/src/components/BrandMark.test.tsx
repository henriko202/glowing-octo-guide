import { render, screen } from '@testing-library/react'
import BrandMark from './BrandMark'

describe('BrandMark', () => {
  it('renders the wordmark text', () => {
    render(<BrandMark />)
    expect(screen.getByText('Link Into The SSI')).toBeInTheDocument()
  })
})
