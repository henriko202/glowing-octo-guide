import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getFunctionName } from 'convex/server'
import { useMutation, useQuery } from 'convex/react'
import FeedbackTab from './FeedbackTab'

const mockRows = [
  {
    _id: 'fb1',
    category: 'bug',
    message: 'The share button is broken on mobile',
    status: 'new',
    createdAt: 1,
    responses: [],
    userName: 'Jane',
    userEmail: 'jane@example.com'
  },
  {
    _id: 'fb2',
    category: 'praise',
    message: 'Love this app',
    status: 'responded',
    createdAt: 2,
    responses: [{ text: 'Thank you!', createdAt: 3, responderName: 'Admin' }],
    userName: 'Bob',
    userEmail: 'bob@example.com'
  },
  {
    _id: 'fb3',
    category: 'comment',
    message: 'Old feedback that was archived',
    status: 'archived',
    createdAt: 3,
    responses: [],
    userName: 'Carol',
    userEmail: 'carol@example.com'
  }
]
const mocks = {
  archiveFeedback: vi.fn(),
  reopenFeedback: vi.fn(),
  respondToFeedback: vi.fn()
}

vi.mock('convex/react', () => ({ useQuery: vi.fn(), useMutation: vi.fn() }))

beforeEach(() => {
  Object.values(mocks).forEach(m => m.mockReset().mockResolvedValue(undefined))
  vi.mocked(useQuery).mockReturnValue(mockRows)
  vi.mocked(useMutation).mockImplementation((ref: unknown) => {
    const name =
      getFunctionName(ref as Parameters<typeof getFunctionName>[0])
        .split(':')
        .pop() ?? ''
    return (mocks[name as keyof typeof mocks] ?? vi.fn()) as never
  })
})

describe('FeedbackTab', () => {
  it('lists feedback rows with submitter and category', () => {
    render(
      <FeedbackTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    expect(screen.getByText('Jane')).toBeInTheDocument()
    expect(screen.getByText(/the share button is broken/i)).toBeInTheDocument()
    expect(screen.getByText('bug')).toBeInTheDocument()
  })

  it('filters to New only', () => {
    render(
      <FeedbackTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^new$/i }))
    expect(screen.getByText('Jane')).toBeInTheDocument()
    expect(screen.queryByText('Bob')).not.toBeInTheDocument()
  })

  it('shows reply text beneath the message for a responded row', () => {
    render(
      <FeedbackTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    expect(screen.getByText(/thank you!/i)).toBeInTheDocument()
  })

  it('Archive calls archiveFeedback with sessionToken and feedbackId for a non-archived row', () => {
    render(
      <FeedbackTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    // Open the actions menu for Jane's row (status: 'new')
    fireEvent.click(screen.getByRole('button', { name: /actions for feedback from jane/i }))
    // Click the Archive action item
    fireEvent.click(screen.getByRole('button', { name: /^archive$/i }))
    expect(mocks.archiveFeedback).toHaveBeenCalledWith({ sessionToken: 'tok', feedbackId: 'fb1' })
  })

  it('Reopen calls reopenFeedback with sessionToken and feedbackId for an archived row', () => {
    render(
      <FeedbackTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    // Open the actions menu for Carol's row (status: 'archived')
    fireEvent.click(screen.getByRole('button', { name: /actions for feedback from carol/i }))
    // Click the Reopen action item
    fireEvent.click(screen.getByRole('button', { name: /^reopen$/i }))
    expect(mocks.reopenFeedback).toHaveBeenCalledWith({ sessionToken: 'tok', feedbackId: 'fb3' })
  })

  it('Respond… opens the RespondFeedbackModal with the submitter name', () => {
    render(
      <FeedbackTab
        sessionToken="tok"
        isAdmin={true}
      />
    )
    // Open the actions menu for Jane's row (status: 'new')
    fireEvent.click(screen.getByRole('button', { name: /actions for feedback from jane/i }))
    // Click the Respond… action item (exact text with ellipsis character)
    fireEvent.click(screen.getByRole('button', { name: 'Respond…' }))
    // RespondFeedbackModal should render with the submitter's name
    expect(screen.getByText(/respond to jane/i)).toBeInTheDocument()
  })
})
