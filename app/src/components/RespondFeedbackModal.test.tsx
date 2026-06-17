import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getFunctionName } from 'convex/server'
import { useMutation } from 'convex/react'
import type { Id } from '../../../convex/_generated/dataModel'
import RespondFeedbackModal from './RespondFeedbackModal'

const mocks = { respondToFeedback: vi.fn() }
vi.mock('convex/react', () => ({ useMutation: vi.fn() }))

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  _id: 'fb1' as Id<'feedback'>,
  message: 'The button is broken',
  userName: 'Jane',
  userEmail: 'jane@example.com',
  responses: [] as { text: string; createdAt: number; responderName: string | null }[],
  ...over
})

beforeEach(() => {
  mocks.respondToFeedback.mockReset().mockResolvedValue(undefined)
  vi.mocked(useMutation).mockImplementation((ref: unknown) => {
    const name =
      getFunctionName(ref as Parameters<typeof getFunctionName>[0])
        .split(':')
        .pop() ?? ''
    return (mocks[name as keyof typeof mocks] ?? vi.fn()) as never
  })
})

describe('RespondFeedbackModal', () => {
  it('sends the reply with sendEmail: true when checkbox is left checked (default)', async () => {
    const onClose = vi.fn()
    render(
      <RespondFeedbackModal
        feedback={row()}
        sessionToken="tok"
        onClose={onClose}
      />
    )
    fireEvent.change(screen.getByLabelText(/your reply/i), { target: { value: 'Fixed in the next release' } })
    fireEvent.click(screen.getByRole('button', { name: /send reply/i }))
    await waitFor(() =>
      expect(mocks.respondToFeedback).toHaveBeenCalledWith({
        sessionToken: 'tok',
        feedbackId: 'fb1',
        responseText: 'Fixed in the next release',
        sendEmail: true
      })
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('sends the reply with sendEmail: false when checkbox is unchecked', async () => {
    const onClose = vi.fn()
    render(
      <RespondFeedbackModal
        feedback={row()}
        sessionToken="tok"
        onClose={onClose}
      />
    )
    fireEvent.change(screen.getByLabelText(/your reply/i), { target: { value: 'Fixed in the next release' } })
    // Uncheck the send email checkbox
    fireEvent.click(screen.getByRole('checkbox', { name: /send email to submitter/i }))
    fireEvent.click(screen.getByRole('button', { name: /send reply/i }))
    await waitFor(() =>
      expect(mocks.respondToFeedback).toHaveBeenCalledWith({
        sessionToken: 'tok',
        feedbackId: 'fb1',
        responseText: 'Fixed in the next release',
        sendEmail: false
      })
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('disables replying when the submitter has no email on file', () => {
    render(
      <RespondFeedbackModal
        feedback={row({ userEmail: null, userName: null })}
        sessionToken="tok"
        onClose={() => {}}
      />
    )
    expect(screen.getByText(/no email on file/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send reply/i })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: /your reply/i })).toBeDisabled()
  })

  it('renders reply history when responses are provided', () => {
    render(
      <RespondFeedbackModal
        feedback={row({
          responses: [
            { text: 'Thank you for the report!', createdAt: 1000, responderName: 'Admin' },
            { text: 'Fixed in v2.0', createdAt: 2000, responderName: null }
          ]
        })}
        sessionToken="tok"
        onClose={() => {}}
      />
    )
    expect(screen.getByText(/reply history/i)).toBeInTheDocument()
    expect(screen.getByText('Thank you for the report!')).toBeInTheDocument()
    expect(screen.getByText('Fixed in v2.0')).toBeInTheDocument()
  })

  it('does not show reply history block when responses is empty', () => {
    render(
      <RespondFeedbackModal
        feedback={row()}
        sessionToken="tok"
        onClose={() => {}}
      />
    )
    expect(screen.queryByText(/reply history/i)).not.toBeInTheDocument()
  })

  it('checkbox is disabled and unchecked when submitter has no email', () => {
    render(
      <RespondFeedbackModal
        feedback={row({ userEmail: null })}
        sessionToken="tok"
        onClose={() => {}}
      />
    )
    const checkbox = screen.getByRole('checkbox', { name: /send email to submitter/i })
    expect(checkbox).toBeDisabled()
    expect(checkbox).not.toBeChecked()
  })
})
