import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { SUPPORT_EMAIL } from '../lib/support'

const mockUnsubscribe = vi.fn(async (_args: { token: string; scope: 'digest' | 'all' }) => ({ status: 'ok' }))
const mockSetSearchParams = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock('convex/react', () => ({
  useMutation: vi.fn(() => mockUnsubscribe)
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('react-router-dom', () => ({
  MemoryRouter: ({ children }: { children: ReactNode }) => children,
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useSearchParams: () => [mockSearchParams, mockSetSearchParams]
}))

import UnsubscribePage from './UnsubscribePage'

function renderAt(search: string) {
  mockSearchParams = new URLSearchParams(search)
  return render(
    <MemoryRouter>
      <UnsubscribePage />
    </MemoryRouter>
  )
}

describe('UnsubscribePage', () => {
  beforeEach(() => {
    mockUnsubscribe.mockClear()
    mockSetSearchParams.mockClear()
    mockSearchParams = new URLSearchParams()
  })

  it('shows the confirm intro, both scope buttons and the all-emails note when a token is present', () => {
    renderAt('?token=tok.sig')

    expect(screen.getByText('unsubscribed.intro')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'unsubscribed.confirmDigest' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'unsubscribed.confirmAll' })).toBeEnabled()
    expect(screen.getByText('unsubscribed.allNote')).toBeInTheDocument()
  })

  it('calls the digest scope, shows the digest success copy and drops the token from the URL', async () => {
    mockUnsubscribe.mockResolvedValue({ status: 'ok' })
    renderAt('?token=tok.sig')

    fireEvent.click(screen.getByRole('button', { name: 'unsubscribed.confirmDigest' }))

    await waitFor(() => expect(screen.getByText('unsubscribed.ok')).toBeInTheDocument())
    expect(mockUnsubscribe).toHaveBeenCalledWith({ token: 'tok.sig', scope: 'digest' })
    expect(mockSetSearchParams).toHaveBeenCalledWith({ status: 'ok' }, { replace: true })
    expect(screen.getByRole('link', { name: 'unsubscribed.reEnable' })).toHaveAttribute('href', '/settings')
    expect(document.body.textContent).not.toContain('tok.sig')
  })

  it('calls the all scope and shows the all-emails success copy', async () => {
    mockUnsubscribe.mockResolvedValue({ status: 'ok' })
    renderAt('?token=tok.sig')

    fireEvent.click(screen.getByRole('button', { name: 'unsubscribed.confirmAll' }))

    await waitFor(() => expect(screen.getByText('unsubscribed.okAll')).toBeInTheDocument())
    expect(mockUnsubscribe).toHaveBeenCalledWith({ token: 'tok.sig', scope: 'all' })
    expect(mockSetSearchParams).toHaveBeenCalledWith({ status: 'ok' }, { replace: true })
    expect(screen.queryByText('unsubscribed.ok')).not.toBeInTheDocument()
  })

  it('disables both buttons while a call is in flight', async () => {
    let resolveCall!: (value: { status: string }) => void
    mockUnsubscribe.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveCall = resolve
        })
    )
    renderAt('?token=tok.sig')

    fireEvent.click(screen.getByRole('button', { name: 'unsubscribed.confirmDigest' }))

    expect(screen.getByRole('button', { name: 'unsubscribed.confirmDigest' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'unsubscribed.confirmAll' })).toBeDisabled()

    resolveCall({ status: 'ok' })
    await waitFor(() => expect(screen.getByText('unsubscribed.ok')).toBeInTheDocument())
  })

  it('renders the invalid status with the support link and never echoes the token', () => {
    renderAt('?status=invalid&token=secret-token')

    expect(screen.getByText('unsubscribed.invalid')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'unsubscribed.privacyLink' })).toHaveAttribute('href', '/settings')
    expect(screen.getByRole('link', { name: SUPPORT_EMAIL })).toHaveAttribute('href', `mailto:${SUPPORT_EMAIL}`)
    expect(document.body.textContent).not.toContain('secret-token')
  })

  it('renders the unavailable status with the support link', () => {
    renderAt('?status=unavailable')

    expect(screen.getByText('unsubscribed.unavailable')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: SUPPORT_EMAIL })).toBeInTheDocument()
  })

  it('renders the success state from the one-click POST redirect', () => {
    renderAt('?status=ok')

    expect(screen.getByText('unsubscribed.ok')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'unsubscribed.reEnable' })).toHaveAttribute('href', '/settings')
  })

  it('renders invalid when the mutation rejects the token', async () => {
    mockUnsubscribe.mockResolvedValue({ status: 'invalid' })
    renderAt('?token=tok.sig')

    fireEvent.click(screen.getByRole('button', { name: 'unsubscribed.confirmDigest' }))

    await waitFor(() => expect(screen.getByText('unsubscribed.invalid')).toBeInTheDocument())
    expect(document.body.textContent).not.toContain('tok.sig')
    expect(mockSetSearchParams).not.toHaveBeenCalled()
  })

  it('renders unavailable when the mutation reports it', async () => {
    mockUnsubscribe.mockResolvedValue({ status: 'unavailable' })
    renderAt('?token=tok.sig')

    fireEvent.click(screen.getByRole('button', { name: 'unsubscribed.confirmDigest' }))

    await waitFor(() => expect(screen.getByText('unsubscribed.unavailable')).toBeInTheDocument())
  })

  it('renders unavailable when the call throws', async () => {
    mockUnsubscribe.mockRejectedValue(new Error('offline'))
    renderAt('?token=tok.sig')

    fireEvent.click(screen.getByRole('button', { name: 'unsubscribed.confirmDigest' }))

    await waitFor(() => expect(screen.getByText('unsubscribed.unavailable')).toBeInTheDocument())
  })

  it('treats a link with neither token nor status as invalid', () => {
    renderAt('')

    expect(screen.getByText('unsubscribed.invalid')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'unsubscribed.confirmDigest' })).not.toBeInTheDocument()
  })
})
