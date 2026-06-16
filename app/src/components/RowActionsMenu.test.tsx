import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import RowActionsMenu from './RowActionsMenu'

describe('RowActionsMenu', () => {
  it('hides menu items until the kebab is clicked', () => {
    render(
      <RowActionsMenu
        label="Actions for Jordan"
        items={[{ label: 'Ban user…', onClick: () => {} }]}
      />
    )
    expect(screen.queryByText('Ban user…')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Jordan' }))
    expect(screen.getByText('Ban user…')).toBeInTheDocument()
  })

  it('fires the item callback and closes the menu', () => {
    const onClick = vi.fn()
    render(
      <RowActionsMenu
        label="Actions"
        items={[{ label: 'Unban', onClick }]}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }))
    fireEvent.click(screen.getByText('Unban'))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Unban')).not.toBeInTheDocument()
  })

  it('closes when clicking outside', () => {
    render(
      <RowActionsMenu
        label="Actions"
        items={[{ label: 'Ban user…', onClick: () => {} }]}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }))
    expect(screen.getByText('Ban user…')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('Ban user…')).not.toBeInTheDocument()
  })
})
