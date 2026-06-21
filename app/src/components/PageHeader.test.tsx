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
})
