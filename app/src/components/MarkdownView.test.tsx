import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MarkdownView from './MarkdownView'

describe('MarkdownView', () => {
  it('renders GFM markdown with safe external links', () => {
    render(<MarkdownView markdown={'# Title\n\n**bold** and [link](https://example.com)'} />)
    expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument()
    expect(screen.getByText('bold')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'link' })
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel') ?? '').toContain('noopener')
  })

  it('does not render raw HTML as live markup', () => {
    const { container } = render(<MarkdownView markdown={'<script>alert(1)</script><b>x</b>'} />)
    expect(container.querySelector('script')).toBeNull()
    // react-markdown (no rehype-raw) renders raw HTML as literal text, not parsed elements.
    expect(container.textContent).toContain('<b>x</b>')
  })

  it('neutralizes javascript: links', () => {
    render(<MarkdownView markdown={'[x](javascript:alert(1))'} />)
    const anchor = screen.getByText('x')
    expect(anchor.getAttribute('href') ?? '').not.toContain('javascript:')
    // react-markdown v10's default urlTransform strips javascript: URLs to an empty string
    expect(anchor.getAttribute('href')).toBe('')
  })
})
