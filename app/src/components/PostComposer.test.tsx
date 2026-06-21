// app/src/components/PostComposer.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PostComposer from './PostComposer'

describe('PostComposer', () => {
  it('renders the URL input and submit button', () => {
    render(<PostComposer onSubmit={async () => {}} />)
    expect(screen.getByPlaceholderText(/linkedin\.com\/posts/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
  })

  it('disables submit button when input is empty', () => {
    render(<PostComposer onSubmit={async () => {}} />)
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled()
  })

  it('enables submit button when URL is typed', () => {
    render(<PostComposer onSubmit={async () => {}} />)
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'https://www.linkedin.com/posts/test_123-XyZ' }
    })
    expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled()
  })

  it('shows error message when onSubmit throws', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Ownership failed'))
    render(<PostComposer onSubmit={onSubmit} />)
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'https://www.linkedin.com/posts/test_123-XyZ' }
    })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    expect(await screen.findByText(/ownership failed/i)).toBeInTheDocument()
  })

  it('clears input after successful submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<PostComposer onSubmit={onSubmit} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, {
      target: { value: 'https://www.linkedin.com/posts/test_123-XyZ' }
    })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    await screen.findByRole('textbox')
    expect((input as HTMLInputElement).value).toBe('')
  })

  it('renders on a card surface', () => {
    const { container } = render(<PostComposer onSubmit={async () => {}} />)
    expect(container.querySelector('form')?.className).toContain('bg-card')
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
  })

  it('keeps submit disabled at the weekly limit even with a URL typed', () => {
    render(
      <PostComposer
        onSubmit={async () => {}}
        atLimit
        limitHint="Weekly limit reached"
      />
    )
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'https://www.linkedin.com/posts/test_123-XyZ' }
    })
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled()
    expect(screen.getByText(/weekly limit reached/i)).toBeInTheDocument()
  })
})
