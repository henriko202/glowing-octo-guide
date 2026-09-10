import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CommentBox from './CommentBox'

const mocks = vi.hoisted(() => ({
  draft: 'A useful generated comment.' as string | null | undefined,
  action: vi.fn(),
  copy: vi.fn(),
  open: vi.fn()
}))

vi.mock('convex/react', () => ({
  useAction: () => mocks.action,
  useQuery: (_ref: unknown, args: { postId?: string }) => (args.postId ? mocks.draft : {})
}))
vi.mock('../lib/handoff', () => ({ delay: async () => {}, HANDOFF_DELAY_MS: 0, openLinkedIn: mocks.open }))
vi.mock('@/components/ui/toast', () => ({ toast: vi.fn() }))

const props = {
  postId: 'post123' as never,
  postUrl: 'https://www.linkedin.com/posts/example',
  sessionToken: 'test-session',
  onClose: vi.fn()
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.draft = 'A useful generated comment.'
  mocks.copy.mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: mocks.copy } })
})

describe('saved comment', () => {
  it('reloads the generated text and reopens LinkedIn without recording another interaction', async () => {
    render(
      <CommentBox
        {...props}
        commented
      />
    )
    expect(screen.getByRole('textbox', { name: /generated comment/i })).toHaveValue(mocks.draft)
    expect(screen.queryByRole('button', { name: /regenerate/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /comment on linkedin again/i }))
    await waitFor(() => expect(mocks.open).toHaveBeenCalledWith(props.postUrl))
    expect(mocks.copy).toHaveBeenCalledWith(mocks.draft)
    expect(mocks.action).not.toHaveBeenCalled()
  })

  it('keeps the text available if clipboard access fails', async () => {
    mocks.copy.mockRejectedValue(new Error('denied'))
    render(
      <CommentBox
        {...props}
        commented
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /comment on linkedin again/i }))
    await waitFor(() => expect(mocks.open).toHaveBeenCalledWith(props.postUrl))
    expect(props.onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox')).toHaveValue(mocks.draft)
  })

  it('shows an empty state and still lets the user reopen LinkedIn without a saved draft', async () => {
    mocks.draft = null
    render(
      <CommentBox
        {...props}
        commented
      />
    )
    expect(screen.getByText(/no generated comment was saved/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /comment on linkedin again/i }))
    await waitFor(() => expect(mocks.open).toHaveBeenCalledWith(props.postUrl))
    expect(mocks.copy).not.toHaveBeenCalled()
    expect(mocks.action).not.toHaveBeenCalled()
  })

  it('waits for the saved draft before enabling the handoff', () => {
    mocks.draft = undefined
    render(
      <CommentBox
        {...props}
        commented
      />
    )
    expect(screen.getByRole('button', { name: /comment on linkedin again/i })).toBeDisabled()
  })

  it('still records a first comment', async () => {
    render(<CommentBox {...props} />)
    fireEvent.submit(screen.getByRole('textbox').closest('form')!)
    await waitFor(() =>
      expect(mocks.action).toHaveBeenCalledWith({
        postId: props.postId,
        commentText: mocks.draft,
        sessionToken: props.sessionToken
      })
    )
  })
})
