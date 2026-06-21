import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import Modal from './Modal'

describe('Modal', () => {
  it('renders its children inside a dialog', () => {
    render(
      <Modal onClose={() => {}}>
        <p>Hello</p>
      </Modal>
    )
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(
      <Modal onClose={onClose}>
        <p>Body</p>
      </Modal>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose on Escape when dismissOnEscape is false', () => {
    const onClose = vi.fn()
    render(
      <Modal
        onClose={onClose}
        dismissOnEscape={false}
      >
        <p>Body</p>
      </Modal>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not call onClose when content is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal onClose={onClose}>
        <p>Body</p>
      </Modal>
    )
    fireEvent.click(screen.getByText('Body'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
