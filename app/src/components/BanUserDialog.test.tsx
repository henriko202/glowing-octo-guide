import { act, render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import BanUserDialog from './BanUserDialog'

describe('BanUserDialog', () => {
  it('shows the target name and a suspension warning', () => {
    render(
      <BanUserDialog
        userName="Priya Nayar"
        pending={false}
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    expect(screen.getByText(/ban priya nayar\?/i)).toBeInTheDocument()
    expect(screen.getByText(/signed out immediately/i)).toBeInTheDocument()
  })

  it('confirms with the trimmed reason text', () => {
    const onConfirm = vi.fn()
    render(
      <BanUserDialog
        userName="Priya Nayar"
        pending={false}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    )
    fireEvent.change(screen.getByPlaceholderText(/spam/i), { target: { value: '  TOS violation  ' } })
    fireEvent.click(screen.getByRole('button', { name: /^ban user$/i }))
    expect(onConfirm).toHaveBeenCalledWith('TOS violation')
  })

  it('confirms with an empty string when no reason is typed', () => {
    const onConfirm = vi.fn()
    render(
      <BanUserDialog
        userName="Priya Nayar"
        pending={false}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^ban user$/i }))
    expect(onConfirm).toHaveBeenCalledWith('')
  })

  it('calls onCancel from the Cancel button', () => {
    const onCancel = vi.fn()
    render(
      <BanUserDialog
        userName="Priya Nayar"
        pending={false}
        onConfirm={() => {}}
        onCancel={onCancel}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('ignores a backdrop click, while Cancel still cancels', async () => {
    const onCancel = vi.fn()
    render(
      <BanUserDialog
        userName="Priya Nayar"
        pending={false}
        onConfirm={() => {}}
        onCancel={onCancel}
      />
    )
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    fireEvent.pointerDown(document.body)
    expect(onCancel).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
