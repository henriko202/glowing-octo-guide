import { render, screen } from '@testing-library/react'
import { PageHeader } from './PageHeader'

describe('PageHeader', () => {
  it('renders the title as an h1', () => {
    render(<PageHeader title="Feed" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Feed' })).toBeInTheDocument()
  })
  it('renders the lead when provided', () => {
    render(
      <PageHeader
        title="Feed"
        lead="Posts from your circle."
      />
    )
    expect(screen.getByText('Posts from your circle.')).toBeInTheDocument()
  })
  it('renders action children', () => {
    render(
      <PageHeader title="Feed">
        <button>Add post</button>
      </PageHeader>
    )
    expect(screen.getByRole('button', { name: 'Add post' })).toBeInTheDocument()
  })
  it('always stacks the title/lead block above a left-aligned action row', () => {
    const { container } = render(
      <PageHeader
        title="Feed"
        lead="Posts from your circle."
      >
        <button>Add post</button>
      </PageHeader>
    )
    const wrapper = container.firstElementChild
    expect(wrapper).toHaveClass('mb-6', 'flex', 'flex-col', 'items-start', 'gap-3')
    expect(wrapper).not.toHaveClass('flex-wrap', 'justify-between')
    const heading = screen.getByRole('heading', { level: 1, name: 'Feed' })
    const lead = screen.getByText('Posts from your circle.')
    const actions = screen.getByRole('button', { name: 'Add post' }).parentElement
    expect(actions).toHaveClass('flex', 'flex-wrap', 'items-center', 'gap-2')
    expect(heading.compareDocumentPosition(actions!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(lead.compareDocumentPosition(actions!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
