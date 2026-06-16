import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import Modal from './Modal'

describe('Modal', () => {
  it('renders its children', () => {
    render(
      <Modal onClose={() => {}}>
        <p>Hello</p>
      </Modal>
    )
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal onClose={onClose}>
        <p>Body</p>
      </Modal>
    )
    fireEvent.click(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when the card body is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal onClose={onClose}>
        <p>Body</p>
      </Modal>
    )
    fireEvent.click(screen.getByText('Body'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(
      <Modal onClose={onClose}>
        <p>Body</p>
      </Modal>
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
