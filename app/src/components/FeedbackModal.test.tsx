import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FeedbackModal from './FeedbackModal'

const submitFn = vi.fn(async () => {})
vi.mock('convex/react', () => ({ useMutation: () => submitFn }))
vi.mock('../convex', () => ({ api: { feedback: { feedback: { submitFeedback: 'ref' } } } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

describe('FeedbackModal', () => {
  beforeEach(() => {
    submitFn.mockClear()
    sessionStorage.setItem('sessionToken', 'tok')
  })

  it('renders all 8 category pills', () => {
    render(<FeedbackModal onClose={() => {}} />)
    for (const c of ['feature_request', 'bug', 'comment', 'criticism', 'praise', 'question', 'suggestion', 'other']) {
      expect(screen.getByText(`feedback.categories.${c}`)).toBeInTheDocument()
    }
  })

  it('disables submit until a category and message are present', () => {
    render(<FeedbackModal onClose={() => {}} />)
    const submit = screen.getByRole('button', { name: 'feedback.submit' })
    expect(submit).toBeDisabled()
    fireEvent.click(screen.getByText('feedback.categories.bug'))
    fireEvent.change(screen.getByLabelText('feedback.messageLabel'), { target: { value: 'It broke' } })
    expect(submit).not.toBeDisabled()
  })

  it('submits the chosen category + message, then shows the thank-you state', async () => {
    const onClose = vi.fn()
    render(<FeedbackModal onClose={onClose} />)
    fireEvent.click(screen.getByText('feedback.categories.bug'))
    fireEvent.change(screen.getByLabelText('feedback.messageLabel'), { target: { value: '  It broke  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'feedback.submit' }))
    await waitFor(() =>
      expect(submitFn).toHaveBeenCalledWith({ sessionToken: 'tok', category: 'bug', message: 'It broke' })
    )
    expect(screen.getByText('feedback.thanks')).toBeInTheDocument()
  })
})
